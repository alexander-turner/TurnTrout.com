import type { Page } from "@playwright/test"

import { invertInDarkModeClass } from "../constants"
import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// Page picked because it has many invert-tagged images and exercises the
// build-time `<picture>` wrapping path. The id is hard-coded so a future
// content change that drops images doesn't silently turn this test into
// a no-op.
const TARGET_URL = "http://localhost:8080/avoiding-side-effects-in-complex-environments"
const EXPECTED_IMAGE_COUNT = 13
const INVERTED_SUFFIX = "-inverted"

// The swap only acts on decoded images (img.complete && naturalWidth > 0).
// The fixture's stubbed CDN bytes are a decodable 1x1 PNG, which satisfies
// that gate without depending on the live CDN serving every image. Routed
// requests bypass the HTTP cache, so every <source> srcset rewrite re-fetches
// its image; tests decode only after the theme sync they start from.

/**
 * Force-load every invert img and wait until one decode pass resolves for all
 * of them. Lazy images stay undecoded until scrolled into view, and the load
 * handler may swap an img's src mid-decode (rejecting that decode), so a pass
 * that saw a swap is followed by another. A broken image fails loudly.
 */
async function decodeInvertImages(page: Page): Promise<void> {
  await page.evaluate(
    async ({ selector, expected }) => {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(selector))
      if (imgs.length < expected) {
        throw new Error(`expected at least ${expected} invert imgs, found ${imgs.length}`)
      }
      for (const img of imgs) {
        img.loading = "eager"
      }
      for (;;) {
        const results = await Promise.allSettled(imgs.map((img) => img.decode()))
        if (results.every((r) => r.status === "fulfilled")) return
        const broken = imgs.find((img) => img.complete && img.naturalWidth === 0)
        if (broken) throw new Error(`invert img failed to load: ${broken.src}`)
      }
    },
    { selector: `img.${invertInDarkModeClass}`, expected: EXPECTED_IMAGE_COUNT },
  )
}

test("dark→light theme toggle swaps invert-labeled imgs between original and inverted", async ({
  page,
}) => {
  await gotoPage(page, TARGET_URL, "load")
  await page.evaluate(async () => {
    document.documentElement.setAttribute("data-theme", "light")
    await new Promise((r) => setTimeout(r, 0))
  })
  await decodeInvertImages(page)

  // Every invert img is wrapped in <picture> by the transformer. Verify
  // that markup invariant directly — without it, the swap has nothing to
  // hook onto.
  const wrapped = await page.evaluate((selector) => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(selector))
    return imgs.every((img) => img.parentElement?.tagName === "PICTURE")
  }, `img.${invertInDarkModeClass}`)
  expect(wrapped).toBe(true)

  // Toggle dark and confirm every img.src is rewritten to the inverted
  // variant. Then revert to light and confirm src returns to its original
  // value. The src swap runs synchronously in the data-theme
  // MutationObserver, so the yield after each theme change is enough;
  // `data-invert-processed` only lands on the later `load`.
  const result = await page.evaluate(
    async ({ selector, suffix }) => {
      const yieldNow = () => new Promise((r) => setTimeout(r, 0))
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
  await decodeInvertImages(page)

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
