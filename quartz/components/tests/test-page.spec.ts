import { test, expect, Locator } from "@playwright/test"

import { takeArgosScreenshot, takeScreenshotAfterElement, setTheme, yOffset } from "./visual_utils"

test.beforeEach(async ({ page }) => {
  // Mock clipboard API
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      value: () => Promise.resolve(),
      writable: true,
    })
  })

  // Log any console errors
  page.on("pageerror", (err) => console.error(err))

  await page.goto("http://localhost:8080/test-page")

  // Dispatch the 'nav' event to initialize clipboard functionality
  await page.evaluate(() => {
    window.dispatchEvent(new Event("nav"))
  })
})

// Automatical visual regression test for each section on the page
test.describe("Sections", () => {
  for (const theme of ["light", "dark"]) {
    test(`Sections in ${theme} mode`, async ({ page }, testInfo) => {
      await setTheme(page, theme as "light" | "dark")

      const headers: Locator[] = await page.locator("h1").all()
      for (let index = 0; index < headers.length - 1; index++) {
        const header = headers[index]
        const nextHeader = headers[index + 1]
        const offset = await yOffset(header, nextHeader)

        // Only screenshot up to where the next section begins
        await takeScreenshotAfterElement(page, testInfo, header, offset, `${theme}-${index}`)
      }
    })
  }
})

test.describe("Admonitions", () => {
  const waitAfterCollapse = 450 // Wait ms after collapsing to ensure transition is complete

  for (const theme of ["light", "dark"]) {
    test(`Nested admonition icon is the same as the non-nested admonition icon in ${theme} mode`, async ({
      page,
    }) => {
      await setTheme(page, theme as "light" | "dark")
      const normalAdmonition = page.locator(".note .callout-icon").first()
      const nestedAdmonition = page.locator(".quote .note .callout-icon").first()

      const screenshots: string[] = []
      for (const admonition of [normalAdmonition, nestedAdmonition]) {
        await admonition.scrollIntoViewIfNeeded()
        await expect(admonition).toBeVisible()
        screenshots.push((await admonition.screenshot()).toString("base64"))
      }

      expect(screenshots[0]).toEqual(screenshots[1])
    })

    test(`Opening and closing an admonition in ${theme} mode`, async ({ page }) => {
      await setTheme(page, theme as "light" | "dark")
      const admonition = page.locator(".is-collapsible:has(.callout-title)").first()
      await admonition.scrollIntoViewIfNeeded()
      const initialScreenshot = await admonition.screenshot()

      const admonitionTitle = page.locator(".is-collapsible .callout-title").first()
      await admonitionTitle.click()
      await page.waitForTimeout(waitAfterCollapse)
      await expect(admonition).not.toHaveClass(/.*is-collapsed.*/)

      const openedScreenshot = await admonition.screenshot()
      expect(openedScreenshot).not.toEqual(initialScreenshot)

      await admonitionTitle.click()
      await page.waitForTimeout(waitAfterCollapse)
      await expect(admonition).toHaveClass(/.*is-collapsed.*/)

      const closedScreenshot = await admonition.screenshot()
      expect(closedScreenshot).toEqual(initialScreenshot)
    })
  }

  for (const status of ["open", "closed"]) {
    test(`Regression testing on fold button appearance in ${status} state`, async ({
      page,
    }, testInfo) => {
      let element: Locator
      if (status === "open") {
        element = page.locator(".fold-callout-icon:not(.is-collapsed *)").first()
      } else {
        element = page.locator(".is-collapsed .fold-callout-icon").first()
      }

      await takeArgosScreenshot(page, testInfo, `fold-button-appearance-${status}`, {
        element,
      })
    })
  }
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

    test(`Clipboard button in ${theme} mode`, async ({ page }, testInfo) => {
      await setTheme(page, theme as "light" | "dark")
      const clipboardButton = page.locator(".clipboard-button").first()
      await clipboardButton.click()

      await takeArgosScreenshot(page, testInfo, `clipboard-button-clicked-${theme}`, {
        element: clipboardButton,
        disableHover: false,
      })
    })
  }
})

const fullPageBreakpoint = 1580 // px
test.describe("Right sidebar", () => {
  test("TOC visual test", async ({ page }, testInfo) => {
    const viewportSize = page.viewportSize()
    if (viewportSize && viewportSize.width < fullPageBreakpoint) {
      // Open the TOC
      const tocContent = page.locator(".callout").first()
      await tocContent.click()
      await takeArgosScreenshot(page, testInfo, "toc-visual-test-open", {
        element: tocContent,
      })
    } else {
      const rightSidebar = page.locator("#right-sidebar")
      await takeArgosScreenshot(page, testInfo, "toc-visual-test", {
        element: rightSidebar,
      })
    }
  })

  test("Scrolling down changes TOC highlight", async ({ page }, testInfo) => {
    const viewportSize = page.viewportSize()
    if (viewportSize && viewportSize.width < fullPageBreakpoint) {
      test.skip()
    }

    const spoilerHeading = page.locator("#spoilers").first()
    await spoilerHeading.scrollIntoViewIfNeeded()

    const activeElement = page.locator("#table-of-contents .active").first()
    await takeArgosScreenshot(page, testInfo, "toc-highlight-scrolled", {
      element: activeElement,
    })
  })

  test("ContentMeta is visible", async ({ page }, testInfo) => {
    await takeArgosScreenshot(page, testInfo, "content-meta-visible", {
      element: "#content-meta",
    })
  })
  // TODO test backlinks
})

test.describe("Spoilers", () => {
  const waitAfterRevealing = 800 // ms

  for (const theme of ["light", "dark"]) {
    test(`Spoiler before revealing in ${theme} mode`, async ({ page }, testInfo) => {
      await setTheme(page, theme as "light" | "dark")
      const spoiler = page.locator(".spoiler-container").first()
      await takeArgosScreenshot(page, testInfo, `spoiler-before-revealing-${theme}`, {
        element: spoiler,
      })
    })

    test(`Spoiler after revealing in ${theme} mode`, async ({ page }, testInfo) => {
      await setTheme(page, theme as "light" | "dark")
      const spoiler = page.locator(".spoiler-container").first()
      await spoiler.scrollIntoViewIfNeeded()
      await expect(spoiler).toBeVisible()

      const screenshotBeforeClicking = await spoiler.screenshot()
      await spoiler.click()

      // Wait for the 'revealed' class to be added
      await expect(spoiler).toHaveClass(/revealed/)
      await page.waitForTimeout(waitAfterRevealing)

      await takeArgosScreenshot(page, testInfo, "spoiler-after-revealing", {
        element: spoiler,
      })

      // Click again to close
      await spoiler.click()
      await page.mouse.click(0, 0) // Click away to remove focus

      // Wait for the 'revealed' class to be removed
      await expect(spoiler).not.toHaveClass(/revealed/)
      await page.waitForTimeout(waitAfterRevealing)

      const screenshotAfterClosing = await spoiler.screenshot()
      expect(screenshotAfterClosing).toEqual(screenshotBeforeClicking)
    })
  }

  // Test that hovering over the spoiler reveals it
  test("Hovering over spoiler reveals it", async ({ page }, testInfo) => {
    const spoiler = page.locator(".spoiler-container").first()
    await spoiler.scrollIntoViewIfNeeded()
    await expect(spoiler).toBeVisible()

    const initialScreenshot = await spoiler.screenshot()

    await spoiler.hover()
    const revealedScreenshot = await spoiler.screenshot()
    expect(revealedScreenshot).not.toEqual(initialScreenshot)

    await takeArgosScreenshot(page, testInfo, "spoiler-hover-reveal", {
      element: spoiler,
      disableHover: false,
    })
  })
})

// Test that scrolling down halfway through page and then refreshing 3 times doesn't change the screenshot
// test("Scrolling down halfway through page and then refreshing 3 times doesn't change the screenshot", async ({
//   page,
// }) => {
//   await page.evaluate(() => {
//     window.scrollTo(0, 500)
//   })

//   // Screenshot the visible viewport
//   await page.reload({ waitUntil: "load" })
//   const referenceScreenshot = await page.screenshot()
//   for (let i = 0; i < 3; i++) {
//     await page.reload({ waitUntil: "load" })
//     await page.waitForTimeout(200)
//     const screenshot = await page.screenshot()
//     expect(screenshot).toEqual(referenceScreenshot)
//   }
// })
