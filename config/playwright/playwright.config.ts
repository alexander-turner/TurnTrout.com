// Playwright configuration for cross-browser testing
import { defineConfig, devices } from "@playwright/test"

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
const deviceList: DeviceConfig[] = [
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

const allBrowsers: Browser[] = [
  { name: "Chrome", engine: "chromium" },
  { name: "Firefox", engine: "firefox" },
  { name: "Safari", engine: "webkit" },
]

// CI workflows set PLAYWRIGHT_BROWSERS to run specific engines per OS
// (e.g. "chromium,firefox" on Linux, "webkit" on macOS).
const browsers: Browser[] = process.env.PLAYWRIGHT_BROWSERS
  ? allBrowsers.filter((b) => process.env.PLAYWRIGHT_BROWSERS!.split(",").includes(b.engine))
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

export default defineConfig({
  timeout: 30000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  testDir: "../../quartz/",
  testMatch: /.*\.spec\.ts/,
  snapshotPathTemplate: "../../lost-pixel/{arg}.png",
  reporter: process.env.CI ? "dot" : "list", // Format of test status display
  webServer: {
    command: process.env.CI ? "pnpm serve public -l 8080 > /tmp/webserver.log 2>&1" : "pnpm start",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 7 * 60 * 1000, // 7 minutes
  },
  use: {
    baseURL: "http://localhost:8080",
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
