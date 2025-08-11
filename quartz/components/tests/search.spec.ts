import { test, expect, type Page } from "@playwright/test"

import { tabletBreakpoint } from "../../styles/variables"
import {
  searchPlaceholderDesktop,
  searchPlaceholderMobile,
  mouseFocusDelay,
} from "../scripts/search"
import { takeRegressionScreenshot, setTheme, search, showingPreview } from "./visual_utils"

test.beforeEach(async ({ page }) => {
  // Log any console errors
  page.on("pageerror", (err) => console.error(err))

  // Navigate and wait for full initialization
  await page.goto("http://localhost:8080/welcome", { waitUntil: "load" })

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
  test.skip(!showingPreview(page))

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

test("Preview panel shows on desktop and hides on mobile", async ({ page }) => {
  await search(page, "test")

  const previewContainer = page.locator("#preview-container")
  await expect(previewContainer).toBeVisible({ visible: showingPreview(page) })
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

test("Highlighted search terms appear in results", async ({ page }) => {
  await search(page, "test")

  const highlights = page.locator(".highlight")
  await expect(highlights.first()).toContainText("test", { ignoreCase: true })
})

test("Search results are case-insensitive", async ({ page }) => {
  await search(page, "TEST")
  const uppercaseResults = await page.locator(".result-card").all()

  await search(page, "test")
  const lowerCaseResults = await page.locator(".result-card").all()

  expect(uppercaseResults).toEqual(lowerCaseResults)
})

test("Search bar is focused after typing", async ({ page }) => {
  await search(page, "Steering")
  const searchBar = page.locator("#search-bar")
  await expect(searchBar).toBeFocused()
})

test("Search results work for a single character", async ({ page }) => {
  await search(page, "t")

  const results = await page.locator(".result-card").all()

  // If there's only one result, it's probably just "nothing found"
  expect(results).not.toHaveLength(1)
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
      const firstText = await firstResult.textContent()
      expect(firstText?.toLowerCase()).toContain(term.toLowerCase())
      expect(firstText?.startsWith("...")).toBe(false)
    })
  })

  const previewTerms = ["Shrek", "AI presidents", "virus", "Emoji"]
  previewTerms.forEach((term) => {
    test(`Term ${term} is previewed in the viewport`, async ({ page }) => {
      test.skip(!showingPreview(page))
      await search(page, term)

      const previewContent = page.locator("#preview-container > article")
      await expect(previewContent).toBeVisible()

      // Get first highlighted match
      const highlightedMatches = previewContent.locator(`span.highlight:text("${term}")`).first()
      await expect(highlightedMatches).toBeInViewport()
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
    test.skip(!showingPreview(page))
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

// eslint-disable-next-line playwright/expect-expect
test("Search URL updates as we select different results", async ({ page }) => {
  test.skip(!showingPreview(page))

  const initialUrl = page.url()
  await search(page, "Shrek")
  const previewContainer = page.locator("#preview-container")

  const firstResult = page.locator(".result-card").first()
  await firstResult.hover()
  await previewContainer.click()

  await page.waitForURL((url) => url.toString() !== initialUrl)
  const firstResultUrl = page.url()

  await page.keyboard.press("/")
  await search(page, "Shrek")

  const secondResult = page.locator(".result-card").nth(1)
  await secondResult.hover()
  await previewContainer.click()

  const urlsSoFar = new Set([initialUrl, firstResultUrl])
  await page.waitForURL((url) => !urlsSoFar.has(url.toString()))
})

test("Emoji search works and is converted to twemoji (lostpixel)", async ({ page }, testInfo) => {
  test.skip(!showingPreview(page))

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
  test.skip(!showingPreview(page))

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
  test.skip(!showingPreview(page))
  await search(page, "Testing site")

  const previewContainer = page.locator("#preview-container")
  await expect(previewContainer).toBeVisible()
  // Ensures the content loaded
  const previewInner = previewContainer.locator("article")
  await expect(previewInner).toBeVisible()

  await takeRegressionScreenshot(page, testInfo, "search-testing-site-features", {
    elementToScreenshot: previewContainer,
  })
})

test("Search preview shows after bad entry", async ({ page }) => {
  test.skip(!showingPreview(page))
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
  test.skip(!showingPreview(page))

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
  test.skip(!showingPreview(page))
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
  test.skip(!showingPreview(page))

  await search(page, "Testing site")

  const searchPondDropcaps = page.locator("#the-pond-dropcaps")
  await expect(searchPondDropcaps).toBeAttached()
  await searchPondDropcaps.scrollIntoViewIfNeeded()

  await takeRegressionScreenshot(page, testInfo, "search-the-pond-dropcaps", {
    elementToScreenshot: searchPondDropcaps,
  })
})

test("Preview container click navigates to the correct page", async ({ page }) => {
  test.skip(!showingPreview(page))

  // Set viewport to desktop size to ensure preview is visible
  await page.setViewportSize({ width: tabletBreakpoint + 100, height: 800 })

  await search(page, "Testing site")

  // Get the URL of the first result for comparison
  const firstResult = page.locator(".result-card").first()
  const expectedUrl = await firstResult.getAttribute("href")

  // Click the preview container
  const previewContainer = page.locator("#preview-container")
  await previewContainer.click()

  // Verify navigation occurred to the correct URL
  await page.waitForURL(expectedUrl as string)
  await expect(page).toHaveURL(expectedUrl as string)
})

test("Result card highlighting stays synchronized with preview", async ({ page }) => {
  test.skip(!showingPreview(page))

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
  await page.waitForURL("**/test-page")
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
    const initialUrl = firstResult
    await expect(initialUrl).toHaveAttribute("href", "http://localhost:8080/test-page")

    await page.keyboard.press(down)
    await page.keyboard.press("Enter")
    await page.waitForURL((url) => url.toString() !== initialUrl.toString())
  })
})
