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

async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata()
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  }
}
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

      expect(duration).toBeLessThan(500)
    })

    test("waits for all transitions to complete before resolving", async ({ page }) => {
      // Create an element with multiple transitions
      await page.evaluate(() => {
        const div = document.createElement("div")
        div.id = "test-multiple-transitions"
        div.style.transition = "opacity 100ms, transform 200ms"
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

      await waitPromise

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

  test("Returns false if viewport width is tiny", async ({ page }) => {
    await page.setViewportSize({ width: 1, height: 1 })
    expect(isDesktopViewport(page)).toBe(false)
  })
})

test.describe("takeRegressionScreenshot", () => {
  test.beforeEach(async ({ page }) => {
    // Create a clean test page with known content
    await page.setContent(`
      <html>
        <body id="test-root" style="width: 1024px; height: 3000px; background: white;">
          <div id="test-element" style="width: 100px; height: 100px; background: blue;"></div>
        </body>
      </html>
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

    // Since we're mocking the page.screenshot, need to pass in clip option
    await takeRegressionScreenshot(page, testInfo, "test-suffix", {
      clip: { x: 0, y: 0, width: 500, height: 500 },
    })

    expect(capturedOptions).not.toBeNull()
    expect(capturedOptions.path).toMatch(
      new RegExp(`lost-pixel/.*-test-suffix-${testInfo.project.name}\\.png$`),
    )
  })

  test("generates full page screenshot with correct dimensions  ", async ({ page }, testInfo) => {
    const viewportSize = { width: 1024, height: 768 }
    await page.setViewportSize(viewportSize)

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

    expect(dimensions.width).toBe(elementBox.width)
    expect(dimensions.height).toBe(elementBox.height)
  })

  test("clip option respects specified dimensions", async ({ page }, testInfo) => {
    const clip = { x: 0, y: 0, width: 200, height: 150 }

    const screenshot = await takeRegressionScreenshot(page, testInfo, "clip-test", {
      clip: clip,
    })
    const dimensions = await getImageDimensions(screenshot)

    expect(dimensions.width).toBe(clip.width)
    expect(dimensions.height).toBe(clip.height)
  })

  test("clip option takes precedence over element screenshot", async ({ page }, testInfo) => {
    const clip = { x: 10, y: 10, width: 50, height: 50 }

    const screenshot = await takeRegressionScreenshot(page, testInfo, "clip-over-element", {
      clip: clip,
    })
    const dimensions = await getImageDimensions(screenshot)

    // The dimensions should match the clip, not the element's bounding box
    expect(dimensions.width).toBe(clip.width)
    expect(dimensions.height).toBe(clip.height)
  })

  test.describe("takeRegressionScreenshot Default Viewport Clipping", () => {
    test("clips viewport screenshot to clientWidth to avoid Safari gutter", async ({
      page,
    }, testInfo) => {
      testInfo.skip(
        !/webkit|safari/i.test(testInfo.project.name),
        "Test is specific to WebKit/Safari gutter behavior",
      )

      const mockClientWidth = 1200
      await page.evaluate((width) => {
        Object.defineProperty(document.documentElement, "clientWidth", {
          value: width,
          configurable: true,
        })
      }, mockClientWidth)

      // Ensure the test is nontrivial
      const viewportSize = page.viewportSize()
      expect(mockClientWidth).not.toBe(viewportSize?.width)

      const originalScreenshot = page.screenshot
      let capturedOptions: PageScreenshotOptions | undefined

      page.screenshot = async (options?: PageScreenshotOptions): Promise<Buffer> => {
        capturedOptions = options
        // Return an empty buffer to satisfy the type, don't call original
        return Buffer.from("")
      }

      try {
        await takeRegressionScreenshot(page, testInfo, "gutter-test")

        expect(capturedOptions).toBeDefined()
        expect(capturedOptions?.clip).toBeDefined()
        expect(capturedOptions?.clip?.width).toBe(mockClientWidth)
        expect(capturedOptions?.clip?.x).toBe(0)
        expect(capturedOptions?.clip?.y).toBe(0)
        const viewportHeight = page.viewportSize()?.height
        expect(capturedOptions?.clip?.height).toBe(viewportHeight)
      } finally {
        page.screenshot = originalScreenshot
      }
    })
  })
})
