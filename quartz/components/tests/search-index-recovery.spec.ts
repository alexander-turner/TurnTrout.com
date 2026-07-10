import { type Route } from "@playwright/test"

import { expect, test } from "./fixtures"
import { gotoPage, search } from "./visual_utils"

// A distinctive token so the search query can only match our stubbed index entry.
const RECOVERY_TERM = "uniquerecoveryneedle"
const RECOVERY_TITLE = "Recovery Indexed Page"
const STUB_INDEX = {
  "/recovery-indexed-page": {
    title: RECOVERY_TITLE,
    content: `${RECOVERY_TERM} body content for the recovery scenario`,
    slug: "/recovery-indexed-page",
    authors: [],
    tags: [],
    links: [],
  },
}

test.describe("search index self-heals after the prefetch hangs", () => {
  // When a backgrounded/frozen tab leaves the content-index fetch hung,
  // returning to the tab fires visibilitychange and the loader re-warms the
  // index, so search works without a full page reload.
  test("re-fetches the content index on tab refocus and returns results", async ({ page }) => {
    let calls = 0
    await page.route("**/static/contentIndex.json", async (route: Route) => {
      calls += 1
      if (calls === 1) {
        // Simulate the prefetch started in a since-frozen tab: it never settles.
        // skipcq: JS-0321 -- intentional no-op: executor deliberately never resolves
        await new Promise<void>(() => {})
        return
      }
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(STUB_INDEX) })
    })

    await gotoPage(page, "http://localhost:8080/popover-fixture")

    // The prefetch fired on navigation is hung; wait for it to be in flight.
    await expect.poll(() => calls, { timeout: 15_000 }).toBeGreaterThanOrEqual(1)

    // Simulate returning to the backgrounded tab. The loader's visibilitychange
    // handler discards the hung promise and starts a fresh fetch.
    await page.evaluate(() =>
      // Cast through EventTarget so dispatchEvent accepts a plain Event (the
      // site augments Document.dispatchEvent with its CustomEventMap).
      (document as unknown as EventTarget).dispatchEvent(new Event("visibilitychange")),
    )
    await expect.poll(() => calls, { timeout: 15_000 }).toBeGreaterThanOrEqual(2)

    // Search now resolves against the re-warmed index, no reload required.
    await search(page, RECOVERY_TERM)
    await expect(page.locator(".result-card").first()).toContainText(RECOVERY_TITLE)
  })
})
