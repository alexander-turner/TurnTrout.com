import type { Page } from "@playwright/test"

import { test, expect } from "./fixtures"

// Helper to get collapsible admonitions
const getCollapsibles = (page: Page) => page.locator(".admonition.is-collapsible")

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
  await page.goto("http://localhost:8080/test-page", { waitUntil: "domcontentloaded" })
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

    // Get initial state and ID
    const initiallyCollapsed = await first.evaluate((el) => el.classList.contains("is-collapsed"))
    const id = await first.evaluate((el) => (el as HTMLElement).dataset.collapsibleId)
    expect(id).toBeDefined()

    // Click title to toggle
    await first.locator(".admonition-title").click()

    // Verify state changed
    const newState = await first.evaluate((el) => el.classList.contains("is-collapsed"))
    expect(newState).toBe(!initiallyCollapsed)

    // Verify localStorage was updated
    const stored = await page.evaluate(
      (collapsibleId) => localStorage.getItem(collapsibleId),
      id as string,
    )
    expect(stored).toBe(newState ? "true" : "false")
  })

  test("state persists across page reload", async ({ page }) => {
    const collapsibles = getCollapsibles(page)
    const first = collapsibles.first()

    // Get initial state
    const initiallyCollapsed = await first.evaluate((el) => el.classList.contains("is-collapsed"))

    // Toggle state
    await first.locator(".admonition-title").click()
    const toggledState = !initiallyCollapsed

    // Reload page
    await page.reload({ waitUntil: "load" })

    // Verify state persisted
    const stateAfterReload = await getCollapsibles(page)
      .first()
      .evaluate((el) => el.classList.contains("is-collapsed"))
    expect(stateAfterReload).toBe(toggledState)
  })

  test("state persists across SPA navigation", async ({ page }) => {
    const collapsibles = getCollapsibles(page)
    const first = collapsibles.first()

    // Get initial state and toggle
    const initiallyCollapsed = await first.evaluate((el) => el.classList.contains("is-collapsed"))
    await first.locator(".admonition-title").click()
    const toggledState = !initiallyCollapsed

    // Navigate away using SPA navigation
    await spaNavigateToAbout(page)

    // Navigate back
    await goBackToTestPage(page)

    // Verify state persisted
    const stateAfterNav = await getCollapsibles(page)
      .first()
      .evaluate((el) => el.classList.contains("is-collapsed"))
    expect(stateAfterNav).toBe(toggledState)
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
    await page.goto("http://localhost:8080/test-page", { waitUntil: "load" })

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
    await page.reload({ waitUntil: "load" })

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
