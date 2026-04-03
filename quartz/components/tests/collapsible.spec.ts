import type { Page } from "@playwright/test"

import { test, expect } from "./fixtures"
import { gotoPage, reloadPage } from "./visual_utils"

// Helper to get collapsible admonitions
const getCollapsibles = (page: Page) => page.locator(".admonition.is-collapsible")
const getCollapsibleId = (locator: import("@playwright/test").Locator) =>
  locator.evaluate((el) => (el as HTMLElement).dataset.collapsibleId)

/** Assert that an admonition's collapsed state was persisted to localStorage. */
async function expectStoredState(
  page: Page,
  admonition: import("@playwright/test").Locator,
  isCollapsed: boolean,
): Promise<void> {
  const id = await getCollapsibleId(admonition)
  const stored = await page.evaluate((key) => localStorage.getItem(key ?? ""), id)
  expect(stored).toBe(isCollapsed ? "true" : "false")
}

/** Wait for all collapsible admonitions to have their content-based IDs assigned.
 *  The IDs are set by admonition.inline.js (on the "nav" event), which hashes the
 *  title text. Waiting ensures title text is loaded so hashes are injective. */
async function waitForCollapsibleIds(page: Page): Promise<void> {
  await expect(async () => {
    const ids = await getCollapsibles(page).evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).dataset.collapsibleId),
    )
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(id).toBeDefined()
    }
  }).toPass({ timeout: 10_000 })
}

async function spaNavigateToAbout(page: Page): Promise<void> {
  await page.evaluate(() => window.spaNavigate(new URL("/about", window.location.origin)))
  await page.waitForURL("**/about")
  await expect(page.locator('body[data-slug="about"]')).toBeAttached()
}

async function goBackToTestPage(page: Page): Promise<void> {
  await page.goBack()
  await page.waitForURL("**/test-page")
  await expect(page.locator('body[data-slug="test-page"]')).toBeAttached()
}

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "http://localhost:8080/test-page")
  await waitForCollapsibleIds(page)
})

test.describe("Collapsible admonition state persistence", () => {
  test("collapsibles have stable content-based IDs", async ({ page }) => {
    const collapsibles = getCollapsibles(page)
    const count = await collapsibles.count()
    expect(count).toBeGreaterThan(0)

    // Get IDs
    const ids = await collapsibles.evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).dataset.collapsibleId),
    )

    // All IDs should be defined and match the expected pattern
    for (const id of ids) {
      expect(id).toMatch(/^test-page-collapsible-[0-9a-f]{8}-\d+$/)
    }

    // IDs should be unique
    expect(new Set(ids).size).toBe(ids.length)
  })

  test("toggling state persists to localStorage", async ({ page }) => {
    const collapsibles = getCollapsibles(page)
    const first = collapsibles.first()

    // Get initial state
    const initiallyCollapsed = await first.evaluate((el) => el.classList.contains("is-collapsed"))

    // Click title to toggle
    await first.locator(".admonition-title").click()

    // Verify state changed and localStorage updated
    const newState = await first.evaluate((el) => el.classList.contains("is-collapsed"))
    expect(newState).toBe(!initiallyCollapsed)
    await expectStoredState(page, first, newState)
  })

  test("collapsing an open admonition persists across reload", async ({ page }) => {
    // Use state-independent locator (no :not(.is-collapsed)) so it still
    // matches after the class changes
    const admonition = page
      .locator(".admonition.is-collapsible")
      .filter({ hasText: "starts off open" })
    await expect(admonition).not.toHaveClass(/is-collapsed/)

    // Collapse it
    await admonition.locator(".admonition-title").click()
    await expect(admonition).toHaveClass(/is-collapsed/)

    await expectStoredState(page, admonition, true)

    // Reload page and verify it stayed collapsed
    await reloadPage(page)
    await waitForCollapsibleIds(page)
    const reloaded = page
      .locator(".admonition.is-collapsible")
      .filter({ hasText: "starts off open" })
    await expect(reloaded).toBeAttached()
    await expect(reloaded).toHaveClass(/is-collapsed/)
  })

  test("opening a collapsed admonition persists across reload", async ({ page }) => {
    const admonition = page
      .locator(".admonition.is-collapsible")
      .filter({ hasText: "starts off collapsed" })
    await expect(admonition).toHaveClass(/is-collapsed/)

    // Open it
    await admonition.locator(".admonition-title").click()
    await expect(admonition).not.toHaveClass(/is-collapsed/)

    await expectStoredState(page, admonition, false)

    // Reload page and verify it stayed open
    await reloadPage(page)
    await waitForCollapsibleIds(page)
    const reloaded = page
      .locator(".admonition.is-collapsible")
      .filter({ hasText: "starts off collapsed" })
    await expect(reloaded).toBeAttached()
    await expect(reloaded).not.toHaveClass(/is-collapsed/)
  })

  test("state persists across SPA navigation", async ({ page }) => {
    // Collapse the initially-open admonition
    const admonition = page
      .locator(".admonition.is-collapsible")
      .filter({ hasText: "starts off open" })
    await expect(admonition).not.toHaveClass(/is-collapsed/)
    await admonition.locator(".admonition-title").click()
    await expect(admonition).toHaveClass(/is-collapsed/)

    // Navigate away using SPA navigation
    await spaNavigateToAbout(page)

    // Navigate back
    await goBackToTestPage(page)
    await waitForCollapsibleIds(page)

    // Verify state persisted
    const afterNav = page
      .locator(".admonition.is-collapsible")
      .filter({ hasText: "starts off open" })
    await expect(afterNav).toBeAttached()
    await expect(afterNav).toHaveClass(/is-collapsed/)
  })

  test("clicking content does not close open collapsible", async ({ page }) => {
    // Target the specific "[!info]+ This collapsible admonition starts off open" admonition
    const openCollapsible = page
      .locator(".admonition.is-collapsible:not(.is-collapsed)")
      .filter({ hasText: "starts off open" })

    // Verify it exists and is open
    await expect(openCollapsible).toBeVisible()

    // Click on the content area
    await openCollapsible.locator(".admonition-content").click()

    // Should still be open (not have is-collapsed class)
    await expect(openCollapsible).not.toHaveClass(/is-collapsed/)
  })

  test("IDs remain stable after SPA navigation and back", async ({ page }) => {
    // Get initial IDs
    const initialIds = await getCollapsibles(page).evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).dataset.collapsibleId),
    )

    // Navigate away and back
    await spaNavigateToAbout(page)
    await goBackToTestPage(page)
    await waitForCollapsibleIds(page)

    // Get IDs after navigation
    const idsAfterNav = await getCollapsibles(page).evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).dataset.collapsibleId),
    )

    // IDs should be identical
    expect(idsAfterNav).toEqual(initialIds)
  })

  test("state is restored before first paint (no layout shift)", async ({ browser }) => {
    // Create a fresh context with localStorage pre-set BEFORE any navigation
    const context = await browser.newContext()
    const page = await context.newPage()

    // First, visit the page to get collapsible IDs
    await gotoPage(page, "http://localhost:8080/test-page")
    await waitForCollapsibleIds(page)

    const collapsibleData = await getCollapsibles(page).evaluateAll((els) =>
      els.map((el) => ({
        id: (el as HTMLElement).dataset.collapsibleId,
        defaultCollapsed: el.classList.contains("is-collapsed"),
      })),
    )
    expect(collapsibleData.length).toBeGreaterThan(0)

    // Pick a collapsible and set its localStorage to the OPPOSITE of its default
    const target = collapsibleData[0]
    const savedState = !target.defaultCollapsed

    // Set localStorage directly
    await page.evaluate(
      ({ id, collapsed }) => {
        localStorage.setItem(id, collapsed ? "true" : "false")
      },
      { id: target.id as string, collapsed: savedState },
    )

    // Set up CLS monitoring before reload
    await page.addInitScript(() => {
      ;(window as unknown as { __cls: number }).__cls = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as PerformanceEntry & { hadRecentInput: boolean }).hadRecentInput) {
            ;(window as unknown as { __cls: number }).__cls += (
              entry as PerformanceEntry & { value: number }
            ).value
          }
        }
      }).observe({ type: "layout-shift", buffered: true })
    })

    // Reload the page - localStorage should persist, and state should be applied before paint
    await reloadPage(page)
    await waitForCollapsibleIds(page)

    // Verify the state was correctly applied (opposite of default)
    const actualState = await page
      .locator(".admonition.is-collapsible")
      .first()
      .evaluate((el) => el.classList.contains("is-collapsed"))
    expect(actualState).toBe(savedState)

    // Check that CLS is minimal (no layout shift from state restoration)
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
    expect(cls).toBeLessThan(0.1) // CLS < 0.1 is considered "good"

    await context.close()
  })
})
