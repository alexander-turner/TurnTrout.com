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
  timeout: process.env.CI ? 45000 : 30000, // Increased timeout for larger test sets
  fullyParallel: true,
  workers: process.env.CI ? 4 : "65%",
  retries: process.env.CI ? 1 : 0,
  testDir: "./quartz/",
  testMatch: /.*\.spec\.ts/,
  reporter: process.env.CI ? "dot" : "list", // Format of test status display
  use: {
    trace: "on-first-retry",
    screenshot: {
      mode: "on",
      fullPage: true,
    },
  },
  projects: deviceList.flatMap((device) =>
    browsers.map((browser) => ({
      name: `${device.name} ${browser.name}`,
      use: {
        ...device.config,
        browserName: browser.engine,
        launchOptions: {
          args: process.env.CI
            ? browser.engine === "webkit"
              ? [
                  "--headless",
                  "--disable-gpu",
                  "--disable-extensions",
                  "--disable-background-timer-throttling",
                  "--disable-backgrounding-occluded-windows",
                  "--disable-renderer-backgrounding",
                  "--memory-pressure-off",
                ]
              : [
                  "--no-sandbox",
                  "--disable-setuid-sandbox",
                  "--disable-dev-shm-usage",
                  "--disable-gpu",
                  "--no-zygote",
                  "--disable-extensions",
                  "--disable-background-timer-throttling",
                  "--disable-backgrounding-occluded-windows",
                  "--disable-renderer-backgrounding",
                  "--memory-pressure-off",
                ]
            : [],
        },
      },
    })),
  ),
})
