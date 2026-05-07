import { test as base, expect } from "@playwright/test"

/**
 * Extends the base Playwright test to deterministically mock Math.random,
 * preventing the 5% random dropcap color from causing visual test flakiness.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      Math.random = () => 0.5
    })
    // skipcq: JS-0820 -- `use` is Playwright's fixture-yield callback, not a React hook
    await use(page)
  },
})

export { expect }
