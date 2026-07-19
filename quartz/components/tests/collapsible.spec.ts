import type { Page } from "@playwright/test"

import { expect, routeCdnAssetStubs, test } from "./fixtures"
import { gotoPage, reloadPage, requireBoundingBox } from "./visual_utils"

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

// This test builds its own browser context and never touches the shared `page`
// fixture, so the shared navigation below is pure overhead for it. Loading
// `/test-page` is the most expensive operation in this file (12-20s on the
// WebKit CI runner), and this test loads it twice on its own; skip the third,
// unused load so the test stays within its time budget.
const TEST_MANAGES_OWN_CONTEXT = "state is restored before first paint (no layout shift)"

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title === TEST_MANAGES_OWN_CONTEXT) {
    return
  }
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

  test("title's pointer cursor and click target cover the full row, including the side padding gutters and top/bottom margins", async ({
    page,
  }) => {
    // Use a state-independent locator (no :not(.is-collapsed)) so it still
    // matches after clicking toggles the class.
    const admonition = page
      .locator(".admonition.is-collapsible")
      .filter({ hasText: "starts off open" })
    const title = admonition.locator(".admonition-title")
    await expect(admonition).not.toHaveClass(/is-collapsed/)
    await title.scrollIntoViewIfNeeded()

    // Measure geometry and hit-test the cursor in a single browser round-trip
    // (rather than combining a Playwright-side boundingBox() with a later
    // elementFromPoint call) so the two never disagree on viewport/scroll state.
    const measurements = await title.evaluate((titleEl) => {
      const admonitionEl = titleEl.closest(".admonition") as HTMLElement
      const contentEl = admonitionEl.querySelector(".admonition-content") as HTMLElement
      const titleRect = titleEl.getBoundingClientRect()
      const admonitionRect = admonitionEl.getBoundingClientRect()
      const contentRect = contentEl.getBoundingClientRect()
      const midY = titleRect.top + titleRect.height / 2
      const midX = titleRect.left + titleRect.width / 2
      const cursorAt = (x: number, y: number) => {
        const el = document.elementFromPoint(x, y)
        return el ? getComputedStyle(el).cursor : null
      }
      return {
        titleLeft: titleRect.left,
        titleRight: titleRect.right,
        titleTop: titleRect.top,
        titleBottom: titleRect.bottom,
        admonitionLeft: admonitionRect.left,
        admonitionRight: admonitionRect.right,
        admonitionTop: admonitionRect.top,
        contentTop: contentRect.top,
        cursorNearLeftEdge: cursorAt(titleRect.left + 2, midY),
        cursorNearRightEdge: cursorAt(titleRect.right - 2, midY),
        cursorNearTopEdge: cursorAt(midX, titleRect.top + 2),
        cursorNearBottomEdge: cursorAt(midX, titleRect.bottom - 2),
      }
    })

    // The title's box must reach the admonition's left/right edges and the
    // admonition's top edge -- it shouldn't stop short at the inner content
    // padding/margin, leaving un-hoverable/unclickable gutters.
    const EDGE_TOLERANCE_PX = 3
    expect(measurements.titleLeft - measurements.admonitionLeft).toBeLessThan(EDGE_TOLERANCE_PX)
    expect(measurements.admonitionRight - measurements.titleRight).toBeLessThan(EDGE_TOLERANCE_PX)
    expect(measurements.titleTop - measurements.admonitionTop).toBeLessThan(EDGE_TOLERANCE_PX)
    // The title's bottom margin sits above the content, not the admonition's
    // own bottom edge (there's more content below), so compare against that.
    expect(measurements.contentTop - measurements.titleBottom).toBeLessThan(EDGE_TOLERANCE_PX)

    // Cursor should be a pointer right at each edge of the title row (inside the
    // gutters/margins that used to fall outside the title's box), not just over
    // the icon/text.
    expect(measurements.cursorNearLeftEdge).toBe("pointer")
    expect(measurements.cursorNearRightEdge).toBe("pointer")
    expect(measurements.cursorNearTopEdge).toBe("pointer")
    expect(measurements.cursorNearBottomEdge).toBe("pointer")

    // Clicking in the gutter itself (not just the visible icon/text) should
    // toggle the admonition, proving the extended box is actually clickable.
    // `position` is relative to the title's own box, so it stays correct
    // across viewports/devices without any manual coordinate math.
    const titleBox = await requireBoundingBox(title)
    await title.click({ position: { x: 2, y: titleBox.height / 2 } })
    await expect(admonition).toHaveClass(/is-collapsed/)
  })

  test("content-meta metadata title spacing is not doubled and covers the full row", async ({
    page,
  }) => {
    // The backlinks ("Links to this page") admonition in #content-meta carries
    // its own ID-scoped title margins. Its block spacing must come from padding
    // (a single, clickable source with zero block margin) while the inline
    // gutter comes from the general rule's negative inline margin. Verify both
    // in the default (collapsed) and expanded states.
    const admonition = page.locator("#content-meta .admonition-metadata.is-collapsible")
    const title = admonition.locator(".admonition-title")
    await expect(admonition).toBeAttached()
    await title.scrollIntoViewIfNeeded()

    // 3px absorbs the admonition's ~1px border in the edge deltas.
    const EDGE_TOLERANCE_PX = 3

    const measure = () =>
      title.evaluate((titleEl) => {
        const admonitionEl = titleEl.closest(".admonition") as HTMLElement
        const contentEl = admonitionEl.querySelector(".admonition-content") as HTMLElement
        const titleRect = titleEl.getBoundingClientRect()
        const admonitionRect = admonitionEl.getBoundingClientRect()
        const contentRect = contentEl.getBoundingClientRect()
        const titleStyle = getComputedStyle(titleEl)
        const midY = titleRect.top + titleRect.height / 2
        const cursorAt = (x: number, y: number) => {
          const el = document.elementFromPoint(x, y)
          return el ? getComputedStyle(el).cursor : null
        }
        return {
          titleLeft: titleRect.left,
          titleRight: titleRect.right,
          titleTop: titleRect.top,
          titleBottom: titleRect.bottom,
          admonitionLeft: admonitionRect.left,
          admonitionRight: admonitionRect.right,
          admonitionTop: admonitionRect.top,
          contentTop: contentRect.top,
          contentVisible: contentEl.offsetParent !== null,
          marginTop: titleStyle.marginTop,
          marginBottom: titleStyle.marginBottom,
          cursorNearLeftEdge: cursorAt(titleRect.left + 2, midY),
          cursorNearRightEdge: cursorAt(titleRect.right - 2, midY),
        }
      })

    const assertFullRow = (m: Awaited<ReturnType<typeof measure>>) => {
      // Block spacing is padding, not margin -- a block margin would stack on
      // the general rule's padding.
      expect(m.marginTop).toBe("0px")
      expect(m.marginBottom).toBe("0px")
      // The title box reaches the admonition's top and side edges, so the whole
      // bar (its padding) sits inside the clickable box.
      expect(m.titleTop - m.admonitionTop).toBeLessThan(EDGE_TOLERANCE_PX)
      expect(m.titleLeft - m.admonitionLeft).toBeLessThan(EDGE_TOLERANCE_PX)
      expect(m.admonitionRight - m.titleRight).toBeLessThan(EDGE_TOLERANCE_PX)
      // The inline gutter is clickable, so the cursor is a pointer at each edge.
      expect(m.cursorNearLeftEdge).toBe("pointer")
      expect(m.cursorNearRightEdge).toBe("pointer")
    }

    await expect(admonition).toHaveClass(/is-collapsed/)
    assertFullRow(await measure())

    // Expanded: same invariants, and the title's bottom padding must not stack
    // with a content top margin (that would re-introduce a doubled gap).
    await title.click()
    await expect(admonition).not.toHaveClass(/is-collapsed/)
    const open = await measure()
    assertFullRow(open)
    expect(open.contentVisible).toBe(true)
    expect(open.contentTop - open.titleBottom).toBeLessThan(EDGE_TOLERANCE_PX)
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

  test(TEST_MANAGES_OWN_CONTEXT, async ({ browser }) => {
    // Create a fresh context with localStorage pre-set BEFORE any navigation
    const context = await browser.newContext()
    await routeCdnAssetStubs(context)
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
