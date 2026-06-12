import type { BrowserContext, Page } from "@playwright/test"

import { test as base, expect } from "@playwright/test"
import { Buffer } from "node:buffer"

const CDN_HOSTNAME = "assets.turntrout.com"

// 1x1 transparent PNG; browsers decode by content sniffing, so it satisfies
// requests for any raster format.
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)
const MINIMAL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'

const rasterImagePattern = /\.(?:avif|webp|png|jpe?g|gif|ico)$/i
const audioVideoPattern = /\.(?:mp4|webm|mov|mp3|m4a|ogg)$/i

/**
 * Replace CDN image and audio/video fetches with tiny stub responses so the
 * page `load` event doesn't wait on real asset downloads. Build-time
 * width/height attributes (assetDimensions transformer) fix each element's
 * layout box, so pages render with identical geometry. This keeps navigation
 * cost flat as website_content/test-page.md accumulates media.
 *
 * Non-media CDN requests fall through to the network.
 */
export async function routeCdnAssetStubs(target: Page | BrowserContext): Promise<void> {
  await target.route(
    (url) => url.hostname === CDN_HOSTNAME,
    async (route) => {
      const { pathname } = new URL(route.request().url())
      if (rasterImagePattern.test(pathname)) {
        await route.fulfill({ body: TRANSPARENT_PNG, contentType: "image/png" })
      } else if (pathname.toLowerCase().endsWith(".svg")) {
        await route.fulfill({ body: MINIMAL_SVG, contentType: "image/svg+xml" })
      } else if (audioVideoPattern.test(pathname)) {
        await route.fulfill({ status: 204, body: "" })
      } else {
        await route.fallback()
      }
    },
  )
}

interface SiteTestOptions {
  /**
   * Stub CDN media requests (see routeCdnAssetStubs). Disable via
   * `test.use({ stubCdnAssets: false })` in specs that need real asset bytes,
   * e.g. actual video playback or console-cleanliness of the production page.
   * Screenshot tests are exempted automatically since baselines must capture
   * real assets.
   */
  stubCdnAssets: boolean
}

/**
 * Extends the base Playwright test to deterministically mock Math.random
 * (preventing the 5% random dropcap color from causing visual test flakiness)
 * and to stub CDN media requests for non-screenshot tests.
 */
export const test = base.extend<SiteTestOptions>({
  stubCdnAssets: [true, { option: true }],
  // The route lives on the context so it also covers pages the test opens
  // itself via context.newPage().
  context: async ({ context, stubCdnAssets }, use, testInfo) => {
    const isScreenshotTest = testInfo.titlePath.join(" ").includes("(screenshot)")
    if (stubCdnAssets && !isScreenshotTest) {
      await routeCdnAssetStubs(context)
    }
    // skipcq: JS-0820 -- `use` is Playwright's fixture-yield callback, not a React hook
    await use(context)
  },
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      Math.random = () => 0.5
    })
    // skipcq: JS-0820 -- `use` is Playwright's fixture-yield callback, not a React hook
    await use(page)
  },
})

export { expect }
