import { invertInDarkModeClass } from "../constants"
import { expect, test } from "./fixtures"
import { gotoPage, setTheme } from "./visual_utils"

// Page picked because it has many invert-tagged images and exercises the
// build-time `<picture>` wrapping path. The id is hard-coded so a future
// content change that drops images doesn't silently turn this test into
// a no-op.
const TARGET_URL = "http://localhost:8080/avoiding-side-effects-in-complex-environments"
const EXPECTED_IMAGE_COUNT = 13
const INVERTED_SUFFIX = "-inverted"

test("dark→light theme toggle swaps invert-labeled imgs between original and inverted", async ({
  page,
}) => {
  await gotoPage(page, TARGET_URL, "load")

  // Lazy-loaded images stay undecoded until scrolled into view; force-
  // decode so the JS-driven src swap has something to act on.
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

  // Every invert img is wrapped in <picture> by the transformer. Verify
  // that markup invariant directly — without it, the swap has nothing to
  // hook onto.
  const wrapped = await page.evaluate((selector) => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(selector))
    return imgs.every((img) => img.parentElement?.tagName === "PICTURE")
  }, `img.${invertInDarkModeClass}`)
  expect(wrapped).toBe(true)

  // Force light → dark and confirm every img.src is rewritten to the
  // inverted variant. Then revert to light and confirm src returns
  // to its original value. We don't wait for `data-invert-processed`
  // because that marker fires on `load`, and the inverted variants
  // may 404 on the preview deploy before R2 backfill — the marker
  // would never land, but the swap itself still happens. The yield
  // after each theme change lets the data-theme MutationObserver
  // (which dispatches the sync src-swap) run before we sample.
  const result = await page.evaluate(
    async ({ selector, suffix }) => {
      const yieldNow = () => new Promise((r) => setTimeout(r, 0))
      document.documentElement.setAttribute("data-theme", "light")
      await yieldNow()
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(selector))
      const originalSrcs = imgs.map((img) => img.src)

      document.documentElement.setAttribute("data-theme", "dark")
      await yieldNow()
      const darkSrcs = imgs.map((img) => img.src)

      document.documentElement.setAttribute("data-theme", "light")
      await yieldNow()
      const revertedSrcs = imgs.map((img) => img.src)

      return { originalSrcs, darkSrcs, revertedSrcs, suffix }
    },
    { selector: `img.${invertInDarkModeClass}`, suffix: INVERTED_SUFFIX },
  )

  for (let i = 0; i < result.darkSrcs.length; i++) {
    expect(result.darkSrcs[i]).toContain(result.suffix)
    expect(result.revertedSrcs[i]).toBe(result.originalSrcs[i])
  }
})

test("system-dark + manual-light: <source> srcset overridden so browser serves original", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await gotoPage(page, TARGET_URL, "load")

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

  const result = await page.evaluate(
    async ({ selector, suffix }) => {
      const yieldNow = () => new Promise((r) => setTimeout(r, 0))

      document.documentElement.setAttribute("data-theme", "light")
      await yieldNow()

      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(selector))
      return {
        srcs: imgs.map((img) => img.src),
        sourceSrcsets: imgs.map((img) => {
          const source = img.parentElement?.querySelector("source")
          return source?.srcset ?? ""
        }),
        suffix,
      }
    },
    { selector: `img.${invertInDarkModeClass}`, suffix: INVERTED_SUFFIX },
  )

  for (let i = 0; i < result.srcs.length; i++) {
    expect(result.srcs[i]).not.toContain(result.suffix)
    expect(result.sourceSrcsets[i]).not.toContain(result.suffix)
  }
})

test("dark-mode invert images use normal blend mode, not screen", async ({ page }) => {
  await gotoPage(page, TARGET_URL, "load")
  await setTheme(page, "dark")

  const blendModes = await page.evaluate((selector) => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(selector))
    return imgs.map((img) => getComputedStyle(img).mixBlendMode)
  }, `img.${invertInDarkModeClass}`)

  expect(blendModes.length).toBeGreaterThanOrEqual(EXPECTED_IMAGE_COUNT)
  for (const mode of blendModes) {
    expect(mode).toBe("normal")
  }
})
