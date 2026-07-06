// Playwright configuration for cross-browser testing
import { defineConfig, devices } from "@playwright/test"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"

// Playwright resolves a relative `webServer.command` path against
// `webServer.cwd`, which defaults to this config file's directory. The built
// site lives at the repo root (`public/`), so pin the server's cwd there.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

interface DeviceConfig {
  name: string
  config: {
    viewport?: { width: number; height: number }
    [key: string]: unknown
  }
}

interface Browser {
  name: string
  engine: "chromium" | "firefox" | "webkit"
}

// Use robust device presets that include stable layout-affecting fields only
// (viewport, DPR, touch/mobile flags).
const allDevices: DeviceConfig[] = [
  {
    name: "Desktop",
    config: {
      viewport: { width: 1920, height: 1080 },
      isMobile: false,
      hasTouch: false,
    },
  },
  {
    name: "iPad Pro",
    config: {
      ...devices["iPad Pro 11"],
    },
  },
  {
    name: "iPhone 12",
    config: {
      ...devices["iPhone 12"],
    },
  },
]

// Playwright 1.58+ WebKit crashes on mobile device emulation (iPhone/iPad)
// on macOS ARM64 — "page.goto: Page crashed" in every search test.
// Desktop Safari works fine. Mobile coverage comes from Linux Chromium/Firefox.
const isWebKitOnly = process.env.PLAYWRIGHT_BROWSERS === "webkit"
const deviceList: DeviceConfig[] = isWebKitOnly
  ? allDevices.filter((d) => d.name === "Desktop")
  : allDevices

const allBrowsers: Browser[] = [
  { name: "Chrome", engine: "chromium" },
  { name: "Firefox", engine: "firefox" },
  { name: "Safari", engine: "webkit" },
]

// CI workflows set PLAYWRIGHT_BROWSERS to run specific engines per OS
// (e.g. "chromium,firefox" on Linux, "webkit" on macOS).
const playwrightBrowsersEnv = process.env.PLAYWRIGHT_BROWSERS
const browsers: Browser[] = playwrightBrowsersEnv
  ? allBrowsers.filter((b) => playwrightBrowsersEnv.split(",").includes(b.engine))
  : allBrowsers

/**
 * Remove or adjust device options that are not supported by a given browser engine.
 */
function sanitizeConfigForBrowser(
  config: Record<string, unknown>,
  engine: Browser["engine"],
): Record<string, unknown> {
  if (engine === "firefox") {
    // Firefox does not support isMobile
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isMobile: _unused, ...rest } = config as {
      isMobile?: unknown
      [k: string]: unknown
    }
    return rest
  }
  return config
}

// `PLAYWRIGHT_BASE_URL` lets CI rerun selected specs against a deployed
// preview (CF Pages) instead of the local dev server. When it's set we
// skip the `webServer` entirely — the external URL is already up.
const remoteBaseURL = process.env.PLAYWRIGHT_BASE_URL
const baseURL = remoteBaseURL ?? "http://localhost:8080"
const useRemoteBaseURL = remoteBaseURL !== undefined

export default defineConfig({
  timeout: 45_000,
  // Cap total shard runtime in CI so tests fail with output instead of
  // silently hanging until the GitHub Actions job timeout kills them.
  // Each workflow job sets PLAYWRIGHT_GLOBAL_TIMEOUT_MS to ~5 min less
  // than its job timeout-minutes, giving Playwright time to report errors
  // and upload artifacts before GitHub Actions kills the runner.
  globalTimeout: process.env.PLAYWRIGHT_GLOBAL_TIMEOUT_MS
    ? Number(process.env.PLAYWRIGHT_GLOBAL_TIMEOUT_MS)
    : process.env.CI
      ? 45 * 60 * 1000
      : undefined,
  fullyParallel: true,
  // macOS ARM runners have 3 cores but Playwright defaults to 1 worker for
  // WebKit, causing shards to hit their job timeout. Force 3 workers on macOS.
  workers: process.env.PLAYWRIGHT_BROWSERS === "webkit" ? 3 : undefined,
  // The CI retry distinguishes a flaky test from a consistently broken one in
  // the report, but flaky is still a failure: zero-flakiness policy.
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: true,
  testDir: "../../quartz/",
  testMatch: /.*\.spec\.ts/,
  // getScreenshotName already incorporates browser name into the
  // filename so a single flat directory holds all project baselines
  // without collision.
  snapshotPathTemplate: "../../tests/visual-baselines/{arg}.png",
  reporter: process.env.CI ? "dot" : "list", // Format of test status display
  webServer: useRemoteBaseURL
    ? undefined
    : {
        // Local dev rebuilds via `pnpm start`; fixtures must be included so the
        // visual tests can hover/preview them. The per-section fixtures aren't
        // tracked in git, so regenerate them from test-page.md first. CI
        // consumes a pre-built `public/` that already had INCLUDE_FIXTURES=true
        // at build time and downloads the fixtures via the generate-fixtures job.
        command: process.env.CI
          ? "pnpm serve public -l 8080 > /tmp/webserver.log 2>&1"
          : "uv run python scripts/split_test_page_sections.py && INCLUDE_FIXTURES=true pnpm start",
        cwd: repoRoot,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 7 * 60 * 1000, // 7 minutes
      },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: {
      mode: "only-on-failure",
      fullPage: true,
    },
    // Stabilize device scale across runners to reduce text subpixel jitter.
    // Individual projects can override, but default to 1x CSS pixels.
    deviceScaleFactor: 1,
  },
  projects: deviceList
    .flatMap((device) =>
      browsers.map((browser) => ({
        name: `${device.name} ${browser.name}`,
        device,
        browser,
      })),
    )
    .map(({ name, device, browser }) => ({
      name,
      ...(browser.engine === "webkit" ? { timeout: 90_000 } : {}),
      use: {
        ...sanitizeConfigForBrowser(device.config as Record<string, unknown>, browser.engine),
        browserName: browser.engine,
        deviceScaleFactor: 1,
        // CI runners lack a real GPU, so Chromium falls back to SwiftShader
        // (software GL).  These flags disable GPU compositing entirely,
        // avoiding SwiftShader crashes — especially at mobile viewport sizes.
        ...(browser.engine === "chromium"
          ? {
              launchOptions: {
                args: [
                  "--disable-gpu",
                  "--disable-gpu-compositing",
                  "--disable-software-rasterizer",
                  "--disable-dev-shm-usage",
                ],
              },
            }
          : {}),
      },
    })),
})
