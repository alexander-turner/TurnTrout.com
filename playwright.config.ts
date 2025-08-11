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

const deviceList: DeviceConfig[] = [
  {
    name: "Desktop",
    config: {
      viewport: { width: 1920, height: 1080 },
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
      viewport: { width: 390, height: 844 },
    },
  },
]

const browsers: Browser[] = [
  { name: "Chrome", engine: "chromium" },
  { name: "Firefox", engine: "firefox" },
  { name: "Safari", engine: "webkit" },
]

export default defineConfig({
  timeout: process.env.CI ? 180000 : 30000,
  workers: 1, // Parallelism causes flakiness

  retries: 3,
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
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
  },
  projects: deviceList.flatMap((device) =>
    browsers.map((browser) => ({
      name: `${device.name} ${browser.name}`,
      use: {
        ...device.config,
        browserName: browser.engine,
      },
    })),
  ),
})
