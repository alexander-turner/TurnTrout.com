import type { Page, Request } from "playwright"

import { expect, type Locator, type TestInfo } from "@playwright/test"
import { appendFileSync, mkdirSync } from "fs"
import { join } from "path"
import sanitize from "sanitize-filename"

import { minDesktopWidth } from "../../styles/variables"
import { findGitRoot } from "../../util/log"
import { forceHslInvertClass, invertInDarkModeClass, savedThemeKey } from "../constants"
import { type Theme } from "../scripts/darkmode"

// How often `page.waitForFunction` predicates re-evaluate. Polling must stay
// paint-independent: headless WebKit can leave a page unpainted, and a page
// that composites no frames never fires `requestAnimationFrame`, so a
// rAF-polled predicate (Playwright's default) is evaluated zero times. Timer
// polls run regardless of paint activity. Enforced by the
// `no-restricted-syntax` waitForFunction rule in the eslint config.
export const WAIT_POLL_INTERVAL_MS = 100

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

const ISOLATION_STYLE_ID = "__dom-isolation-style"
const ISOLATION_ATTR = "data-dom-isolate"
const ISOLATION_PARENT_ATTR = "data-dom-isolate-parent"

const MAX_DIFF_PIXEL_RATIO = 0.002
// Absolute floor of allowed differing pixels. Playwright compares with
// min(maxDiffPixels, area * maxDiffPixelRatio), so a single computed
// maxDiffPixels = max(floor, ceil(area * ratio)) yields a true floor: it only
// relaxes very small isolated sections (a handful of antialiasing pixels) and
// never masks structural diffs, which run to thousands of pixels.
const MIN_DIFF_PIXELS = 100

async function performDOMIsolation(
  elementLocator: Locator,
  preserveSiblings: boolean,
): Promise<void> {
  await elementLocator.evaluate(
    (targetElement, { preserveSiblings, attr, parentAttr, styleId }) => {
      targetElement.setAttribute(attr, "")

      if (preserveSiblings && targetElement.parentElement) {
        targetElement.parentElement.setAttribute(parentAttr, "")
      }

      let selector = `body *:not(:has([${attr}])):not([${attr}]):not([${attr}] *)`

      if (preserveSiblings) {
        selector += `:not([${parentAttr}] > *):not([${parentAttr}] > * *)`
      }

      const style = document.createElement("style")
      style.id = styleId
      style.textContent = `${selector} { display: none !important; }`
      document.head.appendChild(style)
    },
    {
      preserveSiblings,
      attr: ISOLATION_ATTR,
      parentAttr: ISOLATION_PARENT_ATTR,
      styleId: ISOLATION_STYLE_ID,
    },
  )
}

async function restoreDOMFromIsolation(page: Page): Promise<void> {
  await page.evaluate(
    ({ styleId, attr, parentAttr }) => {
      document.getElementById(styleId)?.remove()
      document.querySelector(`[${attr}]`)?.removeAttribute(attr)
      document.querySelector(`[${parentAttr}]`)?.removeAttribute(parentAttr)
    },
    {
      styleId: ISOLATION_STYLE_ID,
      attr: ISOLATION_ATTR,
      parentAttr: ISOLATION_PARENT_ATTR,
    },
  )
}

export interface RegressionScreenshotOptions {
  elementToScreenshot?: Locator
  elementAboutWhichToIsolateDOM?: Locator // elementToScreenshot by default
  clip?: { x: number; y: number; width: number; height: number }
  disableHover?: boolean
  skipMediaPause?: boolean
  skipStabilityWait?: boolean
  preserveSiblings?: boolean
}

// Generous per-image ceiling: long enough to absorb a couple of reload retries
// of a remote AVIF, short enough that a genuinely dead image can't hang the run.
const IMAGE_PAINT_TIMEOUT_MS = 15000

// gotoPage gates navigation on "domcontentloaded", which returns control to
// the test before a <video>'s own network fetch has had any wall-clock time
// to progress. This budget must cover that full remote-asset fetch on its
// own, so it matches IMAGE_PAINT_TIMEOUT_MS's generosity for the same reason.
const VIDEO_PAINT_TIMEOUT_MS = 15000

// WebKit's `document.fonts.ready` can hang indefinitely when a `@font-face`
// request never settles, burning the whole test timeout. Bound the wait: the
// two-equal-frames `captureStableScreenshot` loop is the real guarantee that
// fonts have painted, so a late swap still shows up as a frame difference.
const FONTS_READY_TIMEOUT_MS = 10000

// WebKit paints images above its interpolation cutoff (800×800 source pixels)
// with fast low-quality scaling whenever their painted size just changed
// (e.g. a custom element upgrading and re-laying-out its slotted images), then
// repaints at high quality when its 500 ms `lowQualityTimeThreshold` timer
// fires (WebCore/rendering/ImageQualityController.cpp). Consecutive captures
// must be spaced wider than that window so a pending high-quality repaint
// always lands between them and shows up as a frame difference.
const WEBKIT_LOW_QUALITY_SCALE_WINDOW_MS = 550
const SCREENSHOT_STABILIZATION_TIMEOUT_MS = 10_000

/**
 * Captures screenshots until two consecutive frames are byte-identical, so
 * late async repaints (WebKit's deferred high-quality image rescale, font
 * swaps) can't be baked into the compared capture. This is the same
 * two-equal-frames contract Playwright's `toHaveScreenshot` applies
 * internally; `toMatchSnapshot` on a raw buffer has no such loop, so we
 * provide it here.
 *
 * @param takeScreenshot - Thunk performing one capture of the target.
 * @param screenshotName - Name used in the timeout error message.
 * @returns The first capture that matched its predecessor exactly.
 */
export async function captureStableScreenshot(
  takeScreenshot: () => Promise<Buffer>,
  screenshotName: string,
): Promise<Buffer> {
  const deadline = Date.now() + SCREENSHOT_STABILIZATION_TIMEOUT_MS
  let previous = await takeScreenshot()
  do {
    await new Promise((resolve) => setTimeout(resolve, WEBKIT_LOW_QUALITY_SCALE_WINDOW_MS))
    const current = await takeScreenshot()
    if (current.equals(previous)) return current
    previous = current
  } while (Date.now() < deadline)
  throw new Error(
    `Screenshot ${screenshotName} did not stabilize within ${SCREENSHOT_STABILIZATION_TIMEOUT_MS}ms: consecutive captures kept differing, so something is still repainting the page`,
  )
}

// Images the InvertInDarkMode transformer wrapped in a `<picture>` with a
// precomputed `-inverted` sibling. `accurateInvert` swaps their src when
// `data-theme` flips, so "painted" for them means painted with the variant
// matching the active theme.
const THEME_SWAPPED_IMAGE_SELECTOR = `picture > img.${invertInDarkModeClass}:not(.${forceHslInvertClass})`

// Runs in the browser via `locator.evaluate` (Playwright serializes it), so it
// must not reference module scope. Resolves true once the image has painted,
// false at the deadline. A remote AVIF can intermittently fail to load
// (notably Firefox in CI), so failed loads are retried until the deadline. The
// loop POLLS instead of listening to load/error events: a reload fired from a
// stale event timer changes `src` while a decode() is pending, which rejects
// it and (on Firefox, where naturalWidth resets during the new request)
// re-triggers reload forever.
/* istanbul ignore next -- executed in the browser, not under Jest */
function pollUntilImagePaints(
  el: HTMLImageElement,
  { deadlineMs, swapSelector }: { deadlineMs: number; swapSelector: string },
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    // WebKit only starts a lazy image's request when it nears the viewport, so
    // a below-fold `loading="lazy"` image would sit unloaded until the
    // deadline. Promote it to eager for the wait.
    if (el.loading === "lazy") {
      el.loading = "eager"
    }
    const POLL_MS = 100
    const RELOAD_DEBOUNCE_MS = 250
    const startedAt = performance.now()
    let lastReloadAt = -RELOAD_DEBOUNCE_MS
    const settle = (): void => resolve(true)
    // A theme-swapped image counts as painted only once its stem agrees with
    // the active `data-theme` (stem check mirrors `isInvertedUrl` in
    // invertedAssets.ts).
    const variantMatchesTheme = (): boolean => {
      if (!el.matches(swapSelector)) {
        return true
      }
      const path = (el.currentSrc || el.src).split(/[?#]/)[0]
      const dot = path.lastIndexOf(".")
      const stem = dot < 0 ? path : path.slice(0, dot)
      const dark = document.documentElement.getAttribute("data-theme") === "dark"
      return stem.endsWith("-inverted") === dark
    }
    const tick = (): void => {
      if (performance.now() - startedAt >= deadlineMs) {
        resolve(false)
        return
      }
      const now = performance.now()
      if (el.complete && el.naturalWidth > 0) {
        if (variantMatchesTheme()) {
          // Loaded. decode() flushes the bitmap so the paint is ready; WebKit
          // spuriously rejects decode() for painted SVGs, so a rejection still
          // settles.
          el.decode().then(settle, settle)
          return
        }
        // Variant mismatch on a healthy image: fall through to the next poll
        // tick; the error-reload below is only for zero-dimension loads.
      } else if (el.complete && now - lastReloadAt >= RELOAD_DEBOUNCE_MS) {
        // Errored (complete with no dimensions): retry with a cache-busted
        // fetch. `set` overwrites the prior value, so retries don't
        // accumulate query params.
        lastReloadAt = now
        const url = new URL(el.currentSrc || el.src, document.baseURI)
        url.searchParams.set("__visualRetry", String(Math.trunc(now)))
        el.src = url.toString()
      }
      window.setTimeout(tick, POLL_MS)
    }
    tick()
  })
}

export async function waitForImagesInElement(
  scope: Locator,
  timeoutMs: number = IMAGE_PAINT_TIMEOUT_MS,
): Promise<void> {
  const images = await scope.locator("img").all()
  await Promise.all(
    images.map(async (img) => {
      const painted = await img.evaluate(pollUntilImagePaints, {
        deadlineMs: timeoutMs,
        swapSelector: THEME_SWAPPED_IMAGE_SELECTOR,
      })
      // Screenshotting an unpainted image bakes its alt text into the capture,
      // which either churns the diff gallery or — if approved — corrupts the
      // baseline. Fail the test instead; a real failure surfaces on the shard.
      if (!painted) {
        const src = (await img.getAttribute("src")) ?? "<unknown src>"
        throw new Error(`Image did not paint within ${timeoutMs}ms despite retries: ${src}`)
      }
    }),
  )
}

async function waitForVisualStability(page: Page, scope?: Locator): Promise<void> {
  await page.evaluate(async (timeoutMs) => {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ])
  }, FONTS_READY_TIMEOUT_MS)
  if (scope) {
    await waitForImagesInElement(scope)
  } else {
    await page.waitForLoadState("load")
  }
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

// WebKit paints a freshly loaded or resized large image with fast
// low-quality interpolation, then upgrades the paint when a 500 ms timer
// fires (ImageQualityController::lowQualityTimeThreshold). On a contended
// CI runner that timer can starve past consecutive stable frames, so the
// capture holds a stable-but-low-quality paint that diffs ~1% against the
// baseline. `image-rendering: optimizeQuality` maps to
// InterpolationQuality::Default before the timer heuristic runs, so every
// capture paints at final quality.
async function forceHighQualityImageInterpolation(page: Page): Promise<void> {
  await page.evaluate(() => {
    const styleId = "force-high-quality-image-interpolation"
    if (document.getElementById(styleId)) return
    const style = document.createElement("style")
    style.id = styleId
    style.textContent = "img { image-rendering: optimizeQuality; }"
    document.head.append(style)
  })
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
  await forceHighQualityImageInterpolation(page)
  if (!options?.skipMediaPause) {
    await pauseMediaElements(page, options?.elementToScreenshot)
    await waitForVideosPainted(options?.elementToScreenshot ?? page)
  }

  // Separate out the element option so we don't pass it to the screenshot API
  const { elementToScreenshot, ...remainingOptions } = options ?? {}

  if (!options?.skipStabilityWait) {
    await waitForVisualStability(page, options?.elementToScreenshot)
  }

  const screenshotOptions = {
    animations: "disabled" as const,
    // Use CSS pixel scaling to eliminate deviceScaleFactor/DPR-induced subpixel jitter
    scale: "css" as const,
    ...remainingOptions,
  }

  let screenshotBuffer: Buffer
  const screenshotName = getScreenshotName(testInfo, screenshotSuffix)
  if (elementToScreenshot) {
    const elementToIsolate = options?.elementAboutWhichToIsolateDOM ?? elementToScreenshot
    await performDOMIsolation(elementToIsolate, options?.preserveSiblings ?? false)

    try {
      screenshotBuffer = await captureStableScreenshot(
        () => elementToScreenshot.screenshot(screenshotOptions),
        screenshotName,
      )
    } finally {
      await restoreDOMFromIsolation(page)
    }
  } else {
    screenshotBuffer = await captureStableScreenshot(
      () => page.screenshot(screenshotOptions),
      screenshotName,
    )
  }

  // PNG IHDR stores width at byte offset 16 and height at 20. Using the
  // captured buffer's own dimensions matches the area Playwright applies the
  // ratio to (expected.width * expected.height when dimensions agree).
  const pngWidth = screenshotBuffer.readUInt32BE(16)
  const pngHeight = screenshotBuffer.readUInt32BE(20)
  const maxDiffPixels = Math.max(
    MIN_DIFF_PIXELS,
    Math.ceil(pngWidth * pngHeight * MAX_DIFF_PIXEL_RATIO),
  )

  // Array form skips Playwright's 60-char hash-truncation of the
  // attachment name, so approve-baselines can map attachments back to
  // baseline filenames for any name length.
  await expect
    .soft(screenshotBuffer, { message: screenshotName })
    .toMatchSnapshot([screenshotName], { maxDiffPixels })

  return screenshotBuffer
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
  await page.waitForFunction(() => window.__searchHandlersReady === true, null, {
    timeout: 15_000,
    polling: WAIT_POLL_INTERVAL_MS,
  })

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
  await waitForSearchBar(page)
  const searchLayout = page.locator("#search-layout")

  // Wait for the search index to load before filling (avoids resetting
  // the 400ms debounce timer with repeated fill() retries).
  await page.waitForFunction(() => window.__searchIndexReady === true, null, {
    timeout: 30_000,
    polling: WAIT_POLL_INTERVAL_MS,
  })

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

  // Set the search value and trigger the handler directly in the browser
  // context. Playwright's fill() on mobile WebKit can generate tap events
  // that inadvertently close the search overlay, and its dispatchEvent()
  // creates a basic Event rather than InputEvent. Setting the value and
  // dispatching InputEvent via evaluate is reliable across all browsers.
  await page.evaluate((searchTerm: string) => {
    const bar = document.getElementById("search-bar") as HTMLInputElement
    bar.focus()
    bar.value = searchTerm
    bar.dispatchEvent(new InputEvent("input", { bubbles: true }))
  }, term)
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
                  // skipcq: JS-0098 — fire-and-forget; void marks the intentionally floating promise
                  void seekAndWait(time).then(resolve)
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
 * Blocks until every video has actually painted its frame-0 to the compositor.
 *
 * `pauseMediaElements` seeks videos to currentTime 0, but `paused`/`currentTime
 * === 0` are satisfied even when the engine (notably WebKit) has presented no
 * frame yet. Screenshotting that blank, never-painted state diffs against the
 * painted baseline — the source of the flake. requestVideoFrameCallback fires
 * only on a real paint, which is the signal we actually need.
 */
async function waitForVideosPainted(scope: Page | Locator): Promise<void> {
  for (const video of await scope.locator("video").all()) {
    const handle = await video.elementHandle()
    if (!handle) throw new Error("Could not get element handle for video")
    await handle.evaluate(
      (el, dataTimeoutMs) =>
        new Promise<void>((resolve) => {
          const videoEl = el as HTMLVideoElement & {
            requestVideoFrameCallback?: (cb: () => void) => number
          }
          const timers: ReturnType<typeof setTimeout>[] = []
          let settled = false
          const finish = () => {
            if (settled) return
            settled = true
            timers.forEach(clearTimeout)
            resolve()
          }
          const waitForPaint = () => {
            videoEl.pause()
            if (videoEl.currentTime !== 0) videoEl.currentTime = 0
            if (typeof videoEl.requestVideoFrameCallback !== "function") {
              finish()
              return
            }
            videoEl.requestVideoFrameCallback(finish)
            // Fallback for the case where frame 0 is already on screen: no new
            // frame is presented, so rVFC would never fire.
            timers.push(setTimeout(finish, 1500))
          }
          if (videoEl.readyState >= 2) {
            // HAVE_CURRENT_DATA or better: a frame is decodable now.
            waitForPaint()
          } else {
            videoEl.addEventListener("loadeddata", waitForPaint, { once: true })
            // Mirror pauseMediaElements: only force a reload when there is no
            // data at all; for HAVE_METADATA the decode is already in flight.
            if (videoEl.readyState === 0) videoEl.load()
          }
          // Never hang on a video whose data never arrives (e.g. a broken
          // source); let the screenshot proceed and fail on its own terms.
          timers.push(setTimeout(finish, dataTimeoutMs))
        }),
      VIDEO_PAINT_TIMEOUT_MS,
    )
    await handle.dispose()
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
  // Gate navigation on `domcontentloaded`, not `load`: every page embeds the
  // navbar pond video (`preload="auto"`, looping), whose continuous range
  // requests keep WebKit's `load` event pending indefinitely, so a
  // `waitUntil:"load"` goto stalls until navigationTimeout even though the
  // server has already served every byte. The parsed DOM is a reliable gate
  // because callers assert on concrete elements (and run their own media/font
  // stability waits) after navigating. Callers that genuinely need every
  // subresource loaded pass "load" explicitly.
  loadState: Parameters<Page["waitForLoadState"]>[0] = "domcontentloaded",
): Promise<void> {
  // Pass the caller's loadState directly as waitUntil so Playwright manages
  // the full navigation lifecycle in one call.  The previous approach used
  // waitUntil:"commit" (resolves when the server starts sending bytes) then a
  // separate waitForLoadState(), but WebKit/Safari can destroy the execution
  // context between those two steps, causing "Execution context was destroyed"
  // errors on page.evaluate / page.waitForFunction calls.
  // Collect failed sub-resource fetches during this navigation and append
  // them to .logs/gotoPage-failed-requests.log so the CI logs artifact
  // names the failing URL without flooding stdout.
  const failedRequests: Array<{ url: string; reason: string }> = []
  const onRequestFailed = (req: Request): void => {
    failedRequests.push({ url: req.url(), reason: req.failure()?.errorText ?? "unknown" })
  }
  page.on("requestfailed", onRequestFailed)

  try {
    await page.goto(url, { waitUntil: loadState })
  } catch (error: unknown) {
    // WebKit's page.goto can crash with "internal error" or stall past the
    // config's navigationTimeout. Both are one-off browser faults: retry the
    // navigation once — the second attempt typically succeeds.
    const isRetryable =
      error instanceof Error &&
      (error.message.includes("internal error") || error.message.includes("Timeout"))
    if (isRetryable) {
      console.warn(`[gotoPage] navigation to ${url} failed, retrying once: ${error.message}`)
      await page.goto(url, { waitUntil: loadState })
    } else {
      throw error
    }
  } finally {
    page.off("requestfailed", onRequestFailed)
  }

  if (failedRequests.length > 0) {
    logFailedRequests(url, failedRequests)
  }
}

const failedRequestsLogPath = join(findGitRoot(), ".logs", "gotoPage-failed-requests.log")
let failedRequestsLogDirEnsured = false

function logFailedRequests(url: string, failures: Array<{ url: string; reason: string }>): void {
  if (!failedRequestsLogDirEnsured) {
    mkdirSync(join(findGitRoot(), ".logs"), { recursive: true })
    failedRequestsLogDirEnsured = true
  }
  const lines = [
    `[${new Date().toISOString()}] ${failures.length} failed request(s) during navigation to ${url}:`,
    ...failures.map(({ url: failedUrl, reason }) => `  - ${reason}: ${failedUrl}`),
    "",
  ]
  appendFileSync(failedRequestsLogPath, lines.join("\n"))
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
  // Defaults to "domcontentloaded" for the same reason as gotoPage: the
  // autoplaying looping navbar video keeps WebKit's `load` event from firing.
  loadState: Parameters<Page["waitForLoadState"]>[0] = "domcontentloaded",
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
