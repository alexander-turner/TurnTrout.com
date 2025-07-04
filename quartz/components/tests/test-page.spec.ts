import { test, expect, type Locator, type Page, type TestInfo } from "@playwright/test"

import { minDesktopWidth, maxMobileWidth } from "../../styles/variables"
import {
  takeRegressionScreenshot,
  setTheme,
  waitForTransitionEnd,
  isDesktopViewport,
  yOffset,
  takeScreenshotAfterElement,
} from "./visual_utils"

const TIGHT_SCROLL_TOLERANCE = 10
// Visual regression tests don't need assertions
/* eslint-disable playwright/expect-expect */

// TODO test iframe and video fullscreen in light mode (and dark for safety)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Mock clipboard API if not available
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", {
        value: {},
        writable: true,
      })
    }

    Object.defineProperty(navigator.clipboard, "writeText", {
      value: () => Promise.resolve(),
      writable: true,
    })
  })

  page.on("pageerror", (err) => console.error(err))

  await page.goto("http://localhost:8080/test-page", { waitUntil: "load" })

  // Dispatch the 'nav' event to initialize clipboard functionality
  await page.evaluate(() => {
    window.dispatchEvent(new Event("nav"))
  })

  // Hide all video controls
  await page.evaluate(() => {
    const videos = document.querySelectorAll("video")
    videos.forEach((video) => {
      video.removeAttribute("controls")
    })
  })
})

/**
 * Get screenshots of all h1s in a container
 * @param container - The container to get the h1s from
 * @param testInfo - The test info
 * @param theme - The theme to get the screenshots for
 */
async function getH1Screenshots(
  page: Page,
  testInfo: TestInfo,
  location: Locator | null,
  theme: "dark" | "light",
) {
  let headers: Locator[]
  if (location) {
    headers = await location.locator("h1").all()
  } else {
    headers = await page.locator("h1").all()
  }

  for (let index = 0; index < headers.length - 1; index++) {
    const header = headers[index]
    const nextHeader = headers[index + 1]
    const offset = await yOffset(header, nextHeader)

    await header.scrollIntoViewIfNeeded()

    // Only screenshot up to where the next section begins
    await takeScreenshotAfterElement(page, testInfo, header, offset, `${theme}-${index}`)
  }
}

test.describe("Test page sections", () => {
  for (const theme of ["dark", "light"]) {
    test(`Normal page in ${theme} mode (lostpixel)`, async ({ page }, testInfo) => {
      await setTheme(page, theme as "light" | "dark")

      const boundingBoxArticle = await page.locator("body").boundingBox()
      await page.setViewportSize({
        width: page.viewportSize()?.width ?? 1920,
        height: Math.ceil(boundingBoxArticle?.height ?? 0),
      })

      await getH1Screenshots(page, testInfo, null, theme as "light" | "dark")
    })
  }
})

test.describe("Unique content around the site", () => {
  for (const pageSlug of ["", "404"]) {
    const url = `http://localhost:8080/${pageSlug}`

    const title = pageSlug === "" ? "Welcome" : pageSlug
    test(`${title} (lostpixel)`, async ({ page }, testInfo) => {
      await page.goto(url)
      await page.locator("body").waitFor({ state: "visible" })
      await takeRegressionScreenshot(page, testInfo, `site-page-${title}`)
    })
  }

  // Several pages update based on new posts
  // Mock the data to prevent needless updating of the screenshots
  for (const pageSlug of ["recent", "tags/personal"]) {
    const url = `http://localhost:8080/${pageSlug}`
    test(`${pageSlug} (lostpixel)`, async ({ page }, testInfo) => {
      await page.goto(url)
      await page.locator("body").waitFor({ state: "visible" })

      // Remove all but the oldest numOldest posts; stable as I add more
      const numOldest = 9
      await page.evaluate((numKeepOldest: number) => {
        const listElement = document.querySelectorAll("ul.section-ul")[0]
        if (!listElement) {
          console.error("Could not find the post list element.")
          return
        }

        const children = listElement.children
        const numTotalChildren = children.length
        const numToRemove = numTotalChildren - numKeepOldest

        // Need to copy the children to remove *before* iterating,
        // as removing modifies the live HTMLCollection
        const childrenToRemove = Array.from(children).slice(0, numToRemove)
        childrenToRemove.forEach((child) => listElement.removeChild(child))
      }, numOldest)

      await takeRegressionScreenshot(page, testInfo, `recent-posts-oldest-${numOldest}`, {
        element: "#center-content",
      })
    })
  }

  test("All-tags with dummy values", async ({ page }, testInfo) => {
    const url = "http://localhost:8080/all-tags"
    await page.goto(url)
    await page.locator("body").waitFor({ state: "visible" })

    await page.evaluate(() => {
      const tagContainers = document.querySelectorAll(".tag-container")
      tagContainers.forEach((tagContainer, index) => {
        // Don't want look to change as I add more tags
        if (index >= 10) {
          tagContainer.remove()
        }

        const tagLink = tagContainer.querySelector(".tag-link")
        if (!tagLink) throw new Error("Could not get tag link")
        tagLink.textContent = `tag-${index}`

        const tagCount = tagContainer.querySelector(".tag-count")
        if (!tagCount) throw new Error("Could not get tag count")
        tagCount.textContent = `(${index})`
      })
    })

    await takeRegressionScreenshot(page, testInfo, "all-tags-dummy")
  })

  test("Reward warning (lostpixel)", async ({ page }, testInfo) => {
    await page.goto(
      "http://localhost:8080/a-certain-formalization-of-corrigibility-is-vnm-incoherent",
    )

    const admonition = page.locator(".warning").first()
    await admonition.scrollIntoViewIfNeeded()

    const rewardWarning = admonition.getByText("Reward is not the optimization target").first()
    await expect(rewardWarning).toBeVisible()

    await takeRegressionScreenshot(page, testInfo, "reward-warning", {
      element: admonition,
    })
  })
})
test.describe("Table of contents", () => {
  test("TOC is visible (lostpixel)", async ({ page }) => {
    let selector: string
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (isDesktopViewport(page)) {
      selector = "#toc-content"
    } else {
      selector = "*:has(> #toc-content-mobile)"
    }

    await expect(page.locator(selector)).toBeVisible()
  })
  test("Desktop TOC visual test (lostpixel)", async ({ page }, testInfo) => {
    test.skip(!isDesktopViewport(page))

    const rightSidebar = page.locator("#right-sidebar #table-of-contents")
    await takeRegressionScreenshot(page, testInfo, "toc-visual-test-sidebar", {
      element: rightSidebar,
    })
  })
  test("TOC visual test (lostpixel)", async ({ page }, testInfo) => {
    test.skip(isDesktopViewport(page))

    // Hide the navbar
    await page.evaluate(() => {
      const navbar = document.getElementById("navbar")
      if (navbar) {
        navbar.style.display = "none"
      }
    })

    const tocContent = page.locator(".admonition").first()
    await takeRegressionScreenshot(page, testInfo, "toc-visual-test-open", {
      element: tocContent,
    })
  })

  test("Scrolling down changes TOC highlight", async ({ page }) => {
    test.skip(!isDesktopViewport(page))

    const headerLocator = page.locator("h1").last()
    await headerLocator.scrollIntoViewIfNeeded()
    const tocHighlightLocator = page.locator("#table-of-contents .active").first()
    const highlightText = await tocHighlightLocator.textContent()

    const spoilerHeading = page.locator("#spoilers").first()
    await spoilerHeading.scrollIntoViewIfNeeded()

    await expect(tocHighlightLocator).not.toHaveText(highlightText!)
  })
})

test.describe("Layout Breakpoints", () => {
  for (const width of [minDesktopWidth, maxMobileWidth]) {
    test(`Layout at breakpoint width ${width}px (lostpixel)`, async ({ page }, testInfo) => {
      test.skip(!isDesktopViewport(page), "Desktop-only test")

      await page.setViewportSize({ width, height: 480 }) // Don't show much

      await takeRegressionScreenshot(page, testInfo, `layout-breakpoint-${width}px`)
    })
  }
})

test.describe("Admonitions", () => {
  for (const theme of ["light", "dark"]) {
    test(`Admonition click behaviors in ${theme} mode`, async ({ page }) => {
      await setTheme(page, theme as "light" | "dark")

      const admonition = page.locator("#test-collapse").first()
      await admonition.scrollIntoViewIfNeeded()

      // Initial state should be collapsed
      await expect(admonition).toHaveClass(/.*is-collapsed.*/)
      const initialScreenshot = await admonition.screenshot()

      // Click anywhere on admonition should open it
      await admonition.click()
      await expect(admonition).not.toHaveClass(/.*is-collapsed.*/)
      await waitForTransitionEnd(admonition)
      const openedScreenshot = await admonition.screenshot()
      expect(openedScreenshot).not.toEqual(initialScreenshot)

      // Click on content should NOT close it
      const content = admonition.locator(".admonition-content").first()
      await content.click()
      await expect(admonition).not.toHaveClass(/.*is-collapsed.*/)
      const afterContentClickScreenshot = await admonition.screenshot()
      expect(afterContentClickScreenshot).toEqual(openedScreenshot)

      // Click on title should close it
      const title = admonition.locator(".admonition-title").first()
      await title.click()
      await expect(admonition).toHaveClass(/.*is-collapsed.*/)

      await waitForTransitionEnd(admonition)
      await expect(admonition).toBeVisible()
    })
  }

  for (const status of ["open", "collapse"]) {
    test(`Regression testing on fold button appearance in ${status} state (lostpixel)`, async ({
      page,
    }, testInfo) => {
      const element = page.locator(`#test-${status} .fold-admonition-icon`).first()
      await element.scrollIntoViewIfNeeded()
      await expect(element).toBeVisible()

      await takeRegressionScreenshot(page, testInfo, `fold-button-appearance-${status}`, {
        element,
        skipViewportImagesLoad: true,
      })
    })
  }

  test("color demo text isn't wrapping", async ({ page }) => {
    for (const identifier of ["#light-demo", "#dark-demo"]) {
      // Get all paragraph elements within the demo
      const textElements = page.locator(`${identifier} > div > p`)
      const count = await textElements.count()

      // Iterate through each paragraph element
      for (let i = 0; i < count; i++) {
        const element = textElements.nth(i)

        // Get computed styles for this element
        const computedStyle = await element.evaluate((el) => {
          const styles = window.getComputedStyle(el)
          return {
            lineHeight: parseFloat(styles.lineHeight),
            height: el.getBoundingClientRect().height,
          }
        })

        expect(computedStyle.height).toBeLessThanOrEqual(computedStyle.lineHeight * 1.01)
      }
    }
  })
})

test.describe("Clipboard button", () => {
  for (const theme of ["light", "dark"]) {
    test(`Clipboard button is visible when hovering over code block in ${theme} mode`, async ({
      page,
    }) => {
      await setTheme(page, theme as "light" | "dark")
      const clipboardButton = page.locator(".clipboard-button").first()
      await clipboardButton.scrollIntoViewIfNeeded()
      await expect(clipboardButton).toHaveCSS("opacity", "0")

      const codeBlock = page.locator("figure[data-rehype-pretty-code-figure]").first()
      await codeBlock.hover()
      await expect(clipboardButton).toHaveCSS("opacity", "1")
    })

    test(`Clicking the button changes it in ${theme} mode`, async ({ page }) => {
      await setTheme(page, theme as "light" | "dark")
      const clipboardButton = page.locator(".clipboard-button").first()
      const screenshotBeforeClicking = await clipboardButton.screenshot()

      await clipboardButton.click()
      const screenshotAfterClicking = await clipboardButton.screenshot()
      expect(screenshotAfterClicking).not.toEqual(screenshotBeforeClicking)
    })

    test(`Clipboard button in ${theme} mode (lostpixel)`, async ({ page }, testInfo) => {
      await setTheme(page, theme as "light" | "dark")
      const clipboardButton = page.locator(".clipboard-button").first()
      await clipboardButton.click()

      await takeRegressionScreenshot(page, testInfo, `clipboard-button-clicked-${theme}`, {
        element: clipboardButton,
        disableHover: false,
        skipViewportImagesLoad: true,
      })
    })
  }
})

test.describe("Right sidebar", () => {
  test("Right sidebar scrolls independently", async ({ page }) => {
    test.skip(!isDesktopViewport(page), "Desktop-only test")

    const rightSidebar = page.locator("#right-sidebar")
    await expect(rightSidebar).toBeVisible()

    // Check if the content is actually taller than the sidebar viewport
    const isOverflowing = await rightSidebar.evaluate((el) => {
      return el.scrollHeight > el.clientHeight
    })

    expect(isOverflowing).toBeTruthy()

    const initialWindowScrollY = await page.evaluate(() => window.scrollY)
    const initialSidebarScrollTop = await rightSidebar.evaluate((el) => el.scrollTop)

    // Scroll the sidebar down
    await rightSidebar.evaluate((el) => {
      el.scrollBy(0, 100)
    })

    // Wait a moment for scroll to apply
    await page.waitForFunction(
      (args) => {
        const { initialScrollTop, tolerance } = args
        const rightSidebar = document.querySelector("#right-sidebar")
        if (!rightSidebar) return false
        console.error("rightSidebar.scrollTop", rightSidebar.scrollTop, initialScrollTop)
        return Math.abs(rightSidebar.scrollTop - (initialScrollTop + 100)) < tolerance
      },
      { initialScrollTop: initialSidebarScrollTop, tolerance: TIGHT_SCROLL_TOLERANCE },
    )

    const finalWindowScrollY = await page.evaluate(() => window.scrollY)
    const finalSidebarScrollTop = await rightSidebar.evaluate((el) => el.scrollTop)

    // Verify window did not scroll
    expect(finalWindowScrollY).toEqual(initialWindowScrollY)

    // Verify sidebar did scroll
    expect(finalSidebarScrollTop).toBeGreaterThan(initialSidebarScrollTop)
    expect(finalSidebarScrollTop).toBeCloseTo(initialSidebarScrollTop + 100, 0) // Allow for slight rounding
  })

  test("ContentMeta is visible (lostpixel)", async ({ page }, testInfo) => {
    await takeRegressionScreenshot(page, testInfo, "content-meta-visible", {
      element: "#content-meta",
    })
  })

  test("Backlinks are visible (lostpixel)", async ({ page }, testInfo) => {
    const backlinks = page.locator("#backlinks").first()
    await backlinks.scrollIntoViewIfNeeded()
    await expect(backlinks).toBeVisible()

    const backlinksTitle = backlinks.locator(".admonition-title").first()
    await backlinksTitle.scrollIntoViewIfNeeded()
    await expect(backlinksTitle).toBeVisible()
    await expect(backlinksTitle).toHaveText("Links to this page")

    // Open the backlinks
    await backlinksTitle.click()
    await takeRegressionScreenshot(page, testInfo, "backlinks-visible", {
      element: backlinks,
    })
  })
})

test.describe("Spoilers", () => {
  for (const theme of ["light", "dark"]) {
    // Before revealing screenshot is covered in the H1 test

    test(`Spoiler after revealing in ${theme} mode (lostpixel)`, async ({ page }, testInfo) => {
      await setTheme(page, theme as "light" | "dark")
      const spoiler = page.locator(".spoiler-container").first()
      await spoiler.scrollIntoViewIfNeeded()
      await expect(spoiler).toBeVisible()

      await spoiler.click()

      await expect(spoiler).toHaveClass(/revealed/)
      await waitForTransitionEnd(spoiler)

      await takeRegressionScreenshot(page, testInfo, "spoiler-after-revealing", {
        element: spoiler,
        skipViewportImagesLoad: true,
      })

      // Click again to close
      await spoiler.click()
      await page.mouse.click(0, 0) // Click away to remove focus

      await expect(spoiler).not.toHaveClass(/revealed/)
      await waitForTransitionEnd(spoiler)
    })
  }

  test("Hovering over spoiler reveals it (lostpixel)", async ({ page }, testInfo) => {
    const spoiler = page.locator(".spoiler-container").first()
    await spoiler.scrollIntoViewIfNeeded()
    await expect(spoiler).toBeVisible()

    const initialScreenshot = await spoiler.screenshot()

    await spoiler.hover()
    const revealedScreenshot = await spoiler.screenshot()
    expect(revealedScreenshot).not.toEqual(initialScreenshot)

    await takeRegressionScreenshot(page, testInfo, "spoiler-hover-reveal", {
      element: spoiler,
      disableHover: false,
      skipViewportImagesLoad: true,
    })
  })
})

test("Single letter dropcaps visual regression (lostpixel)", async ({ page }, testInfo) => {
  const singleLetterDropcaps = page.locator("#single-letter-dropcap")
  await singleLetterDropcaps.scrollIntoViewIfNeeded()
  await takeRegressionScreenshot(page, testInfo, "single-letter-dropcap", {
    element: "#single-letter-dropcap",
  })
})

for (const theme of ["light", "dark"]) {
  test(`Hover over elvish text in ${theme} mode (lostpixel)`, async ({ page }, testInfo) => {
    await setTheme(page, theme as "light" | "dark")
    const elvishText = page.locator(".elvish").first()
    await elvishText.scrollIntoViewIfNeeded()

    await elvishText.hover()

    // Get initial width TODO
    const box = await elvishText.boundingBox()
    test.fail(!box, "Could not get elvish text dimensions")

    await takeScreenshotAfterElement(page, testInfo, elvishText, 50, `elvish-text-hover-${theme}`)
  })
}

test.describe("Video Speed Controller visibility", () => {
  test("hides VSC controller for no-vsc videos after img", async ({ page }) => {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div class="vsc-controller">Test</div>
        <img />
        <video class="no-vsc"></video>
      `
    })

    const vscController = page.locator(".vsc-controller")
    await expect(vscController).toBeHidden()
  })
  test("hides VSC controller for no-vsc videos", async ({ page }) => {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div class="vsc-controller">Test</div>
        <video class="no-vsc"></video>
      `
    })

    const vscController = page.locator(".vsc-controller")
    await expect(vscController).toBeHidden()
  })

  test("hides VSC controller for autoplay videos", async ({ page }) => {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div class="vsc-controller">Test</div>
        <video autoplay></video>
      `
    })

    const vscController = page.locator(".vsc-controller")
    await expect(vscController).toBeHidden()
  })

  test("shows VSC controller for regular videos", async ({ page }) => {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div class="vsc-controller">Test</div>
        <video></video>
      `
    })

    const vscController = page.locator(".vsc-controller")
    await expect(vscController).toBeVisible()
  })
})

test("First paragraph is the same before and after clicking on a heading", async ({ page }) => {
  const firstParagraph = page.locator("#center-content article > p").first()
  await expect(firstParagraph).toBeVisible()
  const screenshotBefore = await firstParagraph.screenshot()

  const url = page.url()
  await page.goto(`${url}#header-3`)

  await firstParagraph.scrollIntoViewIfNeeded()
  await expect(firstParagraph).toBeVisible()
  const screenshotAfter = await firstParagraph.screenshot()
  expect(screenshotAfter).toEqual(screenshotBefore)
  // Don't need regression screenshot because non-clicked appearance is covered by other tests
})
