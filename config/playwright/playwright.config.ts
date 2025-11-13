import { defineConfig, devices } from "@playwright/test";

interface DeviceConfig {
  name: string;
  config: {
    viewport?: { width: number; height: number };
    [key: string]: unknown;
  };
}

interface Browser {
  name: string;
  engine: "chromium" | "firefox" | "webkit";
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
      ...devices["iPad Pro"],
    },
  },
  {
    name: "iPhone 12",
    config: {
      ...devices["iPhone 12"],
    },
  },
];

const browsers: Browser[] = [
  { name: "Chrome", engine: "chromium" },
  { name: "Firefox", engine: "firefox" },
  { name: "Safari", engine: "webkit" },
];

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
      isMobile?: unknown;
      [k: string]: unknown;
    };
    return rest;
  }
  return config;
}

export default defineConfig({
  timeout: 30000,
  workers: 1, // Parallelism causes flakiness

  retries: process.env.CI ? 3 : 1,
  testDir: "./quartz/",
  testMatch: /.*\.spec\.ts/,
  snapshotPathTemplate: "lost-pixel/{arg}.png",
  reporter: process.env.CI ? "dot" : "list", // Format of test status display
  webServer: {
    command: "npm run start",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 7 * 60 * 1000, // 3 minutes
  },
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: {
      mode: "on",
      fullPage: true,
    },
    // Stabilize device scale across runners to reduce text subpixel jitter.
    // Individual projects can override, but default to 1x CSS pixels.
    deviceScaleFactor: 1,
  },
  projects: deviceList.flatMap((device) =>
    browsers.map((browser) => ({
      name: `${device.name} ${browser.name}`,
      use: {
        ...sanitizeConfigForBrowser(
          device.config as Record<string, unknown>,
          browser.engine,
        ),
        browserName: browser.engine,
      },
    })),
  ),
});
