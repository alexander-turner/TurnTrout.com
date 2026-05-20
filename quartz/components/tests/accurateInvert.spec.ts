import { invertInDarkModeClass, forceHslInvertClass } from "../constants"
import { test, expect } from "./fixtures"
import { gotoPage } from "./visual_utils"

// Page picked because it has 13 invert-tagged images — historically the
// slowest theme-switch on the site and the regression case that motivated
// the closed-form HSL inversion in `accurateInvert.ts`. The page id is
// hard-coded so a future content change that drops images doesn't silently
// turn this test into a no-op.
const TARGET_URL = "http://localhost:8080/avoiding-side-effects-in-complex-environments"
const EXPECTED_IMAGE_COUNT = 13

// 1.0s gives ~6x headroom over the post-fix runtime (~150ms on a CI runner
// with software-rendered canvas) while still flagging a regression to the
// d3-color object-allocating path, which took ~1.5s on the same page.
const BUDGET_MS = 1000

test("theme switch processes inverted images within budget", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "WebKit canvas encode is browser-bound")

  await gotoPage(page, TARGET_URL, "load")

  // Images have `loading="lazy"`, so most stay undecoded until scrolled into
  // view. Force-decode them all by flipping each to `loading="eager"` and
  // awaiting `decode()` — keeps the perf measurement bracketing tight
  // without polling for IntersectionObserver-driven loads.
  await page.evaluate(
    async ({ selector, expected }) => {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(selector))
      if (imgs.length < expected) {
        throw new Error(`expected at least ${expected} invert imgs, found ${imgs.length}`)
      }
      for (const img of imgs) {
        img.loading = "eager"
      }
      await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)))
    },
    { selector: `img.${invertInDarkModeClass}`, expected: EXPECTED_IMAGE_COUNT },
  )

  const durationMs = await page.evaluate(
    async ({ selector }) => {
      // Force light mode first so the dark-mode flip below has work to do.
      document.documentElement.setAttribute("data-theme", "light")
      // Wait one frame so any revert work from the flip to light settles
      // before we start the clock.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(selector))
      const start = performance.now()
      document.documentElement.setAttribute("data-theme", "dark")

      // Poll for the marker the inversion script sets on each processed img.
      // Bracketing in-page with performance.now() avoids visual/timing noise
      // from Playwright IPC.
      await new Promise<void>((resolve, reject) => {
        const deadline = start + 10_000
        const tick = () => {
          if (imgs.every((img) => img.dataset["invertProcessed"] === "1")) {
            resolve()
            return
          }
          if (performance.now() > deadline) {
            reject(new Error("timed out waiting for invert-processed marker"))
            return
          }
          requestAnimationFrame(tick)
        }
        tick()
      })
      return performance.now() - start
    },
    { selector: `img.${invertInDarkModeClass}` },
  )

  expect(durationMs).toBeLessThan(BUDGET_MS)
})

// /reframing-impact carries ~11 invert-tagged imgs and is the page the
// reporter saw the dark→light flash on. Hard-coded so the test isn't a
// no-op if `data-invert-processed` ever stops landing for some reason.
const FLASH_TEST_URL = "http://localhost:8080/reframing-impact"

test("dark→light revert: img bitmap reflects the original within one paint frame", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", "Canvas pixel sampling on CORS imgs is unreliable in WebKit")

  await gotoPage(page, FLASH_TEST_URL, "load")

  await page.evaluate(async (sel) => {
    document.documentElement.setAttribute("data-theme", "dark")
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(sel))
    if (imgs.length === 0) throw new Error("no invert imgs on /reframing-impact")
    for (const img of imgs) img.loading = "eager"
    await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)))
  }, `img.${invertInDarkModeClass}:not(.${forceHslInvertClass})`)

  await page.waitForFunction((sel) => {
    const imgs = document.querySelectorAll<HTMLImageElement>(sel)
    return imgs.length > 0 && Array.from(imgs).every((i) => i.dataset["invertProcessed"] === "1")
  }, `img.${invertInDarkModeClass}:not(.${forceHslInvertClass})`)

  // The bug: while the original-src reload is in flight after dark→light,
  // the <img> keeps painting its previous bitmap (the canvas-inverted
  // one). The fix pins a hidden `new Image()` per processed img to keep
  // the original bitmap in Chromium's renderer cache, so the revert
  // src-swap resolves from cache and the new bitmap paints within one
  // frame. Invariant under test: at the first paint after toggling to
  // light, the sampled pixel from a CORS-clean img must differ from the
  // same pixel sampled pre-toggle (the inverted version).
  const result = await page.evaluate(async (sel) => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(sel))

    // Ensure each img's current (canvas-inverted) bitmap has finished
    // decoding before we sample — without this, the pre-toggle sample
    // can race the data-URL decode and read transparent pixels.
    await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)))

    // Sample a 20×20 block around a target offset and return the average
    // RGB. Averaging is robust to single-pixel oddities (anti-aliased
    // text, transparent edges) that would otherwise produce a meaningless
    // [0,0,0] sample even on a non-black image.
    function sampleBlock(
      im: HTMLImageElement,
      fracX: number,
      fracY: number,
    ): [number, number, number] | null {
      if (im.naturalWidth === 0 || im.naturalHeight === 0) return null
      const c = document.createElement("canvas")
      c.width = im.naturalWidth
      c.height = im.naturalHeight
      const ctx = c.getContext("2d")
      if (!ctx) return null
      try {
        ctx.drawImage(im, 0, 0)
        const x = Math.max(0, Math.min(c.width - 20, Math.floor(c.width * fracX) - 10))
        const y = Math.max(0, Math.min(c.height - 20, Math.floor(c.height * fracY) - 10))
        const data = ctx.getImageData(x, y, 20, 20).data
        let r = 0
        let g = 0
        let b = 0
        const count = data.length / 4
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
        }
        return [Math.round(r / count), Math.round(g / count), Math.round(b / count)]
      } catch {
        return null
      }
    }

    // Pick a CORS-clean img and sample offset where the HSL inversion
    // visibly changes the pixels. Pure greens, reds, blues, magentas are
    // fixed points of the HSL `L → 1-L` mapping; sampling there would
    // make the test blind to a buggy revert (the inverted and original
    // bitmaps look identical at that point). The closed-form inverse is
    // `x + delta` where `delta = 255 - max(rgb) - min(rgb)`, so `|delta|`
    // is exactly the per-channel shift on inversion. Requiring it large
    // guarantees a substantial pixel-distance signal between the two
    // bitmaps at the chosen position.
    const offsets: Array<[number, number]> = [
      [0.5, 0.5],
      [0.25, 0.5],
      [0.75, 0.5],
      [0.5, 0.25],
      [0.5, 0.75],
      [0.25, 0.25],
      [0.75, 0.75],
    ]
    let target: HTMLImageElement | null = null
    let chosenOffset: [number, number] | null = null
    let invertedPixel: [number, number, number] | null = null
    outer: for (const img of imgs) {
      for (const off of offsets) {
        const sample = sampleBlock(img, off[0], off[1])
        if (!sample) continue
        const delta = 255 - Math.max(...sample) - Math.min(...sample)
        if (Math.abs(delta) > 60) {
          target = img
          chosenOffset = off
          invertedPixel = sample
          break outer
        }
      }
    }
    if (!target || !chosenOffset || !invertedPixel) {
      throw new Error("no invert img has a region whose HSL inverse visibly differs")
    }

    document.documentElement.setAttribute("data-theme", "light")
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const afterTogglePixel = sampleBlock(target, chosenOffset[0], chosenOffset[1])
    return { invertedPixel, afterTogglePixel }
  }, `img.${invertInDarkModeClass}:not(.${forceHslInvertClass})`)

  expect(result.afterTogglePixel).not.toBeNull()
  // L1 channel distance from the inverted sample. The chosen offset was
  // pre-filtered so the HSL inverse differs by > 60 per channel of total
  // shift, so a threshold of 30 detects "bitmap actually swapped" while
  // leaving headroom for downscaling/anti-aliasing noise.
  const dr = Math.abs(result.afterTogglePixel![0] - result.invertedPixel[0])
  const dg = Math.abs(result.afterTogglePixel![1] - result.invertedPixel[1])
  const db = Math.abs(result.afterTogglePixel![2] - result.invertedPixel[2])
  expect(dr + dg + db).toBeGreaterThan(30)
})
