import { type Locator, type TestInfo, expect } from "@playwright/test"
import { promises as fsPromises } from "fs"
import path from "path"
import { type Page } from "playwright"
import sanitize from "sanitize-filename"

import { minDesktopWidth } from "../../styles/variables"
import { savedThemeKey } from "../constants"
import { type Theme } from "../scripts/darkmode"

/**
 * Safely gets all elements matching a locator, with proper waiting.
 * Ensures at least one element is visible before returning the array.
 * Use this instead of `.all()` when elements might not be immediately available.
 *
 * @param locator - The Playwright locator to get all elements from
 * @returns Promise resolving to an array of locators for all matching elements
 */
export async function getAllWithWait(locator: Locator): Promise<Locator[]> {
  await expect(locator.first()).toBeVisible()
  return await locator.all()
}

// skipcq: JS-0098
export async function isElementChecked(locator: Locator): Promise<boolean> {
  return await locator.evaluate((el: HTMLInputElement) => el.checked)
}

// skipcq: JS-0098
export async function setTheme(page: Page, theme: Theme) {
  await page.evaluate(
    ({ t, key }) => {
      localStorage.setItem(key, t)

      // Set theme label content via CSS custom property (not textContent to avoid duplication)
      const themeLabel = t.charAt(0).toUpperCase() + t.slice(1)
      document.documentElement.style.setProperty("--theme-label-content", `"${themeLabel}"`)

      const root = document.documentElement
      root.setAttribute("data-theme-mode", t)
      if (t === "auto") {
        const systemPreference = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        root.setAttribute("data-theme", systemPreference)
      } else {
        root.setAttribute("data-theme", t)
      }
    },
    { t: theme, key: savedThemeKey },
  )
}

/** Gets the name of the screenshot file. */
export function getScreenshotName(testInfo: TestInfo, screenshotSuffix: string): string {
  const browserName = testInfo.project.name
  const sanitizedTitle = sanitize(testInfo.title)
  const sanitizedSuffix = sanitize(screenshotSuffix)
  const sanitizedBrowserName = sanitize(browserName)
  return `${sanitizedTitle}${sanitizedSuffix ? `-${sanitizedSuffix}` : ""}-${sanitizedBrowserName}.png`.replace(
    / /g,
    "-",
  )
}

// Type for restoration data stored on window
interface IsolationRestoreData {
  element: Element
  originalDisplay: string
}

declare global {
  interface Window {
    __elementsToRestoreData?: IsolationRestoreData[]
  }
}

/**
 * Isolates a DOM element by hiding all other elements on the page.
 * @param elementLocator - The Playwright locator for the element to isolate.
 */
async function performDOMIsolation(
  elementLocator: Locator,
  preserveSiblings: boolean,
): Promise<void> {
  await elementLocator.evaluate((targetElement, preserveSiblings) => {
    const elementsToKeep = new Set<Element>()

    // Add target element and all its descendants
    elementsToKeep.add(targetElement)
    const descendants = targetElement.querySelectorAll("*")
    descendants.forEach((descendant) => elementsToKeep.add(descendant))

    // Preserve siblings of the target element (and their descendants) to maintain local layout context
    if (preserveSiblings && targetElement.parentElement) {
      const siblings = Array.from(targetElement.parentElement.children)
      for (const sibling of siblings) {
        if (sibling === targetElement) continue
        elementsToKeep.add(sibling)
        sibling.querySelectorAll("*").forEach((desc) => elementsToKeep.add(desc))
      }
    }

    // Add all ancestors up to document root
    let current: Element | null = targetElement.parentElement
    while (current) {
      elementsToKeep.add(current)
      current = current.parentElement
    }

    // Hide elements that are not in our keep set by setting display: none
    // Store original display values for restoration on window object
    const hiddenElements: Array<{ element: Element; originalDisplay: string }> = []
    const allElements = Array.from(document.querySelectorAll("*"))

    for (const element of allElements) {
      if (!elementsToKeep.has(element)) {
        const htmlElement = element as HTMLElement
        const originalDisplay = htmlElement.style.display
        hiddenElements.push({ element, originalDisplay })
        htmlElement.style.display = "none"
      }
    }

    // Store restoration data on window for later access
    window.__elementsToRestoreData = hiddenElements
  }, preserveSiblings)
}

/**
 * Restores DOM elements that were previously hidden for isolation purposes.
 * @param page - The Playwright Page instance on which to restore the DOM.
 * @returns A promise that resolves once the DOM restoration is complete.
 */
async function restoreDOMFromIsolation(page: Page): Promise<void> {
  await page.evaluate(() => {
    const hiddenElements = window.__elementsToRestoreData
    if (hiddenElements) {
      for (const { element, originalDisplay } of hiddenElements) {
        const htmlElement = element as HTMLElement
        if (originalDisplay) {
          htmlElement.style.display = originalDisplay
        } else {
          htmlElement.style.removeProperty("display")
        }
      }
      delete window.__elementsToRestoreData
    }
  })
}

export interface RegressionScreenshotOptions {
  elementToScreenshot?: Locator
  elementAboutWhichToIsolateDOM?: Locator // elementToScreenshot by default
  clip?: { x: number; y: number; width: number; height: number }
  disableHover?: boolean
  skipMediaPause?: boolean
  preserveSiblings?: boolean
}

/**
 * Takes a regression screenshot of a page or a specific element with given options.
 *
 * @param page - The Playwright Page object to capture the screenshot from.
 * @param testInfo - The TestInfo object containing test metadata.
 * @param screenshotSuffix - A suffix to append to the screenshot name.
 * @param options - Optional settings for capturing the screenshot, including element isolation, clipping, and media pause skipping.
 * @returns A Promise that resolves to a Buffer containing the screenshot image data.
 */
export async function takeRegressionScreenshot(
  page: Page,
  testInfo: TestInfo,
  screenshotSuffix: string,
  options?: RegressionScreenshotOptions,
): Promise<Buffer> {
  if (!options?.skipMediaPause) {
    await pauseMediaElements(page, options?.elementToScreenshot)

    // Wait for every video to be paused at time 0. Re-seeks if the initial
    // seek timed out (e.g. slow CI).
    const mediaScope = options?.elementToScreenshot ?? page
    const videos = await mediaScope.locator("video").all()
    for (const video of videos) {
      const handle = await video.elementHandle()
      if (!handle) throw new Error("Could not get element handle for video")
      await page.waitForFunction(
        (el) => {
          const videoEl = el as HTMLVideoElement
          if (videoEl.currentTime !== 0) {
            videoEl.pause()
            videoEl.currentTime = 0
          }
          return videoEl.paused && videoEl.currentTime === 0
        },
        handle,
        { timeout: 5000 },
      )
    }
  }

  // Separate out the element option so we don't pass it to the screenshot API
  const { elementToScreenshot: _elementOpt, ...remainingOptions } = options ?? {}
  // skipcq: JS-0098
  void _elementOpt // prevent unused variable lint error

  const screenshotOptions = {
    animations: "disabled" as const,
    // Use CSS pixel scaling to eliminate deviceScaleFactor/DPR-induced subpixel jitter
    scale: "css" as const,
    ...remainingOptions,
  }

  let screenshotBuffer: Buffer
  const screenshotName = getScreenshotName(testInfo, screenshotSuffix)
  if (options?.elementToScreenshot) {
    // Temporarily isolate element to prevent position shifts from unrelated content changes
    const elementToIsolate = options.elementAboutWhichToIsolateDOM ?? options.elementToScreenshot
    await performDOMIsolation(elementToIsolate, options.preserveSiblings ?? false)
    // skipcq: JS-0098
    const restoreDOM = async (): Promise<void> => {
      await restoreDOMFromIsolation(page)
    }

    try {
      screenshotBuffer = await options.elementToScreenshot.screenshot(screenshotOptions)
    } finally {
      // Always restore the DOM state
      await restoreDOM()
    }
  } else {
    screenshotBuffer = await page.screenshot(screenshotOptions)
  }

  // Write screenshot to lost-pixel directory for visual regression comparison
  // (replaces toHaveScreenshot — baselines are managed by lost-pixel cloud, not locally)
  const screenshotPath = testInfo.snapshotPath(screenshotName)
  await fsPromises.mkdir(path.dirname(screenshotPath), { recursive: true })
  await fsPromises.writeFile(screenshotPath, screenshotBuffer)

  return screenshotBuffer
}

/** Wraps all H1 sections in spans, taking the locator or page object as the base. */
export async function wrapH1SectionsInSpans(locator: Locator | Page): Promise<void> {
  const evaluateFunc = () => {
    // Collect direct-child H1s and footnote sections as split boundaries (in DOM order)
    const boundaries = Array.from(
      document.querySelectorAll("article > h1, article > section[data-footnotes]"),
    )

    for (const boundary of boundaries) {
      const parent = boundary.parentElement

      if (!parent) continue

      // If the parent is already a span we've created, skip it
      if (parent.tagName === "SPAN" && parent.id.startsWith("h1-span-")) {
        continue
      }

      const span = document.createElement("span")
      const id = boundary.id || boundary.querySelector("h1")?.id
      if (!id) {
        throw new Error("Header has no id")
      }
      span.id = `h1-span-${id}`

      parent.insertBefore(span, boundary)

      span.appendChild(boundary)

      // Move all subsequent siblings into the span until we hit the next boundary
      let nextSibling = span.nextSibling
      while (nextSibling && boundaries.indexOf(nextSibling as Element) === -1) {
        const toMove = nextSibling
        nextSibling = toMove.nextSibling
        span.appendChild(toMove)
      }
    }
  }

  if ("locator" in locator) {
    await (locator as Locator).evaluate(evaluateFunc)
  } else {
    await (locator as Page).evaluate(evaluateFunc)
  }
}

/**
 * Get screenshots of all h1s in a container
 * @param page - The page to get the h1s from
 * @param testInfo - The test info
 * @param location - The location to get the h1s from
 * @param theme - The theme to get the screenshots for
 */
export async function getH1Screenshots(
  page: Page,
  testInfo: TestInfo,
  location: Locator | null,
  theme: "dark" | "light",
) {
  const screenshotBase = location ?? page
  await wrapH1SectionsInSpans(screenshotBase)

  const h1Spans = await screenshotBase.locator("span[id^='h1-span-']").all()

  // Pause all media once upfront so individual screenshots can skip it.
  // This avoids paying the per-element fallback timeout N times in the loop.
  await pauseMediaElements(page)

  for (const h1Span of h1Spans) {
    // Use JS scrollIntoView instead of Playwright's scrollIntoViewIfNeeded,
    // which can time out in WebKit when the element never becomes "stable".
    await h1Span.evaluate((el) => el.scrollIntoView({ block: "center" }))

    const h1Header = h1Span.locator("h1").first()
    const h1Id = await h1Header.getAttribute("id")
    const sanitizedH1Id = h1Id ? sanitize(h1Id) : null
    if (!sanitizedH1Id) throw new Error("H1 header has no id")

    await takeRegressionScreenshot(page, testInfo, `h1-span-${theme}-${sanitizedH1Id}`, {
      elementToScreenshot: h1Span,
      skipMediaPause: true,
    })
  }
}

/**
 * Returns the next element matching the selector that is below the current element.
 * @param element - The current element.
 * @param selector - The selector to match.
 * @returns The next element matching the selector that is below the current element.
 */
export async function getNextElementMatchingSelector(
  element: Locator,
  selector: string,
): Promise<Locator> {
  const box = await element.boundingBox()
  if (!box) throw new Error("Element not found")

  const page = element.page()
  const elements = await page.locator(selector).all()

  // Find the first element that appears after our current element
  for (const element of elements) {
    const currentBox = await element.boundingBox()

    if (currentBox && currentBox.y > box.y) {
      return element
    }
  }

  throw new Error("No next element found")
}

/** Open the search UI by clicking the search icon.
 *
 *  Waits for search event handlers to be fully registered (signalled by
 *  `onNav` in search.ts setting `window.__searchHandlersReady`) before
 *  clicking, avoiding the race where the click handler isn't attached yet
 *  after SPA navigation.
 *
 *  The click itself can still race with DOM updates (e.g. the SPA morphing
 *  the page after goBack), so if the first click doesn't activate search
 *  within 3 s we retry once. This is bounded to exactly 2 attempts — not a
 *  polling loop. */
export async function openSearch(page: Page) {
  // After SPA navigation (e.g. goBack), onNav() re-registers all search
  // event handlers asynchronously. Wait for the flag it sets at completion.
  await page.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).__searchHandlersReady === true,
    null,
    { timeout: 15_000 },
  )

  const searchContainer = page.locator("#search-container")
  const searchBar = page.locator("#search-bar")

  // Click the search icon if search isn't already open. If the first click
  // doesn't activate search (e.g. DOM morphed between click and class check),
  // retry once — bounded to exactly 2 attempts.
  if (!(await searchBar.isVisible())) {
    await page.locator("#search-icon").click()
  }
  const isActive = await searchContainer.evaluate((el) => el.classList.contains("active"))
  if (!isActive) {
    // Retry: re-click in case the first was swallowed by a DOM update
    await page.locator("#search-icon").click()
  }
  await expect(searchContainer).toHaveClass(/active/, { timeout: 5_000 })
  await expect(searchBar).toBeVisible({ timeout: 5_000 })
}

export async function waitForSearchBar(page: Page): Promise<Locator> {
  // Ensure search is open (re-opens if DOM was reset by SPA navigation)
  await openSearch(page)

  const searchBar = page.locator("#search-bar")
  await expect(searchBar).toBeEnabled()
  return searchBar
}

// NOTE: Assumes search is opened
// skipcq: JS-0098
export async function search(page: Page, term: string) {
  const searchBar = await waitForSearchBar(page)
  const searchLayout = page.locator("#search-layout")

  // Wait for the search index to load before filling (avoids resetting
  // the 400ms debounce timer with repeated fill() retries).
  await page.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (window as any).__searchIndexReady === true,
    null,
    { timeout: 30_000 },
  )

  // If results are already displayed from a previous search, clear them
  // directly via the DOM. We can't rely on the app's debounced input handler
  // because it creates a "No results" .result-card element even for empty
  // queries, so waiting for .result-card to detach would never succeed.
  const hasExistingResults = (await page.locator(".result-card").count()) > 0
  if (hasExistingResults) {
    await page.evaluate(() => {
      const results = document.getElementById("results-container")
      if (results) results.innerHTML = ""
      const layout = document.getElementById("search-layout")
      layout?.classList.remove("display-results")
    })
  }

  await searchBar.fill(term)
  // Explicitly dispatch input event — Playwright's fill() should do this,
  // but Firefox and WebKit on tablet viewports sometimes fail to trigger the handler.
  await searchBar.dispatchEvent("input")
  await expect(searchLayout).toBeVisible({ timeout: 15_000 })
  await expect(searchLayout).toHaveClass(/display-results/, { timeout: 15_000 })

  // Wait for result cards to render. On mobile viewports #results-container
  // has height:auto and is invisible while empty, so wait for the cards
  // directly rather than checking the container first.
  await expect(page.locator(".result-card").first()).toBeVisible({ timeout: 15_000 })
}

// skipcq: JS-0098
export async function pauseMediaElements(page: Page, scope?: Locator): Promise<void> {
  const mediaScope = scope ?? page

  const pauseMedia = async (
    selector: "video" | "audio",
    seekTo: "start" | "end",
  ): Promise<void> => {
    const elements = await mediaScope.locator(selector).all()
    const promises = elements.map((el) =>
      el.evaluate((media: HTMLVideoElement | HTMLAudioElement, target: "start" | "end") => {
        media.pause()

        // Seek to target time, wait for "seeked" event, then wait for a double
        // requestAnimationFrame to ensure the compositor has actually painted
        // the target frame (Safari fires "seeked" before the frame is rendered).
        const seekAndWait = (time: number): Promise<void> => {
          media.currentTime = time
          return Promise.race([
            new Promise<void>((resolve) => {
              media.addEventListener(
                "seeked",
                () => {
                  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
                },
                { once: true },
              )
            }),
            new Promise<void>((resolve) => setTimeout(resolve, 1000)),
          ])
        }

        const targetTime = target === "start" ? 0 : media.duration

        // Per HTML spec: when readyState is HAVE_NOTHING (0), setting currentTime updates
        // an internal "default playback start position" but doesn't perform an actual seek.
        // We need readyState >= HAVE_METADATA (1) for currentTime assignment to take effect.
        // See: https://html.spec.whatwg.org/multipage/media.html#dom-media-currenttime
        if (Number.isFinite(targetTime) && media.readyState >= 1) {
          return seekAndWait(targetTime)
        }

        // Wait for metadata with timeout fallback
        return Promise.race([
          new Promise<void>((resolve) => {
            media.addEventListener(
              "loadedmetadata",
              () => {
                const time = target === "start" ? 0 : media.duration
                if (Number.isFinite(time)) {
                  seekAndWait(time).then(resolve)
                } else {
                  resolve()
                }
              },
              { once: true },
            )
            // Should only happen in Safari test
            if (media.readyState < 1) {
              media.load()
              console.warn("Media readyState < 1, loading")
            }
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 1000)),
        ])
      }, seekTo),
    )
    await Promise.all(promises)
  }

  await Promise.all([pauseMedia("video", "start"), pauseMedia("audio", "end")])

  // Remove the autoplay attribute so the Safari autoplay script
  // (safari-autoplay.js) won't restart videos on user-interaction events.
  // Use elementHandle to avoid Locator auto-waiting: in search previews,
  // video elements may become detached during re-renders, causing
  // locator.evaluate() to hang indefinitely (no timeout).
  for (const video of await mediaScope.locator("video[autoplay]").all()) {
    const handle = await video.elementHandle({ timeout: 2000 }).catch(() => null)
    if (handle) {
      await handle.evaluate((el) => el.removeAttribute("autoplay"))
      await handle.dispose()
    }
  }
}

/**
 * Waits for all transitions to complete before resolving. If no transitions are defined, it resolves immediately.
 * @param element - The element to wait for transitions on
 * @returns A promise that resolves when all transitions have completed
 */
export async function waitForTransitionEnd(element: Locator): Promise<void> {
  await element.evaluate((el: Element) => {
    const computedStyle = window.getComputedStyle(el)
    const transitionDurationValue = computedStyle.transitionDuration

    // If no transitionDuration is set or empty, resolve immediately
    if (!transitionDurationValue || transitionDurationValue.trim() === "") {
      return Promise.resolve()
    }

    // Parse individual durations and convert to milliseconds
    const durations = transitionDurationValue.split(",").map((d) => d.trim())
    const parsedDurations = durations.map((d) => {
      if (d.endsWith("ms")) return parseFloat(d)
      if (d.endsWith("s")) return parseFloat(d) * 1000
      return 0
    })

    // If all durations are 0, resolve immediately
    if (parsedDurations.every((d) => d === 0)) {
      return Promise.resolve()
    }

    // Wait for all transitionend events
    return new Promise<void>((resolve) => {
      const properties = computedStyle.transitionProperty.split(",").map((p) => p.trim())
      let pendingTransitions = properties.length

      const onTransitionEnd = (): void => {
        pendingTransitions--
        if (pendingTransitions <= 0) {
          el.removeEventListener("transitionend", onTransitionEnd)
          resolve()
        }
      }

      el.addEventListener("transitionend", onTransitionEnd)

      // Fallback timeout in case transitionend doesn't fire
      setTimeout(() => {
        el.removeEventListener("transitionend", onTransitionEnd)
        resolve()
        console.warn("Transition end not detected")
      }, 5000)
    })
  })
}

// skipcq: JS-0098
export async function gotoPage(
  page: Page,
  url: string,
  loadState: Parameters<Page["waitForLoadState"]>[0] = "load",
): Promise<void> {
  // Pass the caller's loadState directly as waitUntil so Playwright manages
  // the full navigation lifecycle in one call.  The previous approach used
  // waitUntil:"commit" (resolves when the server starts sending bytes) then a
  // separate waitForLoadState(), but WebKit/Safari can destroy the execution
  // context between those two steps, causing "Execution context was destroyed"
  // errors on page.evaluate / page.waitForFunction calls.
  try {
    await page.goto(url, { waitUntil: loadState })
  } catch (error: unknown) {
    // WebKit on Linux occasionally crashes with "internal error" on page.goto.
    // Retry once — the second attempt typically succeeds.
    if (error instanceof Error && error.message.includes("internal error")) {
      console.warn(`[gotoPage] WebKit internal error navigating to ${url}, retrying once`)
      await page.goto(url, { waitUntil: loadState })
    } else {
      throw error
    }
  }

  // Wait for the SPA router to finish initializing so a late client-side
  // navigation doesn't destroy the execution context before callers can
  // run page.evaluate() (Safari/WebKit is especially prone to this).
  await page.waitForFunction(() => window.__routerInitialized === true)
}

/** Reload the current page by navigating away and back to the original URL.
 *  Avoids page.reload() which can trigger "WebKit encountered an internal
 *  error" crashes in the Safari driver.  A same-URL goto() in Safari/WebKit
 *  may be treated as a soft refresh that skips re-running init scripts, so we
 *  bounce through a minimal same-origin page first to force a full page load.
 *  Using a same-origin page (not about:blank) preserves sessionStorage, and
 *  returning empty HTML avoids loading the SPA framework which could intercept
 *  the subsequent navigation. */
export async function reloadPage(
  page: Page,
  loadState: Parameters<Page["waitForLoadState"]>[0] = "load",
): Promise<void> {
  const url = new URL(page.url())
  // Serve a minimal same-origin page: preserves sessionStorage, no SPA interference
  const bounceUrl = `${url.origin}/__reload_bounce__`
  await page.route(bounceUrl, (route) =>
    route.fulfill({ body: "<html></html>", contentType: "text/html" }),
  )
  await page.goto(bounceUrl, { waitUntil: "commit" })
  await page.unroute(bounceUrl)
  await gotoPage(page, url.href, loadState)
}

// skipcq: JS-0098
export function isDesktopViewport(page: Page): boolean {
  const viewportSize = page.viewportSize()
  return viewportSize ? viewportSize.width >= minDesktopWidth : false
}

// Detect if the current test is running in Firefox
export function isFirefox(testInfo: TestInfo): boolean {
  return testInfo.project.name.toLowerCase().includes("firefox")
}

// Detect if the current test is running in Safari/WebKit
export function isSafariBrowser(page: Page): boolean {
  return page.context().browser()?.browserType().name() === "webkit"
}

/**
 * Move the mouse to a position guaranteed not to overlap any UI elements.
 * Using (0, 0) can overlap with navbar/menu on certain viewports (especially
 * iPad Pro), triggering spurious mouseenter events that interfere with tests.
 */
export async function moveMouseToSafePosition(page: Page): Promise<void> {
  const viewport = page.viewportSize()
  // Bottom-right corner is safe: no navbar, no sidebar, no popovers
  const x = viewport ? viewport.width - 1 : 1200
  const y = viewport ? viewport.height - 1 : 800
  await page.mouse.move(x, y)
}

/**
 * Trigger an action and wait for the SPA to complete navigation.
 *
 * The SPA dispatches a custom `"nav"` event after fetch → DOM morph →
 * scroll/search-highlight are all finished.  `page.waitForURL` resolves
 * as soon as `pushState` fires — long before the DOM is ready — so tests
 * that need post-navigation DOM state must use this helper instead.
 *
 * If the SPA's fetch times out or fails, it falls back to a full page
 * navigation (`window.location.href = ...`) without dispatching "nav".
 * In that case the `page.evaluate` promise is rejected (execution context
 * destroyed), so we catch that and wait for the new page to finish loading.
 */
export async function triggerAndWaitForSPANav(
  page: Page,
  trigger: () => Promise<unknown>,
): Promise<void> {
  // Start listening *before* the action so we never miss the event.
  // page.evaluate returns a Promise that resolves when the browser-side Promise resolves.
  const navPromise = page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        document.addEventListener("nav", () => resolve(), { once: true }),
      ),
  )

  await trigger()
  try {
    await navPromise
  } catch {
    // Execution context was destroyed — the SPA fell back to a full page
    // navigation. Wait for the new page to finish loading.
    await page.waitForLoadState("load")
  }
}
