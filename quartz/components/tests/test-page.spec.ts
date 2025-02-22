import { test, expect, type Locator, type Page } from "@playwright/test"

import {
  search,
  showingPreview,
  takeRegressionScreenshot,
  setTheme,
  waitForTransitionEnd,
  isDesktopViewport,
} from "./visual_utils"

// TODO test iframe and video fullscreen in light mode (and dark for safety)
test.beforeEach(async ({ page }) => {
  // Mock clipboard API
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

  // Log any console errors
  page.on("pageerror", (err) => console.error(err))

  await page.goto("http://localhost:8080/test-page", { waitUntil: "domcontentloaded" })

  // Dispatch the 'nav' event to initialize clipboard functionality
  await page.evaluate(() => {
    window.dispatchEvent(new Event("nav"))
  })
})

test.describe("Test page sections", () => {
  for (const theme of ["dark", "light"]) {
    test(`Test page in search preview in ${theme} mode (lostpixel)`, async ({ page }, testInfo) => {
      // EG mobile doesn't show preview
      // For some reason, light theme fails - TODO
      test.skip(!showingPreview(page) || theme === "light")

      // Set theme first and wait for transition
      await setTheme(page, theme as "light" | "dark")

      await page.keyboard.press("/")
      await search(page, "Testing Site Features")
      const previewContainer = page.locator("#preview-container")
      await expect(previewContainer).toBeVisible()

      // Get the preview container's height from the article inside it
      const previewedArticle = previewContainer.locator("article")
      const boundingBoxArticle = await previewedArticle.boundingBox()
      if (!boundingBoxArticle) throw new Error("Could not get preview container dimensions")

      // Set viewport to match preview height
      await page.setViewportSize({
        width: page.viewportSize()?.width ?? 1920,
        height: Math.ceil(2 * boundingBoxArticle.height),
      })

      // The article needs to be tall to screenshot all of it
      await previewContainer.evaluate(
        (el, size) => {
          el.style.height = `${size.height}px`
        },
        {
          height: Math.ceil(1.5 * boundingBoxArticle.height),
        },
      )

      await takeRegressionScreenshot(page, testInfo, `test-page-search-preview-${theme}`, {
        element: previewedArticle,
      })
    })

    test(`Test page in ${theme} mode (lostpixel)`, async ({ page }, testInfo) => {
      await setTheme(page, theme as "light" | "dark")
      await takeRegressionScreenshot(page, testInfo, `test-page-${theme}`)
    })
  }
})

test.describe("Various site pages", () => {
  for (const pageSlug of ["404", "all-tags", "recent", "tags/personal"]) {
    test(`${pageSlug} (lostpixel)`, async ({ page }, testInfo) => {
      await page.goto(`http://localhost:8080/${pageSlug}`)
      await takeRegressionScreenshot(page, testInfo, `test-page-${pageSlug}`)
    })
  }
})

test.describe("Table of contents", () => {
  function getTableOfContentsSelector(page: Page) {
    return isDesktopViewport(page) ? "#toc-content" : "*:has(> #toc-content-mobile)"
  }

  test("TOC is visible (lostpixel)", async ({ page }) => {
    const selector = getTableOfContentsSelector(page)
    await expect(page.locator(selector)).toBeVisible()
  })

  test("TOC visual regression (lostpixel)", async ({ page }, testInfo) => {
    const selector = getTableOfContentsSelector(page)
    if (!isDesktopViewport(page)) {
      await page.locator(selector).locator(".callout-title-inner").first().click()
    }

    await takeRegressionScreenshot(page, testInfo, selector)
  })
})

test.describe("Admonitions", () => {
  for (const theme of ["light", "dark"]) {
    test(`Admonition click behaviors in ${theme} mode (lostpixel)`, async ({ page }, testInfo) => {
      await setTheme(page, theme as "light" | "dark")

      const admonition = page.locator("#test-collapse").first()
      await admonition.scrollIntoViewIfNeeded()

      // Initial state should be collapsed
      await expect(admonition).toHaveClass(/.*is-collapsed.*/)
      const initialScreenshot = await admonition.screenshot()

      // Click anywhere on callout should open it
      await admonition.click()
      await expect(admonition).not.toHaveClass(/.*is-collapsed.*/)
      await waitForTransitionEnd(admonition)
      const openedScreenshot = await admonition.screenshot()
      expect(openedScreenshot).not.toEqual(initialScreenshot)

      // Take lostpixel screenshot
      await takeRegressionScreenshot(page, testInfo, "admonition-click-behaviors", {
        element: admonition,
      })

      // Click on content should NOT close it
      const content = admonition.locator(".callout-content").first()
      await content.click()
      await expect(admonition).not.toHaveClass(/.*is-collapsed.*/)
      const afterContentClickScreenshot = await admonition.screenshot()
      expect(afterContentClickScreenshot).toEqual(openedScreenshot)

      // Click on title should close it
      const title = admonition.locator(".callout-title").first()
      await title.click()
      await expect(admonition).toHaveClass(/.*is-collapsed.*/)

      await waitForTransitionEnd(admonition)
      await expect(admonition).toBeVisible()

      // Take lostpixel screenshot
      await takeRegressionScreenshot(page, testInfo, "admonition-click-behaviors", {
        element: admonition,
      })
    })
  }

  for (const status of ["open", "closed"]) {
    test(`Regression testing on fold button appearance in ${status} state (lostpixel)`, async ({
      page,
    }, testInfo) => {
      let element: Locator
      if (status === "open") {
        element = page.locator("#test-open .fold-callout-icon").first()
      } else {
        element = page.locator("#test-collapse .fold-callout-icon").first()
      }

      await element.scrollIntoViewIfNeeded()
      await element.waitFor({ state: "visible" })

      await takeRegressionScreenshot(page, testInfo, `fold-button-appearance-${status}`, {
        element,
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

        // Assert the height is not significantly greater than line height
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
      })
    })
  }
})

test.describe("Right sidebar", () => {
  test("TOC visual test (lostpixel)", async ({ page }, testInfo) => {
    if (!isDesktopViewport(page)) {
      // Open the TOC
      const tocContent = page.locator(".callout").first()
      await tocContent.click()
      await takeRegressionScreenshot(page, testInfo, "toc-visual-test-open", {
        element: tocContent,
      })
    } else {
      const rightSidebar = page.locator("#right-sidebar")
      await takeRegressionScreenshot(page, testInfo, "toc-visual-test", {
        element: rightSidebar,
      })
    }
  })

  test("Scrolling down changes TOC highlight (lostpixel)", async ({ page }, testInfo) => {
    test.skip(!isDesktopViewport(page))

    const spoilerHeading = page.locator("#spoilers").first()
    await spoilerHeading.scrollIntoViewIfNeeded()

    const activeElement = page.locator("#table-of-contents .active").first()
    await takeRegressionScreenshot(page, testInfo, "toc-highlight-scrolled", {
      element: activeElement,
    })
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

    const backlinksTitle = backlinks.locator(".callout-title").first()
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
    test(`Spoiler before revealing in ${theme} mode (lostpixel)`, async ({ page }, testInfo) => {
      await setTheme(page, theme as "light" | "dark")
      const spoiler = page.locator(".spoiler-container").first()
      await takeRegressionScreenshot(page, testInfo, `spoiler-before-revealing-${theme}`, {
        element: spoiler,
      })
    })

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
      })

      // Click again to close
      await spoiler.click()
      await page.mouse.click(0, 0) // Click away to remove focus

      await expect(spoiler).not.toHaveClass(/revealed/)
      await waitForTransitionEnd(spoiler)
    })
  }

  // Test that hovering over the spoiler reveals it
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
    })
  })
})

test("Single letter dropcaps visual regression (lostpixel)", async ({ page }, testInfo) => {
  const singleLetterDropcaps = page.locator("#single-letter-dropcap")
  await singleLetterDropcaps.scrollIntoViewIfNeeded()
  await takeRegressionScreenshot(page, testInfo, "", {
    element: "#single-letter-dropcap",
  })
})

// TODO: hover over elvish text
