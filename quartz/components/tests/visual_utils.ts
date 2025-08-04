import { type Locator, type TestInfo, expect } from "@playwright/test"
import { type Page } from "playwright"
import sanitize from "sanitize-filename"

import { tabletBreakpoint, minDesktopWidth } from "../../styles/variables"
import { type Theme } from "../scripts/darkmode"

// TODO check if this is needed
export async function waitForThemeTransition(page: Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      // If no transition is needed (theme didn't change), resolve immediately
      const computedBg = getComputedStyle(document.body).backgroundColor
      requestAnimationFrame(() => {
        // Check if background color changed in the next frame
        if (getComputedStyle(document.body).backgroundColor === computedBg) {
          resolve()
          return
        }

        document.documentElement.classList.add("temporary-transition")

        // Listen for the transition end on body background-color
        const onTransitionEnd = (e: TransitionEvent) => {
          if (e.propertyName === "background-color") {
            document.body.removeEventListener("transitionend", onTransitionEnd)
            document.documentElement.classList.remove("temporary-transition")
            resolve()
          }
        }

        document.body.addEventListener("transitionend", onTransitionEnd)
      })
    })
  })
}

export async function setTheme(page: Page, theme: Theme) {
  await page.evaluate((t) => {
    localStorage.setItem("saved-theme", t)

    const themeLabel = document.querySelector("#theme-label") as HTMLElement
    if (themeLabel) {
      themeLabel.textContent = t.charAt(0).toUpperCase() + t.slice(1)
    }

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
  }, theme)

  await waitForThemeTransition(page)
}

export interface RegressionScreenshotOptions {
  elementToScreenshot?: Locator
  elementAboutWhichToIsolateDOM?: Locator // elementToScreenshot by default
  clip?: { x: number; y: number; width: number; height: number }
  disableHover?: boolean
  skipMediaPause?: boolean
}

export function getScreenshotName(testInfo: TestInfo, screenshotSuffix: string) {
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

async function performDOMIsolation(elementLocator: Locator): Promise<void> {
  await elementLocator.evaluate((targetElement) => {
    const elementsToKeep = new Set<Element>()

    // Add target element and all its descendants
    elementsToKeep.add(targetElement)
    const descendants = targetElement.querySelectorAll("*")
    descendants.forEach((descendant) => elementsToKeep.add(descendant))

    // Preserve siblings of the target element (and their descendants) to maintain local layout context
    if (targetElement.parentElement) {
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
  })
}

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

export async function takeRegressionScreenshot(
  page: Page,
  testInfo: TestInfo,
  screenshotSuffix: string,
  options?: RegressionScreenshotOptions,
): Promise<Buffer> {
  if (!options?.skipMediaPause) {
    await pauseMediaElements(page)
  }

  // Separate out the element option so we don't pass it to the screenshot API
  const { elementToScreenshot: _elementOpt, ...remainingOptions } = options ?? {}
  void _elementOpt // prevent unused variable lint error

  const screenshotOptions = {
    animations: "disabled" as const,
    ...remainingOptions,
  }

  let screenshotBuffer: Buffer
  const screenshotName = getScreenshotName(testInfo, screenshotSuffix)
  if (options?.elementToScreenshot) {
    // Temporarily isolate element to prevent position shifts from unrelated content changes
    const elementToIsolate = options.elementAboutWhichToIsolateDOM ?? options.elementToScreenshot
    await performDOMIsolation(elementToIsolate)
    const restoreDOM = async () => {
      await restoreDOMFromIsolation(page)
    }

    try {
      await expect(options.elementToScreenshot).toHaveScreenshot(screenshotName, screenshotOptions)
      screenshotBuffer = await options.elementToScreenshot.screenshot(screenshotOptions)
    } finally {
      // Always restore the DOM state
      await restoreDOM()
    }
  } else {
    // If no explicit clip was provided, clip to clientWidth to avoid Safari/WebKit gutter
    if (!options?.clip) {
      const viewportSize = page.viewportSize()
      if (!viewportSize) throw new Error("Could not get viewport size for clipping")
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      screenshotOptions.clip = {
        x: 0,
        y: 0,
        width: clientWidth,
        height: viewportSize.height,
      }
    }

    await expect(page).toHaveScreenshot(screenshotName, screenshotOptions)

    screenshotBuffer = await page.screenshot(screenshotOptions)
  }

  return screenshotBuffer
}

export async function wrapH1SectionsInSpans(locator: Locator | Page): Promise<void> {
  const evaluateFunc = () => {
    // Create a static list of headers to iterate over
    const headers = Array.from(document.querySelectorAll("article > h1"))

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]
      const parent = header.parentElement

      if (!parent) continue

      // If the parent is already a span we've created, skip it
      if (parent.tagName === "SPAN" && parent.id.startsWith("h1-span-")) {
        continue
      }

      const span = document.createElement("span")
      if (!header.id) {
        throw new Error("Header has no id")
      }
      span.id = `h1-span-${header.id}`

      parent.insertBefore(span, header)

      span.appendChild(header)

      // Move all subsequent siblings into the span until we hit the next h1
      let nextSibling = span.nextSibling
      while (nextSibling && headers.indexOf(nextSibling as Element) === -1) {
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
 * @param container - The container to get the h1s from
 * @param testInfo - The test info
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

  for (let index = 0; index < h1Spans.length; index++) {
    const h1Span = h1Spans[index]
    await h1Span.scrollIntoViewIfNeeded()
    const h1Text = await h1Span.textContent()
    const sanitizedH1Text = h1Text ? sanitize(h1Text) : null
    if (!sanitizedH1Text) throw new Error("H1 span has no text")

    await takeRegressionScreenshot(page, testInfo, `h1-span-${theme}-${sanitizedH1Text}`, {
      elementToScreenshot: h1Span,
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

// NOTE: Assumes search is opened
export async function search(page: Page, term: string) {
  // Wait for search container to be in the DOM and interactive
  const searchContainer = page.locator("#search-container")
  // Ensure search is opened
  await expect(searchContainer).toBeAttached()
  await expect(searchContainer).toHaveClass(/active/)
  await expect(searchContainer).toBeVisible()

  const searchBar = page.locator("#search-bar")
  await expect(searchBar).toBeVisible()
  await searchBar.fill(term)

  // Wait for search layout to be visible with results
  const searchLayout = page.locator("#search-layout")
  await expect(searchLayout).toBeAttached()
  await expect(searchLayout).toBeVisible()
  await expect(searchLayout).toHaveClass(/display-results/)

  // Wait for results to appear
  const resultsContainer = page.locator("#results-container")
  await expect(resultsContainer).toBeVisible()

  if (showingPreview(page)) {
    const previewContainer = page.locator("#preview-container")
    await expect(previewContainer).toBeAttached()
  }
}

export async function pauseMediaElements(page: Page): Promise<void> {
  const videoPromises = (await page.locator("video").all()).map((el) =>
    el.evaluate((n: HTMLVideoElement) => {
      n.pause()
      n.currentTime = 0
    }),
  )
  const audioPromises = (await page.locator("audio").all()).map((el) =>
    el.evaluate((n: HTMLAudioElement) => {
      n.pause()
      if (Number.isFinite(n.duration)) {
        n.currentTime = n.duration
      }
    }),
  )

  await Promise.all([...videoPromises, ...audioPromises])
}

/**
 * Returns true if the page will show a search preview
 */
export function showingPreview(page: Page): boolean {
  const viewportSize = page.viewportSize()
  const shouldShowPreview = viewportSize?.width && viewportSize.width > tabletBreakpoint
  return Boolean(shouldShowPreview)
}

/**
 * Waits for all transitions to complete before resolving. If no transitions are defined, it resolves immediately.
 * @param element - The element to wait for transitions on
 * @returns A promise that resolves when all transitions have completed
 */
export async function waitForTransitionEnd(element: Locator): Promise<void> {
  await element.evaluate((el) => {
    return new Promise((resolve) => {
      const computedStyle = window.getComputedStyle(el)
      const transitionDurationValue = computedStyle.transitionDuration

      // If no transitionDuration is set or empty, resolve immediately
      if (!transitionDurationValue || transitionDurationValue.trim() === "") {
        resolve(true)
        return
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
        resolve(true)
        return
      }

      // Determine the maximum transition duration
      const maxDuration = Math.max(...parsedDurations)

      // Count transitions using transitionProperty
      const properties = computedStyle.transitionProperty.split(",").map((p) => p.trim())
      let pendingTransitions = properties.length

      // Listen for all transitionend events
      const onTransitionEnd = (): void => {
        pendingTransitions--
        if (pendingTransitions <= 0) {
          el.removeEventListener("transitionend", onTransitionEnd)
          // Wait for the longest transition to surely complete plus a short buffer
          setTimeout(() => {
            resolve(true)
          }, maxDuration + 150)
        }
      }
      el.addEventListener("transitionend", onTransitionEnd)

      // Safety timeout in case transitionend events never fire
      setTimeout(() => {
        if (pendingTransitions > 0) {
          el.removeEventListener("transitionend", onTransitionEnd)
          resolve(true)
        }
      }, maxDuration + 150)
    })
  })
}

export function isDesktopViewport(page: Page): boolean {
  const viewportSize = page.viewportSize()
  return viewportSize ? viewportSize.width >= minDesktopWidth : false
}
