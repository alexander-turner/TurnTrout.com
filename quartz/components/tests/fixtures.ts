import type { BrowserContext, Page, Route } from "@playwright/test"

import { test as base, expect } from "@playwright/test"
import { Buffer } from "node:buffer"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, extname, join, resolve, sep } from "node:path"

import { findGitRoot } from "../../util/log"

const CDN_HOSTNAME = "assets.turntrout.com"

// Committed copies of the CDN images that (screenshot) tests capture. Serving
// them locally makes baselines immune to upstream CDN re-encodes AND removes
// the live-network dependency during capture. The set is populated by running
// the visual suite with PIN_SCREENSHOT_ASSETS=refresh (see below), so it stays
// in lockstep with whatever the built pages actually fetch — favicons, twemoji,
// admonition icons and dark-mode inverted variants included, not just the
// images written literally in the Markdown. Large media (audio/video) is
// deliberately left on the live CDN: audio contributes no pixels and a paused
// video frame-0 rarely re-encodes, so pinning ~100 MB into git isn't worth it.
const PINNED_CDN_ASSET_DIR = join(
  findGitRoot(),
  "quartz",
  "components",
  "tests",
  "fixtures",
  "cdn-assets",
)

// When set to "refresh", a (screenshot) run downloads every CDN asset it
// fetches into PINNED_CDN_ASSET_DIR instead of failing on an un-pinned one.
const PIN_REFRESH = process.env.PIN_SCREENSHOT_ASSETS === "refresh"

const CONTENT_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
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
 * Map a CDN pathname to its committed fixture path, guarding against a
 * crafted path escaping the pin directory before any disk access.
 */
function pinnedPathFor(pathname: string): { localPath: string; withinPinDir: boolean } {
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, "")
  const localPath = resolve(PINNED_CDN_ASSET_DIR, relativePath)
  const withinPinDir =
    localPath === PINNED_CDN_ASSET_DIR || localPath.startsWith(PINNED_CDN_ASSET_DIR + sep)
  return { localPath, withinPinDir }
}

/**
 * Fetch an un-pinned asset from the live CDN and write it into the pin
 * directory, then fulfill the request with those bytes. Only reached under
 * PIN_SCREENSHOT_ASSETS=refresh.
 */
async function downloadAndServe(route: Route, localPath: string): Promise<void> {
  const response = await route.fetch()
  const body = await response.body()
  mkdirSync(dirname(localPath), { recursive: true })
  writeFileSync(localPath, body)
  await route.fulfill({ response, body })
}

/**
 * Serve pinned copies of CDN assets from `fixtures/cdn-assets/` so `(screenshot)`
 * captures are byte-deterministic and independent of the live CDN. Audio/video
 * are intentionally not pinned and stream from the CDN. Any other CDN asset the
 * page fetches must be pinned: under refresh mode it is downloaded on the fly,
 * otherwise the URL is recorded in `unpinned` so the caller can fail loudly.
 */
export async function routePinnedCdnAssets(
  target: Page | BrowserContext,
  unpinned: Set<string>,
): Promise<void> {
  await target.route(
    (url) => url.hostname === CDN_HOSTNAME,
    async (route) => {
      const requestUrl = route.request().url()
      const { pathname } = new URL(requestUrl)
      // Audio/video stay on the live CDN by design.
      if (audioVideoPattern.test(pathname)) {
        await route.fallback()
        return
      }
      const { localPath, withinPinDir } = pinnedPathFor(pathname)
      const contentType = CONTENT_TYPE_BY_EXTENSION[extname(localPath).toLowerCase()]
      if (contentType && withinPinDir && existsSync(localPath)) {
        await route.fulfill({ body: readFileSync(localPath), contentType })
      } else if (PIN_REFRESH && contentType && withinPinDir) {
        await downloadAndServe(route, localPath)
      } else {
        // Un-pinned asset: fetch it live so the failing screenshot is still
        // meaningful, but flag it so the test fails and someone pins it.
        unpinned.add(requestUrl)
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
    if (!isScreenshotTest) {
      if (stubCdnAssets) {
        await routeCdnAssetStubs(context)
      }
      // skipcq: JS-0820 -- `use` is Playwright's fixture-yield callback, not a React hook
      await use(context)
      return
    }
    // Baselines must capture real bytes, so don't stub — serve the pinned
    // copies locally so captures don't depend on the live CDN at all.
    const unpinned = new Set<string>()
    await routePinnedCdnAssets(context, unpinned)
    // skipcq: JS-0820 -- `use` is Playwright's fixture-yield callback, not a React hook
    await use(context)
    if (!PIN_REFRESH && unpinned.size > 0) {
      const list = [...unpinned].sort().join("\n  ")
      throw new Error(
        `A (screenshot) capture fetched ${unpinned.size} un-pinned CDN asset(s), so its ` +
          `baseline depends on the live CDN and can drift when the CDN re-encodes them:\n  ` +
          `${list}\n` +
          `Pin them with \`PIN_SCREENSHOT_ASSETS=refresh pnpm test:visual\`, then commit ` +
          `quartz/components/tests/fixtures/cdn-assets/.`,
      )
    }
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
