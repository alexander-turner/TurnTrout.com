import { test, expect, type PageScreenshotOptions } from "@playwright/test"
import { promises as fs } from "fs"
import sharp from "sharp"

import { type Theme } from "../scripts/darkmode"
import {
  setTheme,
  getNextElementMatchingSelector,
  waitForTransitionEnd,
  isDesktopViewport,
  takeRegressionScreenshot,
  pauseMediaElements,
  showingPreview,
  getH1Screenshots,
  getScreenshotName,
  wrapH1SectionsInSpans,
  getAllWithWait,
} from "./visual_utils"

test.describe("wrapH1SectionsInSpans", () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <article id="content">
            <h1 id="first-h1">First H1</h1>
            <p>Some content after first h1</p>
            <h2>A subtitle</h2>
            <h1 id="second-h1">Second H1</h1>
            <p>Some content after second h1</p>
            <h1 id="third-h1">Third H1</h1>
            <h1 id="fourth-h1">Fourth H1</h1>
            <div>
              <h1 id="fifth-h1">Fifth H1</h1>
              <p>Nested content</p>
            </div>
          </article>
        </body>
      </html>
    `)
  })

  test("wraps each H1 and its subsequent content into a span", async ({ page }) => {
    await wrapH1SectionsInSpans(page)

    const html = await page.innerHTML("body")
    expect(html).toContain('<span id="h1-span-first-h1">')
    expect(html).toContain('<span id="h1-span-second-h1">')
    expect(html).toContain('<span id="h1-span-third-h1">')
    expect(html).toContain('<span id="h1-span-fourth-h1">')
    expect(html).not.toContain('<span id="h1-span-fifth-h1">')
  })

  test("handles pages with no H1 elements gracefully", async ({ page }) => {
    await page.setContent("<html><body><p>No H1s here</p></body></html>")
    await wrapH1SectionsInSpans(page)

    const spans = await page.locator("span[id^='h1-span-']").count()
    expect(spans).toBe(0)
  })

  test("is idempotent and does not re-wrap already wrapped sections", async ({ page }) => {
    // First call
    await wrapH1SectionsInSpans(page)
    const initialSpans = await page.locator("span[id^='h1-span-']").all()
    expect(initialSpans.length).toBe(4)
    const initialHtml = await page.innerHTML("body")

    // Second call
    await wrapH1SectionsInSpans(page)
    const finalSpans = await page.locator("span[id^='h1-span-']").all()
    expect(finalSpans.length).toBe(4)
    const finalHtml = await page.innerHTML("body")

    // The DOM should not have changed
    expect(finalHtml).toEqual(initialHtml)
  })

  test("works correctly with a locator", async ({ page }) => {
    const contentLocator = page.locator("#content")
    await wrapH1SectionsInSpans(contentLocator)

    const spans = await contentLocator.locator("span[id^='h1-span-']").all()
    expect(spans.length).toBe(4)

    const section0 = contentLocator.locator("#h1-span-first-h1")
    await expect(section0.locator("h1").first()).toHaveText("First H1")
  })

  test("splits footnote section into its own span", async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <article id="content">
            <h1 id="main-heading">Main Content</h1>
            <p>Some content</p>
            <section data-footnotes class="footnotes">
              <h1 id="footnote-label" class="sr-only">Footnotes</h1>
              <ol>
                <li id="user-content-fn-1">Footnote 1</li>
              </ol>
            </section>
          </article>
        </body>
      </html>
    `)

    await wrapH1SectionsInSpans(page)

    const html = await page.innerHTML("body")
    // The main heading gets its own span
    expect(html).toContain('<span id="h1-span-main-heading">')
    // The footnote section gets its own span
    expect(html).toContain('<span id="h1-span-footnote-label">')

    // The footnote section is NOT inside the main heading's span
    const mainSpan = page.locator("#h1-span-main-heading")
    await expect(mainSpan.locator("section[data-footnotes]")).toHaveCount(0)

    // The footnote section IS inside its own span
    const footnoteSpan = page.locator("#h1-span-footnote-label")
    await expect(footnoteSpan.locator("section[data-footnotes]")).toHaveCount(1)
  })

  test("footnote span wrapping is idempotent", async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <article id="content">
            <h1 id="main-heading">Main Content</h1>
            <p>Some content</p>
            <section data-footnotes class="footnotes">
              <h1 id="footnote-label" class="sr-only">Footnotes</h1>
              <ol>
                <li id="user-content-fn-1">Footnote 1</li>
              </ol>
            </section>
          </article>
        </body>
      </html>
    `)

    await wrapH1SectionsInSpans(page)
    const initialHtml = await page.innerHTML("body")

    await wrapH1SectionsInSpans(page)
    const finalHtml = await page.innerHTML("body")

    expect(finalHtml).toEqual(initialHtml)
    expect(await page.locator("span[id^='h1-span-']").count()).toBe(2)
  })
})

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

      // Check theme label content via CSS custom property
      const labelContent = await page.evaluate(() => {
        const computedStyle = getComputedStyle(document.documentElement)
        return computedStyle.getPropertyValue("--theme-label-content").replace(/"/g, "")
      })
      const expectedLabel = (theme as string).charAt(0).toUpperCase() + theme.slice(1)
      expect(labelContent).toBe(expectedLabel)

      // Also verify the visual appearance shows the correct text via computed styles
      // Note: The text is displayed via CSS ::after pseudo-element, not textContent
      const actualDisplayedText = await page.evaluate(() => {
        const element = document.querySelector("#theme-label")
        if (!element) return ""
        const computedStyle = getComputedStyle(element, "::after")
        return computedStyle.getPropertyValue("content").replace(/"/g, "")
      })
      expect(actualDisplayedText).toBe(expectedLabel)
    })
  }

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

      // Verify element is stable by checking computed transform is at final position
      await expect
        .poll(async () => {
          const box1 = await element.boundingBox()
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
          const box2 = await element.boundingBox()
          return box1?.x === box2?.x && box1?.y === box2?.y
        })
        .toBe(true)
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

      // Verify both transitions have completed by checking final computed styles
      const finalOpacity = await element.evaluate((el) => window.getComputedStyle(el).opacity)
      const finalTransform = await element.evaluate((el) => window.getComputedStyle(el).transform)

      expect(parseFloat(finalOpacity)).toBeCloseTo(0, 1)
      expect(finalTransform).toContain("100")
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
          <div id="content-above" style="height: 200px; background: red;">Content Above</div>
          <div id="test-element" style="width: 100px; height: 100px; background: blue;">
            <p>Target content</p>
          </div>
          <div id="content-below" style="height: 200px; background: green;">Content Below</div>
        </body>
      </html>
    `)
  })

  // eslint-disable-next-line playwright/expect-expect
  test("screenshot name includes browser and viewport info", async ({ page }, testInfo) => {
    // Since we're mocking the page.screenshot, need to pass in clip option
    await takeRegressionScreenshot(page, testInfo, "test-suffix", {
      clip: { x: 0, y: 0, width: 500, height: 500 },
    })

    const screenshotName = getScreenshotName(testInfo, "test-suffix")
    const expectedPath = testInfo.snapshotPath(screenshotName)

    await fs.access(expectedPath)
  })

  test("element screenshots temporarily hide non-ancestor content", async ({ page }, testInfo) => {
    const element = page.locator("#test-element")

    // Verify content exists before isolation
    await expect(page.locator("#content-above")).toBeVisible()
    await expect(page.locator("#content-below")).toBeVisible()
    await expect(element).toBeVisible()

    await takeRegressionScreenshot(page, testInfo, "isolated-test", {
      elementToScreenshot: element,
    })

    // After screenshot, all content should be restored and visible again
    await expect(page.locator("#content-above")).toBeVisible()
    await expect(page.locator("#content-below")).toBeVisible()
    await expect(element).toBeVisible()
    await expect(element.locator("p")).toBeVisible() // Child should still exist
  })

  test("isolated element screenshot is stable regardless of content above", async ({
    page,
  }, testInfo) => {
    // Take first screenshot with isolation
    const testElementLocator = page.locator("#test-element")
    const screenshot1 = await takeRegressionScreenshot(page, testInfo, "stable-test-1", {
      elementToScreenshot: testElementLocator,
    })

    // Reset page and add more content above
    await page.setContent(`
      <html>
        <body id="test-root" style="width: 1024px; height: 3000px; background: white;">
          <div style="height: 50px; background: yellow;">Extra content line 1</div>
          <div style="height: 75px; background: orange;">Extra content line 2</div>
          <div style="height: 125px; background: purple;">Extra content line 3</div>
          <div id="content-above" style="height: 200px; background: red;">Content Above</div>
          <div id="test-element" style="width: 100px; height: 100px; background: blue;">
            <p>Target content</p>
          </div>
          <div id="content-below" style="height: 200px; background: green;">Content Below</div>
        </body>
      </html>
    `)

    // Take second screenshot with isolation
    const screenshot2 = await takeRegressionScreenshot(page, testInfo, "stable-test-2", {
      elementToScreenshot: testElementLocator,
    })

    // Screenshots should be identical despite different content above
    const dimensions1 = await getImageDimensions(screenshot1)
    const dimensions2 = await getImageDimensions(screenshot2)

    expect(dimensions1.width).toBe(dimensions2.width)
    expect(dimensions1.height).toBe(dimensions2.height)
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
      elementToScreenshot: element,
    })
    const dimensions = await getImageDimensions(screenshot)

    // skipcq: JS-0339
    expect(dimensions.width).toBeCloseTo(elementBox!.width)
    // skipcq: JS-0339
    expect(dimensions.height).toBeCloseTo(elementBox!.height)
  })

  test("clip option respects specified dimensions", async ({ page }, testInfo) => {
    const clip = { x: 0, y: 0, width: 200, height: 150 }

    const screenshot = await takeRegressionScreenshot(page, testInfo, "clip-test", {
      clip,
    })
    const dimensions = await getImageDimensions(screenshot)

    expect(dimensions.width).toBeCloseTo(clip.width)
    expect(dimensions.height).toBeCloseTo(clip.height)
  })

  test("clip option takes precedence over element screenshot", async ({ page }, testInfo) => {
    const clip = { x: 10, y: 10, width: 50, height: 50 }

    const screenshot = await takeRegressionScreenshot(page, testInfo, "clip-over-element", {
      clip,
    })
    const dimensions = await getImageDimensions(screenshot)

    // The dimensions should match the clip, not the element's bounding box
    expect(dimensions.width).toBeCloseTo(clip.width)
    expect(dimensions.height).toBeCloseTo(clip.height)
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
      expect(mockClientWidth).not.toBeCloseTo(viewportSize?.width ?? 0)

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
        expect(capturedOptions?.clip?.width).toBeCloseTo(mockClientWidth)
        expect(capturedOptions?.clip?.x).toBe(0)
        expect(capturedOptions?.clip?.y).toBe(0)
        const viewportHeight = page.viewportSize()?.height
        expect(capturedOptions?.clip?.height).toBeCloseTo(viewportHeight ?? 0)
      } finally {
        page.screenshot = originalScreenshot
      }
    })
  })
})

test.describe("getH1Screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(`
      <html>
        <body style="margin: 0; padding: 0;">
          <h1>First H1</h1>
          <p>Some content</p>
          <h1>Second H1</h1>
          <p>More content</p>
          <h1>Third H1</h1>
        </body>
      </html>
    `)
  })

  for (const theme of ["light", "dark"]) {
    test(`captures a screenshot for each section between H1s in ${theme} theme`, async ({
      page,
    }, testInfo) => {
      await getH1Screenshots(page, testInfo, null, theme as "light" | "dark")

      const h1Spans = await page.locator("span[id^='h1-section-']").all()
      for (let i = 0; i < h1Spans.length; i++) {
        const screenshotName = getScreenshotName(testInfo, `section-${theme}-${i}`)
        const screenshotPath = testInfo.snapshotPath(screenshotName)
        expect(await fs.stat(screenshotPath)).not.toBeNull()
      }
    })
  }
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

    for (const el of [video1, video2]) {
      expect(await el.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true)
      expect(await el.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeCloseTo(0)
    }

    expect(await audio1.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true)
    expect(await audio1.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeCloseTo(0)
  })

  test("seeks audio to end when duration is available", async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <audio id="audio-with-duration" src="test.mp3" controls></audio>
        </body>
      </html>
    `)

    // Mock the audio file
    await page.route("**/test.mp3", (route) => {
      route.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.from("") })
    })

    const audio = page.locator("#audio-with-duration")

    // Mock audio element with proper duration and readyState already loaded
    const maxLength = 42.5
    await audio.evaluate((el: HTMLAudioElement, maxLen: number) => {
      Object.defineProperty(el, "duration", {
        get: () => maxLen,
        configurable: true,
      })
      Object.defineProperty(el, "readyState", {
        get: () => 1, // HAVE_METADATA
        configurable: true,
      })
    }, maxLength)

    await pauseMediaElements(page)

    expect(await audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true)
    expect(await audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeCloseTo(maxLength)
  })

  test("waits for metadata when audio duration is not immediately available", async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <audio id="audio-loading" src="loading.mp3" controls></audio>
        </body>
      </html>
    `)

    // Mock the audio file
    await page.route("**/loading.mp3", (route) => {
      route.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.from("") })
    })

    const audio = page.locator("#audio-loading")

    // Mock audio element that loads metadata asynchronously
    const maxLength = 30.0
    await audio.evaluate((el: HTMLAudioElement, maxLen: number) => {
      let durationValue = NaN
      let readyStateValue = 0
      Object.defineProperty(el, "duration", {
        get: () => durationValue,
        configurable: true,
      })
      Object.defineProperty(el, "readyState", {
        get: () => readyStateValue,
        configurable: true,
      })
      el.currentTime = 5.0

      // Override load() to simulate metadata becoming available
      const originalLoad = el.load.bind(el)
      el.load = () => {
        originalLoad()
        setTimeout(() => {
          durationValue = maxLen
          readyStateValue = 1 // HAVE_METADATA
          el.dispatchEvent(new Event("loadedmetadata"))
        }, 100)
      }
    }, maxLength)

    await pauseMediaElements(page)

    expect(await audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true)
    expect(await audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeCloseTo(maxLength)
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

test.describe("getAllWithWait", () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <div class="item">Item 1</div>
          <div class="item">Item 2</div>
          <div class="item">Item 3</div>
        </body>
      </html>
    `)
  })

  test("returns all matching elements when visible", async ({ page }) => {
    const items = await getAllWithWait(page.locator(".item"))
    expect(items).toHaveLength(3)

    const texts = await Promise.all(items.map((item) => item.textContent()))
    expect(texts).toEqual(["Item 1", "Item 2", "Item 3"])
  })

  test("waits for elements to become visible before returning", async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <div class="delayed" style="display: none;">Delayed 1</div>
          <div class="delayed" style="display: none;">Delayed 2</div>
        </body>
      </html>
    `)

    // Show elements after a delay
    setTimeout(async () => {
      await page.evaluate(() => {
        document.querySelectorAll(".delayed").forEach((el) => {
          ;(el as HTMLElement).style.display = "block"
        })
      })
    }, 100)

    const items = await getAllWithWait(page.locator(".delayed"))
    expect(items).toHaveLength(2)

    const texts = await Promise.all(items.map((item) => item.textContent()))
    expect(texts).toEqual(["Delayed 1", "Delayed 2"])
  })

  test("handles dynamically added elements", async ({ page }) => {
    await page.setContent("<html><body></body></html>")

    // Add elements after a delay
    setTimeout(async () => {
      await page.evaluate(() => {
        const body = document.body
        for (let i = 1; i <= 3; i++) {
          const div = document.createElement("div")
          div.className = "dynamic"
          div.textContent = `Dynamic ${i}`
          body.appendChild(div)
        }
      })
    }, 100)

    const items = await getAllWithWait(page.locator(".dynamic"))
    expect(items).toHaveLength(3)
  })

  test("throws timeout error when no elements exist", async ({ page }) => {
    await page.setContent("<html><body></body></html>")

    await expect(async () => {
      await getAllWithWait(page.locator(".nonexistent"))
    }).rejects.toThrow()
  })
})
