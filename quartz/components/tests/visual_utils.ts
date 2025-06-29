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

/**
 * Waits for all images in the viewport to load
 * @param page - The page to wait for images on
 */
export async function waitForViewportImagesToLoad(page: Page): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const isElementInViewport = (el: Element) => {
        const rect = el.getBoundingClientRect()
        return (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        )
      }
      const images = Array.from(document.images).filter(isElementInViewport)

      if (images.length === 0) {
        resolve()
        return
      }

      let loadedCount = 0
      const totalImages = images.length

      const checkComplete = () => {
        loadedCount++
        if (loadedCount === totalImages) {
          resolve()
        }
      }

      images.forEach((img) => {
        const onDone = () => {
          img.removeEventListener("load", onDone)
          img.removeEventListener("error", onDone)
          checkComplete()
        }

        if (img.complete) {
          // If the image is already marked as 'complete' by the browser,
          // the 'load' event may not fire. We poll for naturalWidth instead.
          if (img.naturalWidth > 0) {
            checkComplete()
          } else {
            const poll = setInterval(() => {
              if (img.naturalWidth > 0) {
                clearInterval(poll)
                checkComplete()
              }
              // Note: No timeout here, we let the test runner's timeout handle failed loads.
            }, 50)
          }
        } else {
          img.addEventListener("load", onDone)
          img.addEventListener("error", onDone)
        }
      })
    })
  })
}

export interface RegressionScreenshotOptions {
  element?: string | Locator
  clip?: { x: number; y: number; width: number; height: number }
  disableHover?: boolean
  skipMediaPause?: boolean
  skipViewportImagesLoad?: boolean
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

  if (!options?.skipViewportImagesLoad) {
    await waitForViewportImagesToLoad(page)
  }

  const browserName = testInfo.project.name
  const sanitizedTitle = sanitize(testInfo.title)
  const sanitizedSuffix = sanitize(screenshotSuffix)
  const sanitizedBrowserName = sanitize(browserName)
  const screenshotPath = `lost-pixel/${sanitizedTitle}${sanitizedSuffix ? `-${sanitizedSuffix}` : ""}-${sanitizedBrowserName}.png`

  const screenshotOptions = {
    path: screenshotPath,
    animations: "disabled" as const,
    ...options,
  }

  if (options?.clip) {
    delete screenshotOptions.element
    return page.screenshot(screenshotOptions)
  } else if (options?.element) {
    const element =
      typeof options.element === "string" ? page.locator(options.element) : options.element
    return element.screenshot(screenshotOptions)
  } else {
    // Clip to clientWidth to avoid WebKit gutter
    const viewportSize = page.viewportSize()
    if (!viewportSize) throw new Error("Could not get viewport size for clipping")
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    screenshotOptions.clip = {
      x: 0,
      y: 0,
      width: clientWidth,
      height: viewportSize.height,
    }
    return page.screenshot(screenshotOptions)
  }
}

// TODO test
/**
 * Takes a screenshot of the element and the elements below it. Restricts the screenshot to the height of the element and the width of the parent element.
 * @param page - The page to take the screenshot on.
 * @param testInfo - The test info.
 * @param element - The element to take the screenshot of.
 * @param height - The height of the element.
 * @param testNameSuffix - The suffix to add to the test name.
 */
export async function takeScreenshotAfterElement(
  page: Page,
  testInfo: TestInfo,
  element: Locator,
  height: number,
  testNameSuffix?: string,
) {
  const box = await element.boundingBox()
  if (!box) throw new Error("Could not find element")

  const parent = element.locator("..")
  const parentBox = await parent.boundingBox()
  if (!parentBox) throw new Error("Could not find parent element")

  await takeRegressionScreenshot(page, testInfo, `${testInfo.title}-section-${testNameSuffix}`, {
    element: parent,
    clip: {
      x: parentBox.x,
      y: box.y,
      width: parentBox.width,
      height,
    },
  })
}

/**
 * Returns the y-offset between two elements, from the top of the first element to the top of the second element.
 * @param firstElement - The first element.
 * @param secondElement - The second element.
 * @returns The y-offset between the two elements.
 */
export async function yOffset(firstElement: Locator, secondElement: Locator) {
  // Ensure elements are visible before getting bounding boxes
  await firstElement.waitFor({ state: "visible" })
  await secondElement.waitFor({ state: "visible" })

  const firstBox = await firstElement.boundingBox()
  const secondBox = await secondElement.boundingBox()

  if (!firstBox || !secondBox) throw new Error("Could not find elements")
  if (firstBox.y === secondBox.y) throw new Error("Elements are the same")

  const offset = secondBox.y - firstBox.y
  if (offset < 0) throw new Error("Second element is above the first element")

  return offset
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
