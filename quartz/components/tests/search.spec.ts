import { type Page, type Locator } from "@playwright/test"

import { tabletBreakpoint } from "../../styles/variables"
import { simpleConstants } from "../constants"
import { test, expect } from "./fixtures"

const { searchPlaceholderDesktop, searchPlaceholderMobile } = simpleConstants
import {
  takeRegressionScreenshot,
  setTheme,
  search,
  getAllWithWait,
  isElementChecked,
  openSearch,
  gotoPage,
  triggerAndWaitForSPANav,
  moveMouseToSafePosition,
} from "./visual_utils"

test.beforeEach(async ({ page }, testInfo) => {
  // Safari/WebKit is consistently slow for search operations in CI.
  // Use setTimeout instead of test.slow() so individual tests can also use
  // test.slow() without triggering no-duplicate-slow lint warnings.
  if (testInfo.project.name.includes("Safari")) {
    test.setTimeout(testInfo.timeout * 3)
  }

  // Log any console errors
  page.on("pageerror", (err) => console.error(err))

  // Navigate and wait for full initialization (including scripts)
  await gotoPage(page, "http://localhost:8080/welcome")

  await expect(page.locator("#search-container")).toBeAttached()
  await expect(page.locator("#search-icon")).toBeVisible()

  // Ensure search is closed at start
  const searchContainer = page.locator("#search-container")
  await expect(searchContainer).not.toHaveClass(/active/)

  await openSearch(page)

  // Park the mouse in a safe corner so Firefox doesn't fire spurious
  // mouseenter events when result cards render under the cursor.
  await moveMouseToSafePosition(page)
})

function isMobileViewport(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) <= tabletBreakpoint
}

function getPreviewLocator(page: Page): Locator {
  if (isMobileViewport(page)) {
    return page.locator(".result-card.focus .card-preview").first()
  }
  return page.locator("#preview-container")
}

/** Wait for the preview article content to be loaded and non-empty.
 *  Preview content is fetched asynchronously after the article element is
 *  attached, so we also wait for it to have visible children to avoid
 *  racing on content assertions like toContainText. */
async function waitForArticlePreview(page: Page): Promise<Locator> {
  const preview = getPreviewLocator(page)
  const article = preview.locator("article.search-preview")
  await expect(article).toBeAttached({ timeout: 15_000 })
  await expect(article).not.toBeEmpty({ timeout: 15_000 })
  return preview
}

/**
 * Navigate by clicking the preview (desktop) or the focused result card (mobile).
 * On mobile, the card preview has pointer-events: none, so we click the card directly.
 */
async function clickPreviewToNavigate(page: Page): Promise<void> {
  if (isMobileViewport(page)) {
    await page.locator(".result-card.focus").click()
  } else {
    await page.locator("#preview-container").click()
  }
}

test.afterEach(async ({ page }) => {
  // Navigate away to flush pending network/script activity, preventing
  // WebKit from hanging during browserContext.close() teardown.
  await page.goto("about:blank")
})

for (const keyName of ["/", "Escape"]) {
  test(`Search closes with ${keyName}`, async ({ page }) => {
    const searchContainer = page.locator("#search-container")
    const searchBar = page.locator("#search-bar")

    // Initial state (already open)
    await expect(searchContainer).toHaveClass(/active/)
    await expect(searchBar).toBeFocused()

    // Close with keyName
    await page.keyboard.press(keyName)
    await expect(searchContainer).not.toHaveClass(/active/)
  })
}

test("Clicking on nav-searchbar opens search", async ({ page }) => {
  // Close search
  await page.keyboard.press("Escape")

  const searchContainer = page.locator("#search-container")
  await expect(searchContainer).not.toHaveClass(/active/)

  const searchBar = page.locator("#nav-searchbar")
  await searchBar.click()
  await expect(searchContainer).toHaveClass(/active/)
})

test("Search results appear and can be navigated (lostpixel)", async ({ page }, testInfo) => {
  // Search index loading + preview fetch + screenshot can exceed 30s in CI
  test.slow()

  await search(page, "Steering")
  await page.waitForLoadState("domcontentloaded")

  const resultsContainer = page.locator("#results-container")
  await expect(resultsContainer).toBeVisible()

  const resultCards = page.locator(".result-card")
  await expect(resultCards.first()).toBeVisible()
  await expect(resultCards.first()).toContainText("Steering")

  await page.keyboard.press("ArrowDown")

  const secondResult = resultCards.nth(1)
  await expect(secondResult).toHaveClass(/focus/)

  const previewContainer = await waitForArticlePreview(page)
  await expect(previewContainer).toBeAttached()

  await page.waitForLoadState("load")
  await takeRegressionScreenshot(page, testInfo, "search-steering", {
    elementToScreenshot: page.locator("#search-layout"),
  })
})

test("ArrowDown navigation does not get stuck below the second result", async ({
  page,
}, testInfo) => {
  test.slow(testInfo.project.name.includes("Firefox"), "Firefox is slow in CI")
  await search(page, "Steering")
  await page.waitForLoadState("domcontentloaded")

  const resultCards = page.locator(".result-card")

  // Wait for at least 3 results to render — Firefox on tablet viewports
  // may render results asynchronously, and nth(2) fails with
  // "element(s) not found" if checked too early.
  await expect(resultCards.nth(2)).toBeVisible({ timeout: 10_000 })

  await expect(resultCards.nth(0)).toHaveClass(/focus/)

  await page.keyboard.press("ArrowDown")
  await expect(resultCards.nth(1)).toHaveClass(/focus/)

  await page.keyboard.press("ArrowDown")
  await expect(resultCards.nth(2)).toHaveClass(/focus/)
})

test("Search layout restores height when tab becomes visible again", async ({ page }) => {
  await search(page, "Steering")
  await page.waitForLoadState("domcontentloaded")

  const searchLayout = page.locator("#search-layout")
  await expect(searchLayout).toBeVisible()

  const heightBefore = await searchLayout.evaluate((el) => (el as HTMLElement).offsetHeight)
  expect(heightBefore).toBeGreaterThan(0)

  // Simulate the bug: remove display-results class (as if JS state was lost)
  await page.evaluate(() => {
    const searchLayout = document.getElementById("search-layout")
    if (searchLayout) {
      searchLayout.classList.remove("display-results")
    }
  })

  // Verify the layout collapsed
  const heightCollapsed = await searchLayout.evaluate((el) => (el as HTMLElement).offsetHeight)
  expect(heightCollapsed).toBe(0)

  // Simulate returning to the tab (page becomes visible).
  // Override on Document.prototype so Firefox's native getter is replaced.
  await page.evaluate(() => {
    Object.defineProperty(Document.prototype, "hidden", {
      value: false,
      configurable: true,
    })
    // @ts-expect-error - Event types differ between Node and browser contexts
    document.dispatchEvent(new Event("visibilitychange"))
  })

  // After visibility change, the layout should be restored.
  // Firefox may defer the layout recalculation, so poll rather than
  // reading offsetHeight synchronously.
  await expect(searchLayout).toHaveClass(/display-results/, { timeout: 5_000 })
})

test("Preview panel shows on desktop and hides on mobile", async ({ page }) => {
  await search(page, "test")

  const previewContainer = page.locator("#preview-container")

   
  const isDesktop = (page.viewportSize()?.width ?? 0) > tabletBreakpoint
  await expect(previewContainer).toBeVisible({ visible: isDesktop })
})

test("Search placeholder changes based on viewport", async ({ page }) => {
  const searchBar = page.locator("#search-bar")
  const pageWidth = page.viewportSize()?.width
  // eslint-disable-next-line playwright/no-conditional-in-test
  const showShortcutPlaceholder = pageWidth && pageWidth >= tabletBreakpoint

  await page.keyboard.press("/")
  await expect(searchBar).toHaveAttribute(
    "placeholder",
    showShortcutPlaceholder ? searchPlaceholderDesktop : searchPlaceholderMobile,
  )
})

test("matched search terms appear in results", async ({ page }) => {
  await search(page, "test")

  const matches = page.locator(".search-match")
  await expect(matches.first()).toContainText("test", { ignoreCase: true })
})

test("result card title does not show raw HTML tags", async ({ page }) => {
  await search(page, "test")

  const firstCard = page.locator(".result-card").first()
  await expect(firstCard).toBeVisible()

  // The title should use DOM-based highlighting, not raw HTML strings
  const titleText = await firstCard.locator(".h4").textContent()
  expect(titleText).not.toContain("<span")
  expect(titleText).not.toContain("</span>")

  // The search-match span should exist as a proper DOM element
  await expect(firstCard.locator(".h4 .search-match")).toBeAttached()
})

test("search matches in headers have correct color styling", async ({ page }) => {
  await search(page, "Steering")

  const previewContainer = await waitForArticlePreview(page)

  // Find a search match within a header element
  const headerMatch = previewContainer
    .locator("h1 .search-match, h2 .search-match, h3 .search-match")
    .first()
  await expect(headerMatch).toBeAttached()

  // Verify the match has the green color applied, not the default foreground color
  const { matchColor, foregroundColor } = await headerMatch.evaluate((el) => {
    const styles = window.getComputedStyle(el)
    const parent = el.parentElement
    const parentStyles = parent ? window.getComputedStyle(parent) : styles
    return {
      matchColor: styles.color,
      foregroundColor: parentStyles.color,
    }
  })

  // The match color should be different from the parent's foreground color
  expect(matchColor).not.toBe(foregroundColor)
})

test("Search results are case-insensitive", async ({ page }, testInfo) => {
  // Two sequential searches can exceed default timeouts on Firefox
  test.slow(testInfo.project.name.includes("Firefox"), "Firefox is slow in CI")

  await search(page, "TEST")
  await expect(page.locator(".result-card").first()).toBeVisible()
  const uppercaseResults = await page
    .locator(".result-card")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")))

  await search(page, "test")
  await expect(page.locator(".result-card").first()).toBeVisible()
  const lowerCaseResults = await page
    .locator(".result-card")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")))

  expect(uppercaseResults).toEqual(lowerCaseResults)
  expect(uppercaseResults.length).toBeGreaterThan(0)
})

test("Search bar is focused after typing", async ({ page }) => {
  await search(page, "Steering")
  const searchBar = page.locator("#search-bar")
  await expect(searchBar).toBeFocused()
})

test("Search results work for a single character", async ({ page }, testInfo) => {
  // Single-character search matches many results and can be slow on Firefox
  test.slow(testInfo.project.name.includes("Firefox"), "Firefox is slow in CI")

  await search(page, "t")

  const results = await getAllWithWait(page.locator(".result-card"))

  // If there's only one result, it's probably just "nothing found"
  expect(results).not.toHaveLength(1)
})

test("Preview element persists after closing and reopening search", async ({ page }, testInfo) => {
  // Two full search + preview cycles can exceed default timeouts on Firefox
  test.slow(testInfo.project.name.includes("Firefox"), "Firefox is slow in CI")
  await search(page, "Steering")
  await waitForArticlePreview(page)

  // Close and reopen search
  await page.keyboard.press("Escape")
  await openSearch(page)

  // Search again and trigger preview
  await search(page, "Steering")
  const preview = await waitForArticlePreview(page)
  await expect(preview).toBeVisible()
})

test.describe("Search accuracy", () => {
  const searchTerms = [
    { term: "Josh Turner" },
    { term: "Pond" },
    { term: "United States government" },
    { term: "gwern" },
  ]
  searchTerms.forEach(({ term }) => {
    test(`Search results prioritize full term matches for ${term}`, async ({ page }) => {
      await search(page, term)

      const preview = await waitForArticlePreview(page)
      await expect(preview).toContainText(term)
    })
  })

  const titleTerms = ["AI presidents", "AI President", "Alignment"]
  titleTerms.forEach((term) => {
    test(`Title search results are ordered before content search results for ${term}`, async ({
      page,
    }) => {
      await search(page, term)

      const firstResult = page.locator(".result-card").first()
      await expect(firstResult).toBeVisible()
      const firstText = await firstResult.textContent()
      expect(firstText?.toLowerCase()).toContain(term.toLowerCase())
      expect(firstText?.startsWith("...")).toBe(false)
    })
  })

  const previewTerms = ["Shrek", "AI presidents", "virus", "Emoji"]
  previewTerms.forEach((term) => {
    test(`Term ${term} is previewed in the viewport`, async ({ page }) => {
      await search(page, term)

      const preview = await waitForArticlePreview(page)
      const previewArticle = preview.locator("article.search-preview")
      await expect(previewArticle).toBeAttached()

      // Get first matched match
      const matchedMatches = previewArticle.locator(`span.search-match:text("${term}")`).first()
      await expect(matchedMatches).toBeInViewport()
    })
  })

  test("Slug search results are ordered before content search results for date-me", async ({
    page,
  }) => {
    await search(page, "date-me")

    const preview = await waitForArticlePreview(page)
    await expect(preview).toContainText("wife")
  })

  test("Nothing shows up for nonsense search terms", async ({ page }) => {
    await search(page, "feiwopqclvxk")

    const resultCards = page.locator(".result-card")
    await expect(resultCards).toHaveCount(1)
    await expect(resultCards.first()).toContainText("No results")
  })

  test("AI presidents doesn't use dropcap", async ({ page }) => {
    // data-use-dropcap is only set by the desktop PreviewManager
    test.skip(isMobileViewport(page), "Dropcap attribute is desktop-only")
    await search(page, "AI presidents")

    const previewArticle = page.locator("#preview-container > article.search-preview")
    await expect(previewArticle).toHaveAttribute("data-use-dropcap", "false")
  })

  test("Dropcap attribute is true for 'test' search results", async ({ page }) => {
    test.skip(isMobileViewport(page), "Dropcap attribute is desktop-only")
    await search(page, "test")

    const previewArticle = page.locator("#preview-container > article.search-preview")
    await expect(previewArticle).toHaveAttribute("data-use-dropcap", "true")
  })
})

test("Search preview footnote backref has no underline", async ({ page }) => {
  await search(page, "test")

  const preview = await waitForArticlePreview(page)
  const footnoteLink = preview.locator("a[data-footnote-backref]").first()
  await expect(footnoteLink).toHaveCSS("text-decoration-line", "none")
})

test("Enter key navigates to first result", async ({ page }) => {
  const initialUrl = page.url()
  await search(page, "test")

  const firstResult = page.locator(".result-card").first()
  await triggerAndWaitForSPANav(page, () => firstResult.press("Enter"))

  await expect(page).not.toHaveURL(initialUrl)
})

// Enter and click used to have different navigation methods
test("Enter key navigation scrolls to first match", async ({ page }) => {
  // Use a term that appears far down the test page so scrolling is required
  await search(page, "Footnote spam")

  const firstResult = page.locator(".result-card").first()
  await expect(firstResult).toBeVisible()

  await triggerAndWaitForSPANav(page, () => page.keyboard.press("Enter"))

  const firstMatch = page.locator("article .search-match").first()
  await expect(firstMatch).toBeAttached()
  await expect(firstMatch).toBeInViewport()

  // Verify we actually scrolled (not at top of page)
  const scrollY = await page.evaluate(() => window.scrollY)
  expect(scrollY).toBeGreaterThan(0)
})

test("Search matching title text stays at top even with body matches", async ({ page }) => {
  // "Testing site" matches the test page title ("Testing Site Features") and
  // the sub-token "Testing" also appears in the body ("visual regression testing").
  // When the title matches, the page should stay at the top.
  await search(page, "Testing site")

  // Click specifically on the test page result (not just Enter on the first
  // result, which may differ across viewport sizes)
  const testPageResult = page.locator('.result-card[id="test-page"]')
  await expect(testPageResult).toBeVisible()
  await triggerAndWaitForSPANav(page, () => testPageResult.click())

  // The title should contain a highlighted match
  const titleMatch = page.locator("#article-title .search-match")
  await expect(titleMatch.first()).toBeAttached({ timeout: 15_000 })

  // Page should stay at the top because the title contains a match
  const scrollY = await page.evaluate(() => window.scrollY)
  expect(scrollY).toBe(0)
})

test("Search URL updates as we select different results", async ({ page }) => {
  const initialUrl = page.url()
  await search(page, "Shrek")

  // Verify preview content loads for the first result
  await waitForArticlePreview(page)

  await triggerAndWaitForSPANav(page, () => clickPreviewToNavigate(page))
  const firstResultUrl = page.url()

  // Search again — use openSearch to wait for component initialization after goBack.
  // Use waitUntil: "commit" to avoid WebKit hangs with "load" on SPA back-navigation.
  await page.goBack({ waitUntil: "commit" })
  await page.waitForLoadState("domcontentloaded")
  await openSearch(page)
  await search(page, "Shrek")

  // Navigate to the second result
  await page.keyboard.press("ArrowDown")
  await waitForArticlePreview(page)
  await triggerAndWaitForSPANav(page, () => clickPreviewToNavigate(page))

  await expect(page).not.toHaveURL(initialUrl)
  await expect(page).not.toHaveURL(firstResultUrl)
})

/* eslint-disable playwright/expect-expect */
test("Checkbox search preview (lostpixel)", async ({ page }, testInfo) => {
  await search(page, "Checkboxes")

  const previewContainer = await waitForArticlePreview(page)
  await takeRegressionScreenshot(page, testInfo, "Search-checkboxes", {
    elementToScreenshot: previewContainer,
  })
})

test("Search preview of checkboxes remembers user state", async ({ page }) => {
  await gotoPage(page, "http://localhost:8080/test-page")

  const baseSelector = "h1 + ol #checkbox-0"
  const checkboxAfterHeader = page.locator(baseSelector).first()
  const initialChecked = await isElementChecked(checkboxAfterHeader)
  expect(initialChecked).toBe(false)

  await checkboxAfterHeader.click()
  const checkedAfterClicked = await isElementChecked(checkboxAfterHeader)
  expect(checkedAfterClicked).toBe(true)

  await openSearch(page)
  await search(page, "Checkboxes")

  const preview = await waitForArticlePreview(page)
  const previewCheckbox = preview.locator(baseSelector).first()
  const previewBoxIsChecked = await isElementChecked(previewCheckbox)
  expect(previewBoxIsChecked).toBe(true)
})

test("Emoji search works and is converted to twemoji (lostpixel)", async ({ page }, testInfo) => {
  await search(page, "Emoji examples")

  const previewContainer = await waitForArticlePreview(page)
  const emojiHeader = previewContainer.locator("#emoji-examples").first()
  await expect(emojiHeader).toBeAttached()
  await emojiHeader.scrollIntoViewIfNeeded()
  await expect(emojiHeader).toBeVisible()

  await takeRegressionScreenshot(page, testInfo, "twemoji-search", {
    elementToScreenshot: previewContainer,
  })
})

test("Footnote back arrow is properly replaced (lostpixel)", async ({ page }, testInfo) => {
  await search(page, "Testing site")
  await page.waitForLoadState("load")

  const preview = await waitForArticlePreview(page)
  const footnoteLink = preview.locator("a[data-footnote-backref]").first()
  await footnoteLink.scrollIntoViewIfNeeded()
  await expect(footnoteLink).toContainText("⤴")
  await expect(footnoteLink).toBeVisible()

  await takeRegressionScreenshot(page, testInfo, "footnote-back-arrow-search", {
    elementToScreenshot: footnoteLink,
  })
})

test.describe("Image's mix-blend-mode attribute", () => {
  test.beforeEach(async ({ page }) => {
    // waitForArticlePreview can take up to 15s in CI
    test.slow()
    await search(page, "Testing site")
    await waitForArticlePreview(page)
  })

  test("is multiply in light mode", async ({ page }) => {
    const image = getPreviewLocator(page).locator("img").first()
    await expect(image).toHaveCSS("mix-blend-mode", "multiply")
  })

  test("is normal in dark mode", async ({ page }) => {
    await setTheme(page, "dark")
    const image = getPreviewLocator(page).locator("img").first()
    await expect(image).toHaveCSS("mix-blend-mode", "normal")
  })
})

test("Opens the 'testing site features' page (lostpixel)", async ({ page }, testInfo) => {
  await search(page, "Testing site")

  const previewContainer = await waitForArticlePreview(page)
  await expect(previewContainer).toBeVisible()

  await takeRegressionScreenshot(page, testInfo, "search-testing-site-features", {
    elementToScreenshot: previewContainer,
  })
})

test("Search preview shows after bad entry", async ({ page }) => {
  // Four sequential searches with async preview fetches can exceed 30s in CI
  test.slow()

  await search(page, "zzzzzz")
  await search(page, "Testing site")
  await search(page, "zzzzzz")
  await search(page, "Testing site")

  const previewContainer = await waitForArticlePreview(page)
  await expect(previewContainer).toBeVisible()

  // If preview fails, it'll have no children
  const previewContent = previewContainer.locator(":scope > *")
  await expect(previewContent).toHaveCount(1)
})

test("Search preview shows after searching, closing, and reopening", async ({ page }) => {
  await search(page, "Testing site")
  const previewContainer = getPreviewLocator(page)
  await expect(previewContainer).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(previewContainer).toBeHidden()

  await openSearch(page)
  await search(page, "Shrek")
  await expect(getPreviewLocator(page)).toBeVisible()
})

test("Show search preview, search invalid, then show again", async ({ page }) => {
  await search(page, "Testing site")
  await search(page, "zzzzzz")
  await search(page, "Testing site")

  const previewContainer = await waitForArticlePreview(page)
  await expect(previewContainer).toBeVisible()

  // If preview fails, it'll have no children
  const previewContent = previewContainer.locator(":scope > *")
  await expect(previewContent).toHaveCount(1)
})

test("The pond dropcaps, search preview visual regression test (lostpixel)", async ({
  page,
}, testInfo) => {
  await search(page, "Testing site")

  const preview = await waitForArticlePreview(page)
  const searchPondDropcaps = preview.locator("#the-pond-dropcaps")
  await expect(searchPondDropcaps).toBeAttached()
  await searchPondDropcaps.scrollIntoViewIfNeeded()

  await takeRegressionScreenshot(page, testInfo, "search-the-pond-dropcaps", {
    elementToScreenshot: searchPondDropcaps,
  })
})

test("Preview container click navigates to the correct page and scrolls to the first match", async ({
  page,
}) => {
  await search(page, "Shrek")

  // Get the URL of the first result for comparison
  const firstResult = page.locator(".result-card").first()
  await expect(firstResult).toBeVisible()
  const expectedUrl = await firstResult.getAttribute("href")
  expect(expectedUrl).not.toBeNull()

  // Wait for preview content to load, then navigate
  await waitForArticlePreview(page)
  await triggerAndWaitForSPANav(page, () => clickPreviewToNavigate(page))

  const firstMatch = page.locator("article .search-match").first()
  await expect(firstMatch).toBeAttached()
  await expect(firstMatch).toBeInViewport()
})

test("Search preview shows multiple highlighted terms", async ({ page }) => {
  await search(page, "test")

  const previewContainer = await waitForArticlePreview(page)

  // Wait for matches to render — content is fetched asynchronously after the
  // preview article element is attached, so matches may not exist immediately.
  const matches = previewContainer.locator(".search-match")
  await expect(matches.first()).toBeAttached({ timeout: 10_000 })

  const matchCount = await matches.count()
  expect(matchCount).toBeGreaterThan(1)
})

test("Search matches in preview do not have fade animation", async ({ page }) => {
  await search(page, "test")
  const firstResult = page.locator(".result-card").first()
  await expect(firstResult).toBeVisible()

  const preview = await waitForArticlePreview(page)
  const previewMatch = preview.locator(".search-match").first()
  await expect(previewMatch).toBeAttached()

  // WebKit/Safari may need many frames for the CSS exclusion
  // :not(#search-container .search-match) to settle — iPad Safari in CI
  // can be especially slow.
  await expect(async () => {
    const animation = await previewMatch.evaluate((el) => {
      return window.getComputedStyle(el).animationName
    })
    expect(animation).toBe("none")
  }).toPass({ timeout: 10_000 })
})

test("Search matches on navigated page have fade animation", async ({ page }) => {
  await search(page, "test")
  const firstResult = page.locator(".result-card").first()
  await expect(firstResult).toBeVisible()

  await triggerAndWaitForSPANav(page, () => page.keyboard.press("Enter"))

  const pageMatch = page.locator("article .search-match").first()
  await expect(pageMatch).toBeVisible()

  const animationName = await pageMatch.evaluate((el) => {
    const styles = window.getComputedStyle(el)
    return styles.animationName
  })

  expect(animationName).toBe("search-match-fade")
})

test("Navigated page properly orients the first match in viewport", async ({ page }) => {
  await search(page, "Shrek")

  const firstResult = page.locator(".result-card").first()
  await expect(firstResult).toBeVisible()

  await waitForArticlePreview(page)
  await clickPreviewToNavigate(page)
  await page.waitForLoadState("load")

  const firstMatch = page.locator("article .search-match").first()
  await expect(firstMatch).toBeAttached()

  // Wait for the scroll to complete by checking that the element is in the expected position
  await expect(async () => {
    const matchTop = await firstMatch.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      return rect.top
    })
    expect(matchTop).toBeGreaterThan(50)
  }).toPass()
})

test("Result card matching stays synchronized with preview", async ({ page }) => {
  // This test uses hover() for mouse interaction, which requires a desktop viewport
  test.skip(
    (page.viewportSize()?.width ?? 0) <= tabletBreakpoint,
    "Requires hover for mouse interaction",
  )

  await search(page, "test")

  // Check initial state
  const firstResult = page.locator(".result-card").first()
  await expect(firstResult).toHaveClass(/focus/)

  // Check keyboard navigation
  await page.keyboard.press("ArrowDown")
  const secondResult = page.locator(".result-card").nth(1)
  await expect(secondResult).toHaveClass(/focus/)
  await expect(firstResult).not.toHaveClass(/focus/)

  // Check mouse interaction — move the mouse away first so the mouseenter
  // event fires reliably when hovering the third result.
  const thirdResult = page.locator(".result-card").nth(2)
  await expect(thirdResult).not.toHaveClass(/focus/)
  await moveMouseToSafePosition(page)

  await expect(async () => {
    await thirdResult.hover()
    await expect(thirdResult).toHaveClass(/focus/)
  }).toPass({ timeout: 5_000 })
  await expect(secondResult).not.toHaveClass(/focus/)
})

test("should not select a search result on initial render, even if the mouse is hovering over it", async ({
  page,
}, testInfo) => {
  // Two sequential searches can exceed default timeouts on Firefox
  test.slow(testInfo.project.name.includes("Firefox"), "Firefox is slow in CI")
  await search(page, "alignment")

  // Figure out where the second result is, and hover over it
  const secondResult = page.locator(".result-card").nth(1)
  await expect(secondResult).toBeVisible()
  const secondResultPos = await secondResult.boundingBox()
  expect(secondResultPos).not.toBeNull()

  // skipcq: JS-0339 - secondResultPos is checked for nullability above
  const { x, y, width, height } = secondResultPos!
  await page.mouse.move(x + width / 2, y + height / 2)

  // Park the mouse on the search bar BEFORE the new search renders, so that
  // when mouseEventsLocked expires the cursor isn't over a result card.
  // Previously the mouse.move happened AFTER results rendered, racing with
  // the 100ms lock — on Firefox the move could traverse cards and fire
  // mouseenter after the lock expired, stealing focus from the first result.
  const searchBar = page.locator("#search-bar")
  const searchBarBox = await searchBar.boundingBox()
  expect(searchBarBox).not.toBeNull()
  // skipcq: JS-0339 - searchBarBox is checked for nullability above
  await page.mouse.move(searchBarBox!.x + 5, searchBarBox!.y + 5)

  await search(page, "test")

  // Move mouse away from results IMMEDIATELY after search() returns, while
  // mouseEventsLocked is still true (100ms window). If we wait too long
  // (e.g., for toHaveId), the lock expires and the mouse.move path through
  // result cards fires mouseenter, stealing focus from the first card.
  await moveMouseToSafePosition(page)

  // Now wait for the first result card to reflect the "test" query.
  const firstResult = page.locator(".result-card").first()
  await expect(firstResult).toHaveId("test-page", { timeout: 10_000 })

  // The first result should have focus (assigned during displayResults)
  await expect(firstResult).toHaveClass(/focus/, { timeout: 10_000 })

  await page.keyboard.press("Enter")
  await page.waitForURL("**/test-page**")
})

test("Footnote table displays within boundaries in search preview (lostpixel)", async ({
  page,
}, testInfo) => {
  await search(page, "test page")

  const previewContainer = await waitForArticlePreview(page)
  await expect(previewContainer).toBeVisible()

  const tableFootnote = previewContainer.locator("ol #user-content-fn-table")
  await expect(tableFootnote).toBeAttached()
  await tableFootnote.scrollIntoViewIfNeeded()

  await takeRegressionScreenshot(page, testInfo, "search-preview-footnote-table", {
    elementToScreenshot: previewContainer,
    elementAboutWhichToIsolateDOM: tableFootnote,
  })
})

const navigationMethods = [
  { down: "ArrowDown", up: "ArrowUp", description: "arrow keys" },
  { down: "Tab", up: "Shift+Tab", description: "tab keys" },
] as const

navigationMethods.forEach(({ down, up, description }) => {
  test(`maintains focus when navigating with ${description}`, async ({ page }) => {
    await search(page, "Testing Site Features")

    const totalResults = await page.locator(".result-card").count()

    // Navigate down through results
    for (let i = 0; i < totalResults; i++) {
      await page.keyboard.press(down)
      const focusedResults = page.locator(".result-card.focus")
      await expect(focusedResults).toHaveCount(1)
    }

    // Navigate up through results
    for (let i = 0; i < totalResults; i++) {
      await page.keyboard.press(up)
      const focusedResults = page.locator(".result-card.focus")
      await expect(focusedResults).toHaveCount(1)
    }
  })
})

navigationMethods.forEach(({ down, description }) => {
  test(`${description} navigation changes which page you enter`, async ({ page }) => {
    await search(page, "Testing")
    const firstResult = page.locator(".result-card").first()
    await expect(firstResult).toHaveAttribute("href", "http://localhost:8080/test-page")

    await page.keyboard.press(down)
    await triggerAndWaitForSPANav(page, () => page.keyboard.press("Enter"))
    await expect(page).not.toHaveURL("http://localhost:8080/test-page")
  })
})

test("Search bar accepts input immediately while index loads", async ({ page }) => {
  // Close search first (opened by beforeEach)
  await page.keyboard.press("Escape")
  const searchContainer = page.locator("#search-container")
  await expect(searchContainer).not.toHaveClass(/active/)

  // Navigate to a fresh page to reset search initialization state
  await gotoPage(page, "http://localhost:8080/test-page")

  // Intercept contentIndex.json to add a delay, simulating slow index loading
  await page.route("**/contentIndex.json", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    await route.continue()
  })

  // Open search - this triggers index initialization
  await openSearch(page)

  // Type immediately without waiting - before the fix, this would be ignored
  // because the search bar was disabled during index loading
  const searchBar = page.locator("#search-bar")
  const testText = "hello"
  await searchBar.pressSequentially(testText, { delay: 20 })

  // The text should appear in the search bar even while loading
  await expect(searchBar).toHaveValue(testText)
})

test("Mobile search results show card preview snippets", async ({ page }) => {
  test.skip(!isMobileViewport(page), "Card previews only render on mobile viewports")
  await search(page, "Steering")

  const firstResult = page.locator(".result-card").first()
  const cardPreview = firstResult.locator(".card-preview")
  await expect(cardPreview).toBeAttached()

  // Preview content loads asynchronously
  const article = cardPreview.locator("article.search-preview")
  await expect(article).toBeAttached({ timeout: 10_000 })
  await expect(article).not.toBeEmpty()
})

test("admonition background is transparent in focused mobile card preview (lostpixel)", async ({
  page,
}, testInfo) => {
  test.skip(!isMobileViewport(page), "Card previews only render on mobile viewports")

  // "Admonitions" matches the test page which has a section with various admonition types
  await search(page, "Admonitions")

  const testPageResult = page.locator('.result-card[id="test-page"]')
  await expect(testPageResult).toBeVisible()
  await testPageResult.focus()

  const cardPreview = testPageResult.locator(".card-preview")
  const article = cardPreview.locator("article.search-preview")
  await expect(article).toBeAttached({ timeout: 10_000 })

  // The focused card has a non-transparent background (the hover/focus effect),
  // while the admonition inside is transparent — so the highlight shows through.
  await expect(testPageResult).toHaveClass(/focus/)
  const cardBg = await testPageResult.evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor
  })
  expect(cardBg).not.toBe("rgba(0, 0, 0, 0)")

  const admonition = cardPreview.locator(".admonition").first()
  await expect(admonition).toBeAttached()
  await expect(admonition).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")

  await takeRegressionScreenshot(page, testInfo, "mobile-card-preview-admonition", {
    elementToScreenshot: testPageResult,
  })
})

test.describe("Search preview scroll behavior", () => {
  test("scrolls container so first match is approximately centered", async ({ page }) => {
    test.skip(isMobileViewport(page), "Preview container is desktop-only")

    await search(page, "virus")
    await waitForArticlePreview(page)

    const previewContainer = page.locator("#preview-container")
    const firstMatch = previewContainer.locator(".search-match").first()
    await expect(firstMatch).toBeAttached()

    // The scroll code positions the first match at ~50% of the container height.
    // Verify the match ends up in the middle portion of the visible area.
    await expect(async () => {
      const { matchCenterFraction, scrollTop } = await previewContainer.evaluate((container) => {
        const match = container.querySelector(".search-match")
        if (!match) throw new Error("No .search-match element found")
        const matchRect = match.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        const matchCenter = matchRect.top + matchRect.height / 2 - containerRect.top
        return {
          matchCenterFraction: matchCenter / container.clientHeight,
          scrollTop: container.scrollTop,
        }
      })

      // When the container scrolled, the match should be near center (middle 60%)
      if (scrollTop > 0) {
        // eslint-disable-next-line playwright/no-conditional-expect
        expect(matchCenterFraction).toBeGreaterThan(0.2)
        // eslint-disable-next-line playwright/no-conditional-expect
        expect(matchCenterFraction).toBeLessThan(0.8)
      }
      // Match must always be within the visible container area
      expect(matchCenterFraction).toBeGreaterThanOrEqual(0)
      expect(matchCenterFraction).toBeLessThanOrEqual(1)
    }).toPass()
  })

  test("re-scrolls to first match after viewport resize", async ({ page }) => {
    test.skip(isMobileViewport(page), "Preview container is desktop-only")

    // viewportSize() is guaranteed non-null here (non-mobile viewport confirmed above)
    const currentSize = page.viewportSize() as { width: number; height: number }
    test.skip(
      currentSize.width - 200 <= tabletBreakpoint,
      "Viewport too narrow to resize while remaining above tablet breakpoint",
    )

    await search(page, "virus")
    await waitForArticlePreview(page)

    const firstMatch = page.locator("#preview-container .search-match").first()
    await expect(firstMatch).toBeInViewport()

    // Resize viewport (changes container height and triggers content reflow)
    await page.setViewportSize({
      width: currentSize.width - 200,
      height: currentSize.height - 100,
    })

    // The debounced resize handler (150ms) re-scrolls to the match
    await expect(firstMatch).toBeInViewport()
  })
})

test("Search preview tables have scroll indicators", async ({ page }) => {
  test.skip(isMobileViewport(page), "Preview container is desktop-only")

  // Use a narrow viewport so the wide table overflows in the search preview
  const currentSize = page.viewportSize() as { width: number; height: number }
  await page.setViewportSize({ width: tabletBreakpoint + 50, height: currentSize.height })

  await search(page, "Scroll indicators")
  const preview = await waitForArticlePreview(page)

  // The test page has a wide 8-column table in the "Scroll indicators" section.
  // At this narrow viewport it overflows, triggering the right fade gradient.
  const scrollIndicatorWithFade = preview.locator(".scroll-indicator.can-scroll-right")
  await expect(async () => {
    await expect(scrollIndicatorWithFade.first()).toBeAttached()
  }).toPass({ timeout: 10_000 })
})
