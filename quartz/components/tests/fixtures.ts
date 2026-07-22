import type { BrowserContext, Page } from "@playwright/test"

import { test as base, expect } from "@playwright/test"
import { Buffer } from "node:buffer"
import { existsSync, readFileSync } from "node:fs"
import { extname, join, resolve, sep } from "node:path"

import { findGitRoot } from "../../util/log"

const CDN_HOSTNAME = "assets.turntrout.com"

// Committed copies of the raster/vector CDN images that (screenshot) tests
// capture (see scripts/pin_screenshot_assets.py). Serving these locally makes
// baselines immune to upstream CDN re-encodes. Large media (video/audio) is
// deliberately not pinned and still streams from the live CDN.
const PINNED_CDN_ASSET_DIR = join(
  findGitRoot(),
  "quartz",
  "components",
  "tests",
  "fixtures",
  "cdn-assets",
)

const CONTENT_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
}

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

/**
 * Serve pinned copies of CDN images from `fixtures/cdn-assets/` so `(screenshot)`
 * captures are byte-deterministic. Only pinned raster/vector images resolve
 * locally; every other CDN request (video, audio, favicons, un-pinned assets)
 * falls through to the live CDN, so baselines still capture real bytes there.
 */
export async function routePinnedCdnAssets(target: Page | BrowserContext): Promise<void> {
  await target.route(
    (url) => url.hostname === CDN_HOSTNAME,
    async (route) => {
      const { pathname } = new URL(route.request().url())
      const relativePath = decodeURIComponent(pathname).replace(/^\/+/, "")
      const localPath = resolve(PINNED_CDN_ASSET_DIR, relativePath)
      const contentType = CONTENT_TYPE_BY_EXTENSION[extname(localPath).toLowerCase()]
      // Guard against a path escaping the pin directory before touching disk.
      const withinPinDir =
        localPath === PINNED_CDN_ASSET_DIR || localPath.startsWith(PINNED_CDN_ASSET_DIR + sep)
      if (contentType && withinPinDir && existsSync(localPath)) {
        await route.fulfill({ body: readFileSync(localPath), contentType })
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
    if (isScreenshotTest) {
      // Baselines must capture real bytes, so don't stub — but serve the pinned
      // images locally to stay immune to CDN re-encodes.
      await routePinnedCdnAssets(context)
    } else if (stubCdnAssets) {
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
