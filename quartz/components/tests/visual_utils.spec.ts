import { test, expect, type PageScreenshotOptions } from "@playwright/test"
import sharp from "sharp"

import { type Theme } from "../scripts/darkmode"
import {
  yOffset,
  setTheme,
  getNextElementMatchingSelector,
  waitForTransitionEnd,
  isDesktopViewport,
  takeRegressionScreenshot,
} from "./visual_utils"

test.describe("visual_utils functions", () => {
  const preferredTheme = "light"

  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:8080/test-page", { waitUntil: "domcontentloaded" })
    await page.emulateMedia({ colorScheme: preferredTheme })
  })

  for (const theme of ["light", "dark", "auto"]) {
    test(`setTheme changes theme attributes and label for ${theme}`, async ({ page }) => {
      await setTheme(page, theme as Theme)

      // Check data-theme attribute
      const currentTheme = await page.evaluate(() =>
        document.documentElement.getAttribute("data-theme"),
      )
      const expectedTheme = theme === "auto" ? preferredTheme : theme
      expect(currentTheme).toBe(expectedTheme)

      // Check data-theme-mode attribute
      const themeMode = await page.evaluate(() =>
        document.documentElement.getAttribute("data-theme-mode"),
      )
      expect(themeMode).toBe(theme)

      // Check theme label text
      const labelText = await page.evaluate(
        () => document.querySelector("#theme-label")?.textContent,
      )
      const expectedLabel = (theme as string).charAt(0).toUpperCase() + theme.slice(1)
      expect(labelText).toBe(expectedLabel)
    })
  }

  test("yOffset between two headers returns correct positive offset", async ({ page }) => {
    const header1 = page.locator("h1").nth(0)
    const header2 = page.locator("h1").nth(1)

    const offset = await yOffset(header1, header2)
    expect(offset).toBeGreaterThan(0)
  })

  test("yOffset throws error when second element is above the first", async ({ page }) => {
    const header1 = page.locator("h2").nth(1)
    const header2 = page.locator("h2").nth(0)

    await expect(yOffset(header1, header2)).rejects.toThrow(
      "Second element is above the first element",
    )
  })

  test("getNextElementMatchingSelector finds the next h2 after a given h2", async ({ page }) => {
    const currentHeader = page.locator("h2").nth(1)
    const nextHeader = await getNextElementMatchingSelector(currentHeader, "h2")

    const trueNextHeader = page.locator("h2").nth(2)
    expect(await nextHeader.evaluate((el) => el.textContent)).toEqual(
      await trueNextHeader.evaluate((el) => el.textContent),
    )
  })

  test("getNextElementMatchingSelector throws error if no next element is found", async ({
    page,
  }) => {
    const headers = page.locator("h2")
    const lastHeaderIndex = (await headers.count()) - 1
    const lastHeader = headers.nth(lastHeaderIndex)

    await expect(getNextElementMatchingSelector(lastHeader, "h2")).rejects.toThrow(
      "No next element found",
    )
  })

  test.describe("waitForTransitionEnd", () => {
    test("resolves after transition completes", async ({ page }) => {
      // Create an element with a transition
      await page.evaluate(() => {
        const div = document.createElement("div")
        div.id = "test-transition"
        div.style.transition = "opacity 100ms"
        div.style.opacity = "1"
        div.style.width = "100px"
        div.style.height = "100px"
        div.style.backgroundColor = "blue"
        document.body.appendChild(div)
      })

      const element = page.locator("#test-transition")
      const opaqueScreenshot = await element.screenshot()

      // Start transition and wait for it
      const waitPromise = waitForTransitionEnd(element)
      await element.evaluate((el) => {
        el.style.opacity = "0"
      })
      await waitPromise

      // Visual verification
      const transparentScreenshot = await element.screenshot()
      expect(transparentScreenshot).not.toEqual(opaqueScreenshot)
    })

    test("element stops changing after transition completes", async ({ page }) => {
      await page.evaluate(() => {
        const div = document.createElement("div")
        div.id = "test-transition-complete"
        div.style.transition = "all 100ms"
        div.style.width = "100px"
        div.style.height = "100px"
        div.style.backgroundColor = "red"
        document.body.appendChild(div)
      })

      const element = page.locator("#test-transition-complete")

      // Start transition and wait for it
      const waitPromise = waitForTransitionEnd(element)
      await element.evaluate((el) => {
        el.style.transform = "translateX(100px)"
      })
      await waitPromise

      // Take multiple screenshots after transition ends to verify stability
      const immediatePostTransitionScreenshot = await element.screenshot()
      await page.waitForTimeout(50) // Small delay
      const shortDelayScreenshot = await element.screenshot()
      await page.waitForTimeout(50) // Small delay
      const longDelayScreenshot = await element.screenshot()

      // All screenshots after transition should be identical
      expect(immediatePostTransitionScreenshot).toEqual(shortDelayScreenshot)
      expect(shortDelayScreenshot).toEqual(longDelayScreenshot)
    })

    test("resolves immediately if no transition occurs", async ({ page }) => {
      // Create an element without transitions
      await page.evaluate(() => {
        const div = document.createElement("div")
        div.id = "test-no-transition"
        div.style.width = "100px"
        div.style.height = "100px"
        div.style.backgroundColor = "green"
        document.body.appendChild(div)
      })

      const element = page.locator("#test-no-transition")

      const start = Date.now()
      await waitForTransitionEnd(element)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(150)
    })

    test("waits for all transitions to complete before resolving", async ({ page }) => {
      // Create an element with multiple transitions
      await page.evaluate(() => {
        const div = document.createElement("div")
        div.id = "test-multiple-transitions"
        div.style.transition = "opacity 100ms, transform 200ms" // Much longer transitions
        div.style.opacity = "1"
        div.style.transform = "translateX(0)"
        div.style.width = "100px"
        div.style.height = "100px"
        div.style.backgroundColor = "purple"
        document.body.appendChild(div)
      })

      const element = page.locator("#test-multiple-transitions")

      // Start both transitions
      const waitPromise = waitForTransitionEnd(element)
      await element.evaluate((el) => {
        el.style.opacity = "0"
        el.style.transform = "translateX(100px)"
      })

      // Wait for all transitions to complete
      await waitPromise

      // Take final screenshot
      const postTransitionScreenshot = await element.screenshot()

      // Verify no more changes
      await page.waitForTimeout(50)
      const stabilityVerificationScreenshot = await element.screenshot()
      expect(stabilityVerificationScreenshot).toEqual(postTransitionScreenshot)
    })
  })
})

test.describe("isDesktopViewport", () => {
  const viewports = [
    { width: 1580, height: 800, expected: true },
    { width: 1920, height: 1080, expected: true },
    { width: 800, height: 600, expected: false },
    { width: 480, height: 800, expected: false },
  ]

  for (const { width, height, expected } of viewports) {
    test(`returns ${expected} for viewport ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      expect(isDesktopViewport(page)).toBe(expected)
    })
  }

  test("Returns false if viewport width is undefined", async ({ page }) => {
    await page.setViewportSize({ width: 0, height: 0 })
    await page.evaluate(() => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        get: () => undefined,
      })
    })
    expect(isDesktopViewport(page)).toBe(false)
  })
})

test.describe("takeRegressionScreenshot", () => {
  test.beforeEach(async ({ page }) => {
    // Create a clean test page with known content
    await page.setContent(`
      <div id="test-root" style="width: 500px; height: 500px; background: white;">
        <div id="test-element" style="width: 100px; height: 100px; background: blue;"></div>
      </div>
    `)
  })

  test("screenshot name includes browser and viewport info", async ({ page }, testInfo) => {
    // Spy on the screenshot call to capture the options
    const originalScreenshot = page.screenshot.bind(page)
    let capturedOptions: PageScreenshotOptions = {}
    page.screenshot = async (options?: PageScreenshotOptions) => {
      capturedOptions = options ?? {}
      return originalScreenshot(options)
    }

    await takeRegressionScreenshot(page, testInfo, "test-suffix")

    // Verify path format
    expect(capturedOptions.path).toMatch(
      new RegExp(`lost-pixel/.*-test-suffix-${testInfo.project.name}\\.png$`),
    )
  })

  test("generates full page screenshot with correct dimensions  ", async ({ page }, testInfo) => {
    const viewportSize = { width: 1024, height: 768 }
    await page.setViewportSize(viewportSize)

    // Not a lostpixel test
    const screenshot = await takeRegressionScreenshot(page, testInfo, "test-suffix")
    const dimensions = await getImageDimensions(screenshot)

    expect(dimensions.width).toBe(viewportSize.width)
    expect(dimensions.height).toBe(viewportSize.height)
  })

  test("element screenshot captures only the element", async ({ page }, testInfo) => {
    const element = page.locator("#test-element")
    const elementBox = await element.boundingBox()
    if (!elementBox) throw new Error("Could not get element bounding box")

    const screenshot = await takeRegressionScreenshot(page, testInfo, "element-test", {
      element: "#test-element",
    })
    const dimensions = await getImageDimensions(screenshot)

    // Should match element dimensions
    expect(dimensions.width).toBe(elementBox.width)
    expect(dimensions.height).toBe(elementBox.height)
  })

  test("clip option respects specified dimensions", async ({ page }, testInfo) => {
    const clip = { x: 0, y: 0, width: 200, height: 150 }

    const screenshot = await takeRegressionScreenshot(page, testInfo, "clip-test", {
      clip,
    })
    const dimensions = await getImageDimensions(screenshot)

    expect(dimensions.width).toBe(clip.width)
    expect(dimensions.height).toBe(clip.height)
  })
})

// Helper function to get image dimensions from buffer
async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata()
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  }
}
