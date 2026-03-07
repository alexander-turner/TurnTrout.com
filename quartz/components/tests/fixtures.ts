import { test as base, expect } from "@playwright/test"

import { attachCrashDiagnostics } from "./visual_utils"

/**
 * Extends the base Playwright test to deterministically mock Math.random,
 * preventing the 5% random dropcap color from causing visual test flakiness.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    attachCrashDiagnostics(page)
    await page.addInitScript(() => {
      Math.random = () => 0.5
    })
    await use(page)
  },
})

export { expect }
