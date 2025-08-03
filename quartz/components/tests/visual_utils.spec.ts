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
  takeScreenshotAfterElement,
  waitForThemeTransition,
  pauseMediaElements,
  showingPreview,
  waitForViewportImagesToLoad,
} from "./visual_utils"

// A 1x1 transparent PNG, crucial for getting a valid naturalWidth > 0 in tests.
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
)

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
      // eslint-disable-next-line playwright/no-conditional-in-test
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

      // Take screenshot after transition and verify stability
      const immediatePostTransitionScreenshot = await element.screenshot()
      await expect
        .poll(async () => element.screenshot(), {
          intervals: [10, 50],
          timeout: 500,
        })
        .toEqual(immediatePostTransitionScreenshot)
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

      // Verify no more changes using expect.poll
      await expect
        .poll(async () => element.screenshot(), {
          // Check quickly, then slightly longer intervals
          intervals: [10, 50],
          // Max time to wait for stability
          timeout: 500,
        })
        .toEqual(postTransitionScreenshot)
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
      // eslint-disable-next-line playwright/no-conditional-in-test
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

  test("generates full page screenshot with correct dimensions", async ({ page }, testInfo) => {
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
    test.fail(!elementBox, "Could not get element bounding box")

    const screenshot = await takeRegressionScreenshot(page, testInfo, "element-test", {
      element: "#test-element",
    })
    const dimensions = await getImageDimensions(screenshot)

    // skipcq: JS-0339
    expect(dimensions.width).toBe(elementBox!.width)
    // skipcq: JS-0339
    expect(dimensions.height).toBe(elementBox!.height)
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

  test("clip option takes precedence over element screenshot", async ({ page }, testInfo) => {
    const clip = { x: 10, y: 10, width: 50, height: 50 }

    const screenshot = await takeRegressionScreenshot(page, testInfo, "clip-over-element", {
      clip,
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

test.describe("takeScreenshotAfterElement", () => {
  test.beforeEach(async ({ page }) => {
    // Set up a more complex DOM for testing element relationships
    await page.setContent(`
      <html>
        <body style="margin: 0; padding: 20px; background: white;">
          <div id="parent" style="width: 500px; padding: 10px; border: 1px solid black;">
            <h1 id="header1" style="margin-top: 30px; height: 50px; background: lightblue;">Header 1</h1>
            <p style="height: 100px; background: lightcoral;">Paragraph 1</p>
            <h2 id="header2" style="margin-top: 40px; height: 60px; background: lightgreen;">Header 2</h2>
            <p style="height: 150px; background: lightgoldenrodyellow;">Paragraph 2</p>
          </div>
        </body>
      </html>
    `)
    // Ensure viewport is large enough
    await page.setViewportSize({ width: 800, height: 600 })
  })

  test("takes screenshot starting from the element with specified height and parent width", async ({
    page,
  }, testInfo) => {
    const startElement = page.locator("#header2")
    const parentElement = page.locator("#parent")
    const screenshotHeight = 200
    const testSuffix = "after-h2"

    // Spy on page.screenshot to capture its arguments
    const originalPageScreenshot = page.screenshot.bind(page)
    let capturedOptions: PageScreenshotOptions | undefined

    page.screenshot = async (options?: PageScreenshotOptions): Promise<Buffer> => {
      capturedOptions = options
      return Buffer.from("")
    }

    try {
      await takeScreenshotAfterElement(page, testInfo, startElement, screenshotHeight, testSuffix)
    } finally {
      page.screenshot = originalPageScreenshot
    }

    expect(capturedOptions).toBeDefined()
    test.fail(!capturedOptions, "Captured options are undefined")

    const capturedPath = capturedOptions?.path
    expect(capturedPath).toBeDefined()
    expect(capturedPath).toContain(testSuffix)
    expect(capturedPath).toMatch(/lost-pixel\//) // Keep double slash for directory separator
    expect(capturedPath).toMatch(new RegExp(`${testInfo.project.name}\\.png$`))

    // Verify the clip coordinates and dimensions
    const startElementBox = await startElement.boundingBox()
    const parentElementBox = await parentElement.boundingBox()

    expect(startElementBox).not.toBeNull()
    expect(parentElementBox).not.toBeNull()

    const capturedClip = capturedOptions?.clip
    expect(capturedClip).toBeDefined()
    test.fail(!capturedClip, "Captured options clip is undefined")

    // @ts-expect-error - capturedClip is defined
    const { x, y, width, height } = capturedClip
    const parentX = parentElementBox?.x
    expect(x).toBeCloseTo(parentX)

    const startElementY = startElementBox?.y
    expect(y).toBeCloseTo(startElementY)

    const parentWidth = parentElementBox?.width
    expect(width).toBeCloseTo(parentWidth)
    expect(height).toBe(screenshotHeight)
    expect(capturedOptions?.animations).toBe("disabled")
  })
})

test.describe("waitForThemeTransition", () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(`
      <html>
        <head>
          <style>
            :root {
              --background-primary: white;
              --text-primary: black;
            }
            :root[data-theme="dark"] {
              --background-primary: black;
              --text-primary: white;
            }
            body {
              background-color: var(--background-primary);
              color: var(--text-primary);
            }
            .temporary-transition body {
              transition: background-color 0.1s ease-in-out;
            }
          </style>
        </head>
        <body></body>
      </html>
    `)
  })

  test("resolves immediately if theme does not visually change", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" })
    // Set initial theme directly
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"))

    const start = Date.now()
    // Set theme to the same value
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "light")
    })
    await waitForThemeTransition(page)
    const duration = Date.now() - start
    expect(duration).toBeLessThan(100)
  })
})
test.describe("pauseMediaElements", () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <video id="video1" src="movie.mp4" controls></video>
          <audio id="audio1" src="sound.mp3" controls></audio>
          <video id="video2" src="another.mp4"></video>
          <div id="not-media"></div>
        </body>
      </html>
    `)
    // Mock media sources to prevent actual loading/errors
    await page.route("**/*.{mp4,mp3}", (route) => {
      route.fulfill({ status: 200, contentType: "video/mp4", body: Buffer.from("") })
    })
  })

  test("pauses video and audio elements", async ({ page }) => {
    const video1 = page.locator("#video1")
    const audio1 = page.locator("#audio1")
    const video2 = page.locator("#video2")

    // Start playing (mock)
    for (const el of [video1, audio1, video2]) {
      await el.evaluate((el: HTMLVideoElement | HTMLAudioElement) =>
        el.play().catch(() => {
          // Mock play() can reject if media is not loaded, which is fine
        }),
      )
    }

    await pauseMediaElements(page)

    for (const el of [video1, audio1, video2]) {
      expect(await el.evaluate((el: HTMLVideoElement | HTMLAudioElement) => el.paused)).toBe(true)
      expect(await el.evaluate((el: HTMLVideoElement | HTMLAudioElement) => el.currentTime)).toBe(
        0, // Should be at end, but there's no duration on mock video
      )
    }
  })

  test("does not affect non-media elements", async ({ page }) => {
    const notMedia = page.locator("#not-media")
    const initialHtml = await notMedia.innerHTML()

    await pauseMediaElements(page)

    expect(await notMedia.innerHTML()).toBe(initialHtml)
  })
})

test.describe("showingPreview", () => {
  const viewports = [
    { width: 1580, height: 800, expected: true }, // Desktop
    { width: 1024, height: 768, expected: true }, // Tablet landscape (above breakpoint)
    { width: 991, height: 768, expected: false }, // Tablet portrait (below breakpoint)
    { width: 800, height: 600, expected: false }, // Smaller Tablet
    { width: 480, height: 800, expected: false }, // Mobile
  ]

  for (const { width, height, expected } of viewports) {
    test(`returns ${expected} for viewport ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      expect(showingPreview(page)).toBe(expected)
    })
  }
})

test.describe("waitForViewportImagesToLoad", () => {
  const viewportHeight = 600
  const imageDomain = "https://example.com"
  test.beforeEach(async ({ page }) => {
    test.skip(!isDesktopViewport(page), "only need to run tests once on fixed viewport")
    await page.setViewportSize({ width: 800, height: viewportHeight })
  })

  test("waits for all images inside the viewport", async ({ page }) => {
    let image1Loaded = false
    await page.route(`${imageDomain}/image1.png`, (route) => {
      setTimeout(() => {
        image1Loaded = true
        route.fulfill({ status: 200, contentType: "image/png", body: tinyPng })
      }, 100)
    })

    let image2Loaded = false
    await page.route(`${imageDomain}/image2.png`, (route) => {
      setTimeout(() => {
        image2Loaded = true
        route.fulfill({ status: 200, contentType: "image/png", body: tinyPng })
      }, 5000)
    })

    await page.setContent(`
      <img src="${imageDomain}/image1.png" loading="eager" style="width:100px; height:100px;">
      <img src="${imageDomain}/image2.png" loading="lazy" style="margin-top: ${2 * viewportHeight}px;">
    `)

    await waitForViewportImagesToLoad(page)

    expect(image1Loaded).toBe(true)
    expect(image2Loaded).toBe(false)
  })

  test("does not wait for lazy images outside the viewport", async ({ page }) => {
    let imageLoaded = false
    await page.route("**/lazy-out-of-view.png", (route) => {
      setTimeout(() => {
        imageLoaded = true
        route.fulfill({ status: 200, contentType: "image/png", body: tinyPng })
      }, 5000)
    })

    await page.setContent(`
      <img src="${imageDomain}/lazy-out-of-view.png" loading="lazy" style="width:100px; height:100px; margin-top: ${2 * viewportHeight}px;">
    `)

    await waitForViewportImagesToLoad(page)

    expect(imageLoaded).toBe(false)
  })

  test("waits for lazy images inside the viewport", async ({ page }) => {
    let imageLoaded = false
    await page.route("**/lazy-in-view.png", (route) => {
      setTimeout(() => {
        imageLoaded = true
        route.fulfill({ status: 200, contentType: "image/png", body: tinyPng })
      }, 100)
    })

    await page.setContent(`
      <img src="${imageDomain}/lazy-in-view.png" loading="lazy" style="width:100px; height:100px;">
    `)

    await waitForViewportImagesToLoad(page)
    expect(imageLoaded).toBe(true)
  })

  test("returns before an out-of-viewport lazy image finishes loading", async ({ page }) => {
    await page.route("**/eager-in-view.png", (route) => {
      route.fulfill({ status: 200, contentType: "image/png", body: tinyPng })
    })

    let lazyImageFulfilled = false
    await page.route("**/lazy-out-of-view.png", async (route) => {
      // Lazy image has a long delay to simulate slow loading.
      await new Promise((resolve) => setTimeout(resolve, 300))
      lazyImageFulfilled = true
      route.fulfill({ status: 200, contentType: "image/png", body: tinyPng })
    })

    await page.setContent(`
      <img src="${imageDomain}/eager-in-view.png" id="eager-in-view" loading="eager" style="width:50px; height:50px;">
      <img src="${imageDomain}/lazy-out-of-view.png" id="lazy-out-of-view" loading="lazy" style="width:50px; height:50px; margin-top: ${2 * viewportHeight}px;">
    `)

    const startTime = Date.now()
    await waitForViewportImagesToLoad(page)
    const duration = Date.now() - startTime

    expect(duration).toBeLessThan(300)
    expect(lazyImageFulfilled).toBe(false)
  })
})
