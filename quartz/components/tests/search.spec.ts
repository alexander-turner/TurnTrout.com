import { test, expect, Page } from "@playwright/test"

import {
  desktopWidth,
  searchPlaceholderDesktop,
  searchPlaceholderMobile,
  debounceSearchDelay,
} from "../scripts/search"
import { takeArgosScreenshot, setTheme } from "./visual_utils"

const timeToWaitAfterSearch = debounceSearchDelay + 100

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:8080/welcome")
})

async function search(page: Page, term: string) {
  const searchBar = page.locator("#search-bar")
  await searchBar.fill(term)
  await page.waitForTimeout(timeToWaitAfterSearch)
}

function showingPreview(page: Page): boolean {
  const viewportSize = page.viewportSize()
  const shouldShowPreview = viewportSize?.width && viewportSize.width > desktopWidth
  return Boolean(shouldShowPreview)
}

test("Search opens with '/' and closes with Escape", async ({ page }) => {
  const searchContainer = page.locator("#search-container")
  const searchBar = page.locator("#search-bar")

  // Initial state
  await expect(searchContainer).not.toHaveClass(/active/)

  // Open with "/"
  await page.keyboard.press("/")
  await expect(searchContainer).toHaveClass(/active/)
  await expect(searchBar).toBeFocused()

  // Close with Escape
  await page.keyboard.press("Escape")
  await expect(searchContainer).not.toHaveClass(/active/)
})

test("Search results appear and can be navigated", async ({ page }, testInfo) => {
  // Open search
  await page.keyboard.press("/")

  // Type search term
  await search(page, "Steering")

  // Check results appear
  const resultsContainer = page.locator("#results-container")
  await expect(resultsContainer).toBeVisible()
  const resultCards = page.locator(".result-card")
  await expect(resultCards.first()).toContainText("Steering")

  // Navigate with arrow keys
  await page.keyboard.press("ArrowDown")
  const secondResult = resultCards.nth(1)
  await expect(secondResult).toBeFocused()

  // Check that the preview appears if the width is greater than desktopWidth
  const shouldShowPreview = showingPreview(page)
  const previewContainer = page.locator("#preview-container")
  await expect(previewContainer).toBeVisible({ visible: Boolean(shouldShowPreview) })
  // Should have children -- means there's content
  await expect(previewContainer.first()).toBeVisible({ visible: Boolean(shouldShowPreview) })

  // Take screenshot of search results
  await takeArgosScreenshot(page, testInfo, "", {
    element: "#search-layout",
  })
})

test("Nothing shows up for nonsense search terms", async ({ page }) => {
  await page.keyboard.press("/")
  await search(page, "feiwopqclvxk")

  // Assert that there are no results
  const resultCards = page.locator(".result-card")
  await expect(resultCards).toHaveCount(1)
  await expect(resultCards.first()).toContainText("No results")
})

test("Preview panel shows on desktop and hides on mobile", async ({ page }) => {
  await page.keyboard.press("/")
  await search(page, "test")

  const previewContainer = page.locator("#preview-container")
  const viewportSize = page.viewportSize()
  const shouldBeVisible = viewportSize?.width && viewportSize.width > desktopWidth
  await expect(previewContainer).toBeVisible({ visible: Boolean(shouldBeVisible) })
})

test("Search placeholder changes based on viewport", async ({ page }) => {
  const searchBar = page.locator("#search-bar")
  const pageWidth = page.viewportSize()?.width
  const showShortcutPlaceholder = pageWidth && pageWidth >= desktopWidth

  await page.keyboard.press("/")
  await expect(searchBar).toHaveAttribute(
    "placeholder",
    showShortcutPlaceholder ? searchPlaceholderDesktop : searchPlaceholderMobile,
  )
})

test("Highlighted search terms appear in results", async ({ page }) => {
  await page.keyboard.press("/")
  await search(page, "test")

  const highlights = page.locator(".highlight")
  await expect(highlights.first()).toContainText("test", { ignoreCase: true })
})

test("Search results are case-insensitive", async ({ page }) => {
  await page.keyboard.press("/")

  await search(page, "TEST")
  const uppercaseResults = await page.locator(".result-card").all()

  await search(page, "test")
  const lowerCaseResults = await page.locator(".result-card").all()

  expect(uppercaseResults).toEqual(lowerCaseResults)
})

test("Search results work for a single character", async ({ page }) => {
  await page.keyboard.press("/")
  await search(page, "t")

  const results = await page.locator(".result-card").all()

  // If there's only one result, it's probably just "nothing found"
  expect(results).not.toHaveLength(1)
})

test("Enter key navigates to first result", async ({ page }) => {
  const initialUrl = page.url()
  await page.keyboard.press("/")
  await search(page, "test")

  await page.keyboard.press("Enter")

  expect(page.url()).not.toBe(initialUrl)
})

test("Emoji search works and is converted to twemoji", async ({ page }, testInfo) => {
  await page.keyboard.press("/")
  await search(page, "Testing site emoji")

  const firstResult = page.locator(".result-card").first()
  await expect(firstResult).toContainText("Testing Site Features")
  if (showingPreview(page)) {
    await takeArgosScreenshot(page, testInfo, "", {
      element: "#preview-container",
    })
  }

  await firstResult.click()
  expect(page.url()).toBe("http://localhost:8080/test-page")
})

test("Footnote back arrow is properly replaced", async ({ page }, testInfo) => {
  if (!showingPreview(page)) {
    test.skip()
  }
  await page.keyboard.press("/")
  await search(page, "Testing site")

  const footnoteLink = page.locator("#preview-container a[data-footnote-backref]").first()
  await footnoteLink.scrollIntoViewIfNeeded()
  expect(footnoteLink).toContainText("⤴")
  await expect(footnoteLink).toBeVisible()

  await takeArgosScreenshot(page, testInfo, "", {
    element: footnoteLink,
  })
})

test.describe("Image's mix-blend-mode attribute", () => {
  test.beforeEach(async ({ page }) => {
    await page.keyboard.press("/")
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

// Visual regression testing
test("Opens the 'testing site features' page", async ({ page }, testInfo) => {
  await page.keyboard.press("/")
  await search(page, "Testing site")

  // Make sure it looks good
  const viewportSize = page.viewportSize()
  const shouldShowPreview = viewportSize?.width && viewportSize.width > desktopWidth
  if (shouldShowPreview) {
    await takeArgosScreenshot(page, testInfo, "", {
      element: "#preview-container",
    })
  }

  const firstResult = page.locator(".result-card").first()
  await firstResult.click()

  const url = page.url()
  expect(url).toBe("http://localhost:8080/test-page")
})

test("Search preview shows after bad entry", async ({ page }) => {
  if (!showingPreview(page)) {
    test.skip()
  }
  await page.keyboard.press("/")
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

test("The pond dropcaps, search preview visual regression test", async ({ page }, testInfo) => {
  if (!showingPreview(page)) {
    test.skip()
  }

  await page.keyboard.press("/")
  await search(page, "Testing site")
  const searchPondDropcaps = page.locator("#search-the-pond-dropcaps")
  await searchPondDropcaps.scrollIntoViewIfNeeded()

  await takeArgosScreenshot(page, testInfo, "", {
    element: "#search-the-pond-dropcaps",
  })
})

test("Single letter dropcaps, search preview visual regression test", async ({
  page,
}, testInfo) => {
  if (!showingPreview(page)) {
    test.skip()
  }

  await page.goto("http://localhost:8080/test-page")
  const singleLetterDropcaps = page.locator("#single-letter-dropcap")
  await singleLetterDropcaps.scrollIntoViewIfNeeded()
  await takeArgosScreenshot(page, testInfo, "", {
    element: "#single-letter-dropcap",
  })
})

test("The pond dropcaps in preview have a different id, preventing id duplication", async ({
  page,
}) => {
  if (!showingPreview(page)) {
    test.skip()
  }

  await page.keyboard.press("/")
  await search(page, "Testing site")
  const previewPondDropcaps = page.locator("#search-the-pond-dropcaps")
  expect(previewPondDropcaps).toHaveCount(1)
})

test("Preview container click navigates to the correct page on desktop", async ({ page }) => {
  if (!showingPreview(page)) {
    test.skip()
  }

  // Set viewport to desktop size to ensure preview is visible
  await page.setViewportSize({ width: desktopWidth + 100, height: 800 })

  // Open search and type a term
  await page.keyboard.press("/")
  await search(page, "Testing site")

  // Get the URL of the first result for comparison
  const firstResult = page.locator(".result-card").first()
  const expectedUrl = await firstResult.getAttribute("href")

  // Click the preview container
  const previewContainer = page.locator("#preview-container")
  await previewContainer.click()

  // Verify navigation occurred to the correct URL
  expect(page.url()).toBe(expectedUrl)
})
