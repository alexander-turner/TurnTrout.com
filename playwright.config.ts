import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  fullyParallel: true,
  workers: "75%",
  timeout: 30000,

  testDir: "./quartz/components",
  testMatch: /.*\.spec\.ts/,

  // Reporter to use
  reporter: [
    // Use "dot" reporter on CI, "list" otherwise (Playwright default).
    process.env.CI ? ["dot"] : ["list"],
    // Add Argos reporter.
    [
      "@argos-ci/playwright/reporter",
      {
        // Upload to Argos on CI only.
        uploadToArgos: true,

        // Set your Argos token (required if not using GitHub Actions).
        token: process.env.ARGOS_TOKEN,
      },
    ],
  ],

  // Setup recording option to enable test debugging features.
  use: {
    // Collect trace when retrying the failed test.
    trace: "on-first-retry",

    // Capture screenshot after each test failure.
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "Desktop Chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "iPad Pro",
      use: {
        ...devices["iPad Pro"],
      },
    },
    {
      name: "iPhone 12",
      use: {
        ...devices["iPhone 12"],
      },
    },
  ],
})
