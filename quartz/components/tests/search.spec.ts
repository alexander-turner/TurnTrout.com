import { test, expect, type Page, type Locator } from "@playwright/test"

import { tabletBreakpoint } from "../../styles/variables"
import { simpleConstants } from "../constants"

const { searchPlaceholderDesktop, searchPlaceholderMobile, mouseFocusDelay } = simpleConstants
import {
  takeRegressionScreenshot,
  setTheme,
  search,
  getAllWithWait,
  isElementChecked,
} from "./visual_utils"

test.beforeEach(async ({ page }) => {
  // Log any console errors
  page.on("pageerror", (err) => console.error(err))

  // Navigate and wait for full initialization
  await page.goto("http://localhost:8080/welcome", { waitUntil: "domcontentloaded" })

  // Wait for search to be fully initialized
  await expect(page.locator("#search-container")).toBeAttached()
  await expect(page.locator("#search-icon")).toBeVisible()

  // Ensure search is closed at start
  const searchContainer = page.locator("#search-container")
  await expect(searchContainer).not.toHaveClass(/active/)

  await page.keyboard.press("/")
  await expect(searchContainer).toHaveClass(/active/)
  await expect(page.locator("#search-bar")).toBeVisible()
})

function getPreviewLocator(page: Page): Locator {
  const isMobile = (page.viewportSize()?.width ?? 0) <= tabletBreakpoint
  if (isMobile) {
    return page.locator(".result-card.focus .inline-preview").first()
  }
  return page.locator("#preview-container")
}

async function closeSearch(page: Page) {
  const searchContainer = page.locator("#search-container")
  if (await searchContainer.evaluate((el) => el.classList.contains("active"))) {
    await page.keyboard.press("Escape")
    await expect(searchContainer).not.toHaveClass(/active/)
  }
}

test.afterEach(async ({ page }) => {
  await closeSearch(page)
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
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)

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

  const previewContainer = page.locator("#preview-container")
  await expect(previewContainer).toBeVisible()

  // Should have children -- means there's content
  await expect(previewContainer.first()).toBeAttached()
  await expect(previewContainer.first()).toBeVisible()

  await page.waitForLoadState("load")
  await takeRegressionScreenshot(page, testInfo, "search-steering", {
    elementToScreenshot: page.locator("#search-layout"),
  })
})

test("ArrowDown navigation does not get stuck below the second result", async ({ page }) => {
  await search(page, "Steering")
  await page.waitForLoadState("domcontentloaded")

  const resultCards = page.locator(".result-card")
  await expect(resultCards.nth(0)).toBeVisible()

  const totalResults = await resultCards.count()
  expect(totalResults).toBeGreaterThan(2)

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

  // Simulate returning to the tab (page becomes visible)
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: false, writable: true })
    // @ts-expect-error - Event types differ between Node and browser contexts
    document.dispatchEvent(new Event("visibilitychange"))
  })

  // After visibility change, the layout should be restored
  const heightAfter = await searchLayout.evaluate((el) => (el as HTMLElement).offsetHeight)
  expect(heightAfter).toBeGreaterThan(0)
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

test("search matches in headers have correct color styling", async ({ page }) => {
  await search(page, "Steering")

  const previewContainer = page.locator("#preview-container")
  await expect(previewContainer).toBeVisible()

  // Find a search match within a header element
  const headerMatch = previewContainer
    .locator("h1 .search-match, h2 .search-match, h3 .search-match")
    .first()
  await expect(headerMatch).toBeVisible()

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

test("Search results are case-insensitive", async ({ page }) => {
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

test("Search results work for a single character", async ({ page }) => {
  await search(page, "t")

  const results = await getAllWithWait(page.locator(".result-card"))

  // If there's only one result, it's probably just "nothing found"
  expect(results).not.toHaveLength(1)
})

test("Preview element persists after closing and reopening search", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)

  await search(page, "Steering")
  const previewContainer = getPreviewLocator(page)
  const previewArticle = previewContainer.locator("article.search-preview")
  await expect(previewArticle).toBeAttached()

  // Close and reopen search
  await page.keyboard.press("Escape")
  await page.keyboard.press("/")

  // Search again and trigger preview
  await search(page, "Steering")
  await expect(previewArticle).toBeAttached()
  await expect(previewArticle).not.toBeEmpty()
})

test.describe("Search accuracy", () => {
  const searchTerms = [
    { term: "Josh Turner" },
    { term: "The Pond" },
    { term: "United States government" },
    { term: "gwern" },
  ]
  searchTerms.forEach(({ term }) => {
    test(`Search results prioritize full term matches for ${term}`, async ({ page }) => {
      await search(page, term)

      const previewContainer = page.locator("#preview-container")
      const firstResult = previewContainer.first()
      await expect(firstResult).toContainText(term)
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
      test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)
      await search(page, term)

      const previewContent = page.locator("#preview-container > article")
      await expect(previewContent).toBeVisible()

      // Get first matched match
      const matchedMatches = previewContent.locator(`span.search-match:text("${term}")`).first()
      await expect(matchedMatches).toBeInViewport()
    })
  })

  test("Slug search results are ordered before content search results for date-me", async ({
    page,
  }) => {
    await search(page, "date-me")

    const firstResult = page.locator("#preview-container").first()
    await expect(firstResult).toContainText("wife")
  })

  test("Nothing shows up for nonsense search terms", async ({ page }) => {
    await search(page, "feiwopqclvxk")

    const resultCards = page.locator(".result-card")
    await expect(resultCards).toHaveCount(1)
    await expect(resultCards.first()).toContainText("No results")
  })

  test("AI presidents doesn't use dropcap", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)
    await search(page, "AI presidents")

    const previewElement = page.locator("#preview-container > article")
    await expect(previewElement).toHaveAttribute("data-use-dropcap", "false")
  })

  test("Dropcap attribute is true for 'test' search results", async ({ page }) => {
    await search(page, "test")

    const previewElement = page.locator("#preview-container > article")
    await expect(previewElement).toHaveAttribute("data-use-dropcap", "true")
  })
})

test("Search preview footnote backref has no underline", async ({ page }) => {
  await search(page, "test")

  const footnoteLink = page.locator("#preview-container a[data-footnote-backref]").first()
  await expect(footnoteLink).toHaveCSS("text-decoration-line", "none")
})

test("Enter key navigates to first result", async ({ page }) => {
  const initialUrl = page.url()
  await search(page, "test")

  const firstResult = page.locator(".result-card").first()
  await firstResult.press("Enter")

  await page.waitForURL((url) => url.toString() !== initialUrl)
  await expect(page).not.toHaveURL(initialUrl)
})

// Enter and click used to have different navigation methods
test("Enter key navigation scrolls to first match", async ({ page }) => {
  const initialUrl = page.url()
  // Use a term that appears far down the test page so scrolling is required
  await search(page, "Footnote spam")

  const firstResult = page.locator(".result-card").first()
  await expect(firstResult).toBeVisible()

  await page.keyboard.press("Enter")
  await page.waitForURL((url) => url.toString() !== initialUrl)

  const firstMatch = page.locator("article .search-match").first()
  await expect(firstMatch).toBeAttached()
  await expect(firstMatch).toBeInViewport()

  // Verify we actually scrolled (not at top of page)
  const scrollY = await page.evaluate(() => window.scrollY)
  expect(scrollY).toBeGreaterThan(0)
})

test("Search matching title text stays at top even with body matches", async ({ page }) => {
  const initialUrl = page.url()
  // "Testing site" matches the test page title ("Testing Site Features") and
  // the sub-token "Testing" also appears in the body ("visual regression testing").
  // When the title matches, the page should stay at the top.
  await search(page, "Testing site")

  // Click specifically on the test page result (not just Enter on the first
  // result, which may differ across viewport sizes)
  const testPageResult = page.locator('.result-card[id="test-page"]')
  await expect(testPageResult).toBeVisible()
  await testPageResult.click()

  await page.waitForURL((url) => url.toString() !== initialUrl)

  // The title should contain a highlighted match
  const titleMatch = page.locator("#article-title .search-match")
  await expect(titleMatch.first()).toBeAttached()

  // Page should stay at the top because the title contains a match
  const scrollY = await page.evaluate(() => window.scrollY)
  expect(scrollY).toBe(0)
})

test("Search URL updates as we select different results", async ({ page }) => {
  const initialUrl = page.url()
  await search(page, "Shrek")

  const firstResult = page.locator(".result-card").first()
  await firstResult.focus()

  const previewContainer = getPreviewLocator(page)
  await previewContainer.click()

  await page.waitForURL((url) => url.toString() !== initialUrl)
  const firstResultUrl = page.url()

  // Search again
  await page.goBack({ waitUntil: "load" })
  await expect(page.locator("#search-icon")).toBeVisible()

  // Click search icon instead of "/" shortcut for cross-device reliability
  await page.locator("#search-icon").click()
  await search(page, "Shrek")

  const secondResult = page.locator(".result-card").nth(1)
  await secondResult.focus()

  const previewContainer2 = getPreviewLocator(page)
  await previewContainer2.click()

  const urlsSoFar = new Set([initialUrl, firstResultUrl])
  await page.waitForURL((url) => !urlsSoFar.has(url.toString()))
})

/* eslint-disable playwright/expect-expect */
test("Checkbox search preview (lostpixel)", async ({ page }, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)

  await search(page, "Checkboxes")

  const previewContainer = page.locator("#preview-container")
  await takeRegressionScreenshot(page, testInfo, "Search-checkboxes", {
    elementToScreenshot: previewContainer,
  })
})

test("Search preview of checkboxes remembers user state", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)

  page.goto("http://localhost:8080/test-page", { waitUntil: "load" })

  const baseSelector = "h1 + ol #checkbox-0"
  const checkboxAfterHeader = page.locator(baseSelector).first()
  const initialChecked = await isElementChecked(checkboxAfterHeader)
  expect(initialChecked).toBe(false)

  await checkboxAfterHeader.click()
  const checkedAfterClicked = await isElementChecked(checkboxAfterHeader)
  expect(checkedAfterClicked).toBe(true)

  await page.keyboard.press("/")
  await search(page, "Checkboxes")

  const previewCheckbox = page.locator(`#preview-container ${baseSelector}`).first()
  const previewBoxIsChecked = await isElementChecked(previewCheckbox)
  expect(previewBoxIsChecked).toBe(true)
})

test("Emoji search works and is converted to twemoji (lostpixel)", async ({ page }, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)

  await search(page, "Emoji examples")

  const previewContainer = page.locator("#preview-container")
  const emojiHeader = previewContainer.locator("#emoji-examples").first()
  await expect(emojiHeader).toBeAttached()
  await emojiHeader.scrollIntoViewIfNeeded()
  await expect(emojiHeader).toBeVisible()

  await takeRegressionScreenshot(page, testInfo, "twemoji-search", {
    elementToScreenshot: previewContainer,
  })
})

test("Footnote back arrow is properly replaced (lostpixel)", async ({ page }, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)

  await search(page, "Testing site")
  await page.waitForLoadState("load")

  const footnoteLink = page.locator("#preview-container a[data-footnote-backref]").first()
  await footnoteLink.scrollIntoViewIfNeeded()
  await expect(footnoteLink).toContainText("⤴")
  await expect(footnoteLink).toBeVisible()

  await takeRegressionScreenshot(page, testInfo, "footnote-back-arrow-search", {
    elementToScreenshot: footnoteLink,
  })
})

test.describe("Image's mix-blend-mode attribute", () => {
  test.beforeEach(async ({ page }) => {
    await search(page, "Testing site")
  })

  test("is multiply in light mode", async ({ page }) => {
    const image = page.locator("#preview-container img").first()
    await expect(image).toHaveCSS("mix-blend-mode", "multiply")
  })

  test("is normal in dark mode", async ({ page }) => {
    await setTheme(page, "dark")
    const image = page.locator("#preview-container img").first()
    await expect(image).toHaveCSS("mix-blend-mode", "normal")
  })
})

test("Opens the 'testing site features' page (lostpixel)", async ({ page }, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)
  await search(page, "Testing site")

  const previewContainer = page.locator("#preview-container")
  await expect(previewContainer).toBeVisible()
  // Ensures the content loaded
  const previewInner = previewContainer.locator("article.search-preview")
  await expect(previewInner).toBeVisible()

  await takeRegressionScreenshot(page, testInfo, "search-testing-site-features", {
    elementToScreenshot: previewContainer,
  })
})

test("Search preview shows after bad entry", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)
  await search(page, "zzzzzz")
  await search(page, "Testing site")
  await search(page, "zzzzzz")
  await search(page, "Testing site")

  const previewContainer = page.locator("#preview-container")
  await expect(previewContainer).toBeVisible()

  // If preview fails, it'll have no children
  const previewContent = previewContainer.locator(":scope > *")
  await expect(previewContent).toHaveCount(1)
})

test("Search preview shows after searching, closing, and reopening", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)

  const previewContainer = page.locator("#preview-container")

  await search(page, "Testing site")
  await expect(previewContainer).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(previewContainer).toBeHidden()

  await page.keyboard.press("/")
  await search(page, "Shrek")
  await expect(previewContainer).toBeVisible()
})

test("Show search preview, search invalid, then show again", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)
  await search(page, "Testing site")
  await search(page, "zzzzzz")
  await search(page, "Testing site")

  const previewContainer = page.locator("#preview-container")
  await expect(previewContainer).toBeVisible()

  // If preview fails, it'll have no children
  const previewContent = previewContainer.locator(":scope > *")
  await expect(previewContent).toHaveCount(1)
})

test("The pond dropcaps, search preview visual regression test (lostpixel)", async ({
  page,
}, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)

  await search(page, "Testing site")

  const searchPondDropcaps = page.locator("#the-pond-dropcaps")
  await expect(searchPondDropcaps).toBeAttached()
  await searchPondDropcaps.scrollIntoViewIfNeeded()

  await takeRegressionScreenshot(page, testInfo, "search-the-pond-dropcaps", {
    elementToScreenshot: searchPondDropcaps,
  })
})

test("Preview container click navigates to the correct page and scrolls to the first match", async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)

  // Set viewport to desktop size to ensure preview is visible
  await page.setViewportSize({ width: tabletBreakpoint + 100, height: 800 })

  await search(page, "Shrek")

  // Get the URL of the first result for comparison
  const firstResult = page.locator(".result-card").first()
  await expect(firstResult).toBeVisible()
  const expectedUrl = await firstResult.getAttribute("href")
  expect(expectedUrl).not.toBeNull()

  // Navigate to the page
  const previewContainer = getPreviewLocator(page)
  await previewContainer.click()
  await page.waitForURL((url) => expectedUrl !== null && url.toString().startsWith(expectedUrl))

  // The destination page should scroll to the first `.search-match` created by `matchHTML(term, ...)`
  // Note: The text fragment hash (#:~:text=) is processed by the SPA and then stripped from the URL
  const firstMatch = page.locator("article .search-match").first()
  await expect(firstMatch).toBeAttached()
  await expect(firstMatch).toBeInViewport()
})

test("Search preview shows multiple highlighted terms", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)

  await search(page, "test")

  const previewContainer = page.locator("#preview-container")
  await expect(previewContainer).toBeVisible()

  // Check that multiple matches are highlighted
  const matches = previewContainer.locator(".search-match")
  const matchCount = await matches.count()
  expect(matchCount).toBeGreaterThan(1)
})

test("Search matches in preview do not have fade animation", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)

  await search(page, "test")
  const firstResult = page.locator(".result-card").first()
  await expect(firstResult).toBeVisible()

  const previewMatch = page.locator("#preview-container .search-match").first()
  await expect(previewMatch).toBeVisible()

  const previewAnimation = await previewMatch.evaluate((el) => {
    const styles = window.getComputedStyle(el)
    return styles.animationName
  })
  expect(previewAnimation).toBe("none")
})

test("Search matches on navigated page have fade animation", async ({ page }) => {
  await search(page, "test")
  const firstResult = page.locator(".result-card").first()
  await expect(firstResult).toBeVisible()

  await page.keyboard.press("Enter")
  await page.waitForLoadState("domcontentloaded")

  const pageMatch = page.locator("article .search-match").first()
  await expect(pageMatch).toBeVisible()

  const animationName = await pageMatch.evaluate((el) => {
    const styles = window.getComputedStyle(el)
    return styles.animationName
  })

  expect(animationName).toBe("search-match-fade")
})

test("Navigated page properly orients the first match in viewport", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)

  await search(page, "Shrek")

  const firstResult = page.locator(".result-card").first()
  await expect(firstResult).toBeVisible()

  await page.locator("#preview-container").click()
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

  // Check mouse interaction
  const thirdResult = page.locator(".result-card").nth(2)
  await expect(thirdResult).not.toHaveClass(/focus/)

  // Wait for mouse lock to expire after keyboard navigation
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(mouseFocusDelay + 50)

  await thirdResult.hover()
  await expect(thirdResult).toHaveClass(/focus/)
  await expect(secondResult).not.toHaveClass(/focus/)
})

test("should not select a search result on initial render, even if the mouse is hovering over it", async ({
  page,
}) => {
  await search(page, "alignment")

  // Figure out where the second result is, and hover over it
  const secondResult = page.locator(".result-card").nth(1)
  await expect(secondResult).toBeVisible()
  const secondResultPos = await secondResult.boundingBox()
  expect(secondResultPos).not.toBeNull()

  // skipcq: JS-0339 - secondResultPos is checked for nullability above
  const { x, y, width, height } = secondResultPos!
  await page.mouse.move(x + width / 2, y + height / 2)

  await search(page, "test")
  // Wait for mouseover to be unlocked
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(5 * mouseFocusDelay)

  const firstResult = page.locator(".result-card").first()
  await expect(firstResult).toHaveClass(/focus/)

  await page.keyboard.press("Enter")
  await page.waitForURL("**/test-page**")
})

test("Footnote table displays within boundaries in search preview (lostpixel)", async ({
  page,
}, testInfo) => {
  test.skip((page.viewportSize()?.width ?? 0) <= tabletBreakpoint)

  await search(page, "test page")

  const previewContainer = page.locator("#preview-container")
  await expect(previewContainer).toBeVisible()

  const tableFootnote = previewContainer.locator("ol #user-content-fn-table")
  await expect(tableFootnote).toBeVisible()
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
      const focusedResults = await page.locator(".result-card.focus").count()
      expect(focusedResults).toBe(1)
    }

    // Navigate up through results
    for (let i = 0; i < totalResults; i++) {
      await page.keyboard.press(up)
      const focusedResults = await page.locator(".result-card.focus").count()
      expect(focusedResults).toBe(1)
    }
  })
})

navigationMethods.forEach(({ down, description }) => {
  test(`${description} navigation changes which page you enter`, async ({ page }) => {
    await search(page, "Testing")
    const firstResult = page.locator(".result-card").first()
    await expect(firstResult).toHaveAttribute("href", "http://localhost:8080/test-page")

    const initialUrl = await firstResult.getAttribute("href")
    await page.keyboard.press(down)
    await page.keyboard.press("Enter")
    await page.waitForURL((url) => url.toString() !== initialUrl)
  })
})

test("Search bar accepts input immediately while index loads", async ({ page }) => {
  // Close search first (opened by beforeEach)
  await page.keyboard.press("Escape")
  const searchContainer = page.locator("#search-container")
  await expect(searchContainer).not.toHaveClass(/active/)

  // Navigate to a fresh page to reset search initialization state
  await page.goto("http://localhost:8080/test-page", { waitUntil: "load" })

  // Intercept contentIndex.json to add a delay, simulating slow index loading
  await page.route("**/contentIndex.json", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    await route.continue()
  })

  // Open search - this triggers index initialization
  await page.keyboard.press("/")
  await expect(page.locator("#search-container")).toHaveClass(/active/)

  // Type immediately without waiting - before the fix, this would be ignored
  // because the search bar was disabled during index loading
  const searchBar = page.locator("#search-bar")
  const testText = "hello"
  await searchBar.pressSequentially(testText, { delay: 20 })

  // The text should appear in the search bar even while loading
  await expect(searchBar).toHaveValue(testText)
})

test("Mobile search results show inline preview slices", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 800 })
  await search(page, "Steering")

  const firstResult = page.locator(".result-card").first()
  const inlinePreview = firstResult.locator(".inline-preview")
  await expect(inlinePreview).toBeAttached()

  // Preview content loads asynchronously
  const article = inlinePreview.locator("article.search-preview")
  await expect(article).toBeAttached({ timeout: 10_000 })
  await expect(article).not.toBeEmpty()
})
