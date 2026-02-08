import { test, expect } from "@playwright/test"
import { promises as fs } from "fs"
import { type Page } from "playwright"

import { minDesktopWidth, maxMobileWidth } from "../../styles/variables"
import { tightScrollTolerance, listTolerance } from "../constants"
import {
  takeRegressionScreenshot,
  setTheme,
  waitForTransitionEnd,
  isDesktopViewport,
  getH1Screenshots,
  isElementChecked,
} from "./visual_utils"

// Visual regression tests don't need assertions
/* eslint-disable playwright/expect-expect */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Mock clipboard API if not available
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", {
        value: {},
        writable: true,
      })
    }

    Object.defineProperty(navigator.clipboard, "writeText", {
      value: () => Promise.resolve(),
      writable: true,
    })
  })

  page.on("pageerror", (err) => console.error(err))

  await page.goto("http://localhost:8080/test-page", { waitUntil: "load" })

  // Dispatch the 'nav' event to initialize clipboard functionality
  await page.evaluate(() => {
    window.dispatchEvent(new Event("nav"))
  })

  // Hide all video and audio controls
  await page.evaluate(() => {
    const mediaElements = document.querySelectorAll("video, audio")
    mediaElements.forEach((media) => {
      media.removeAttribute("controls")
    })
  })
})

async function setDummyContentMeta(page: Page) {
  await page.evaluate(() => {
    const tagsUl = document.querySelector("#tags ul")
    if (tagsUl) {
      tagsUl.innerHTML =
        '<li><a href="/tags/dummy-tag" class="can-trigger-popover tag-link">dummy-tag</a></li>'
    }

    const readingTime = document.querySelector(".reading-time")
    if (readingTime) {
      readingTime.textContent = "Read time: 10 minutes"
    }

    const publicationStr = document.querySelector(".publication-str")
    if (publicationStr) {
      publicationStr.innerHTML =
        'Published on <time datetime="2024-01-01T00:00:00.000Z">January <span class="ordinal-num">1</span><span class="ordinal-suffix">st</span>, 2024</time>'
    }

    const lastUpdatedStr = document.querySelector(".last-updated-str")
    if (lastUpdatedStr) {
      lastUpdatedStr.innerHTML =
        '<a href="#" class="external" target="_blank" rel="noopener noreferrer">Updated</a> on <time datetime="2024-01-02T00:00:00.000Z">January <span class="ordinal-num">2</span><span class="ordinal-suffix">nd</span>, 2024</time>'
    }

    const backlinksUl = document.querySelector("#backlinks-admonition ul")
    if (backlinksUl) {
      backlinksUl.innerHTML = `
        <li><a href="#" class="internal can-trigger-popover">Dummy Backlink 1</a></li>
        <li><a href="#" class="internal can-trigger-popover">Dummy Backlink 2</a></li>
      `
    }
  })
}

test.describe("Test page sections", () => {
  for (const theme of ["dark", "light"]) {
    test(`Normal page in ${theme} mode (lostpixel)`, async ({ page }, testInfo) => {
      await setTheme(page, theme as "light" | "dark")

      await getH1Screenshots(page, testInfo, null, theme as "light" | "dark")
    })
  }
})

test.describe("Unique content around the site", () => {
  test("Welcome page (lostpixel)", async ({ page }, testInfo) => {
    test.skip(
      isDesktopViewport(page) && testInfo.project.use.browserName === "webkit",
      "Flaky in Safari on desktop",
    )

    await page.goto("http://localhost:8080", { waitUntil: "load" })
    await page.locator("body").waitFor({ state: "visible" })

    await page.evaluate(() => {
      const article = document.querySelector("article")
      if (article) {
        const paragraphs = article.querySelectorAll("p")
        paragraphs.forEach((p, idx) => {
          // Keep the first paragraph for testing dropcap
          if (idx > 0) {
            p.remove()
          }
        })
      }
    })

    await takeRegressionScreenshot(page, testInfo, "site-page-welcome")
  })

  for (const pageSlug of ["404"]) {
    test(`${pageSlug} (lostpixel)`, async ({ page }, testInfo) => {
      await page.goto(`http://localhost:8080/${pageSlug}`)
      await page.locator("body").waitFor({ state: "visible" })
      await takeRegressionScreenshot(page, testInfo, `site-page-${pageSlug}`)
    })
  }

  // Several pages update based on new posts
  // Mock the data to prevent needless updating of the screenshots
  for (const pageSlug of ["recent", "tags/personal"]) {
    const url = `http://localhost:8080/${pageSlug}`
    test(`${pageSlug} (lostpixel)`, async ({ page }, testInfo) => {
      await page.goto(url)
      await page.locator("body").waitFor({ state: "visible" })

      // Remove all but the oldest numOldest posts; stable as I add more
      const numOldest = 9
      await page.evaluate((numKeepOldest: number) => {
        const listElement = document.querySelectorAll("ul.section-ul")[0]
        if (!listElement) {
          console.error("Could not find the post list element.")
          return
        }

        const children = listElement.children
        const numTotalChildren = children.length
        const numToRemove = numTotalChildren - numKeepOldest

        // Need to copy the children to remove *before* iterating,
        // as removing modifies the live HTMLCollection
        const childrenToRemove = Array.from(children).slice(0, numToRemove)
        childrenToRemove.forEach((child) => listElement.removeChild(child))

        // Update the number of posts displayed
        const listingText = listElement.querySelector(".page-listing > p")
        if (listingText) {
          listingText.textContent = `Showing ${numKeepOldest} of ${numTotalChildren} posts.`
        }
      }, numOldest)

      await takeRegressionScreenshot(page, testInfo, `recent-posts-oldest-${numOldest}`, {
        elementToScreenshot: page.locator("#center-content"),
      })
    })
  }

  test("All-tags with dummy values", async ({ page }, testInfo) => {
    const url = "http://localhost:8080/all-tags"
    await page.goto(url)
    await page.locator("body").waitFor({ state: "visible" })

    await page.evaluate(() => {
      const tagContainers = document.querySelectorAll(".tag-container")
      tagContainers.forEach((tagContainer, index) => {
        // Don't want look to change as I add more tags
        if (index >= 10) {
          tagContainer.remove()
        }

        const tagLink = tagContainer.querySelector(".tag-link")
        if (!tagLink) throw new Error("Could not get tag link")
        tagLink.textContent = `tag-${index}`

        const tagCount = tagContainer.querySelector(".tag-count")
        if (!tagCount) throw new Error("Could not get tag count")
        tagCount.textContent = `(${index})`
      })
    })

    await takeRegressionScreenshot(page, testInfo, "all-tags-dummy")
  })

  test("Big favicon demo (lostpixel)", async ({ page }, testInfo) => {
    await page.goto("http://localhost:8080/design")
    const bigFaviconDemo = page.locator("#big-favicon-demo")
    await bigFaviconDemo.scrollIntoViewIfNeeded()
    await expect(bigFaviconDemo).toBeVisible()

    await takeRegressionScreenshot(page, testInfo, "design-big-favicon-demo", {
      elementToScreenshot: bigFaviconDemo,
    })
  })

  test("Reward warning (lostpixel)", async ({ page }, testInfo) => {
    await page.goto(
      "http://localhost:8080/a-certain-formalization-of-corrigibility-is-vnm-incoherent",
    )

    const admonition = page.locator(".warning").first()
    await admonition.scrollIntoViewIfNeeded()

    const rewardWarning = admonition.getByText("Reward is not the optimization target").first()
    await expect(rewardWarning).toBeVisible()

    await takeRegressionScreenshot(page, testInfo, "reward-warning", {
      elementToScreenshot: admonition,
    })
  })

  test("LW Question admonition (lostpixel)", async ({ page }, testInfo) => {
    await page.goto("http://localhost:8080/question-about-defining-alignment-in-simple-setting")
    await page.locator("body").waitFor({ state: "visible" })

    const questionAdmonition = page.locator(".admonition.question").first()
    await expect(questionAdmonition).toBeVisible()

    await takeRegressionScreenshot(page, testInfo, "lw-question-admonition", {
      elementToScreenshot: questionAdmonition,
    })
  })

  test("Goose code block (lostpixel)", async ({ page }, testInfo) => {
    await page.goto("http://localhost:8080/open-source")
    await page.locator("body").waitFor({ state: "visible" })

    const gooseCodeBlock = page.locator("#goose-terminal").first()
    await gooseCodeBlock.scrollIntoViewIfNeeded()
    await expect(gooseCodeBlock).toBeVisible()

    await takeRegressionScreenshot(page, testInfo, "open-source-goose-terminal", {
      elementToScreenshot: gooseCodeBlock,
    })
  })
})

test.describe("Table of contents", () => {
  test("TOC is visible (lostpixel)", async ({ page }) => {
    let selector: string
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (isDesktopViewport(page)) {
      selector = "#toc-content"
    } else {
      selector = "*:has(> #toc-content-mobile)"
    }

    await expect(page.locator(selector)).toBeVisible()
  })

  test("Desktop TOC visual test (lostpixel)", async ({ page }, testInfo) => {
    test.skip(!isDesktopViewport(page))

    // Set .simulate-visited on first TOC link child
    const rightSidebar = page.locator("#right-sidebar #table-of-contents")
    const firstTocLink = rightSidebar.locator("a:has(*)").first()
    await firstTocLink.evaluate((el) => el.classList.add("simulate-visited"))

    // Ensure the element can expand to its full height for the screenshot
    await rightSidebar.evaluate((rightSidebar: HTMLElement) => {
      let parent = rightSidebar.parentElement
      while (parent) {
        parent.style.maxHeight = "none"
        parent.style.overflow = "visible"
        parent = parent.parentElement
      }
    })

    await takeRegressionScreenshot(page, testInfo, "toc-visual-test-sidebar", {
      elementToScreenshot: rightSidebar,
    })
  })

  test("TOC visual test (lostpixel)", async ({ page }, testInfo) => {
    test.skip(isDesktopViewport(page))

    // Hide the navbar
    await page.evaluate(() => {
      const navbar = document.getElementById("navbar")
      if (navbar) {
        navbar.style.display = "none"
      }
    })

    const tocContent = page.locator(":has(> #toc-content-mobile)").first()
    await takeRegressionScreenshot(page, testInfo, "toc-visual-test-open", {
      elementToScreenshot: tocContent,
    })
  })

  test("Scrolling down changes TOC highlight", async ({ page }) => {
    test.skip(!isDesktopViewport(page))

    const headerLocator = page.locator("h1").last()
    await headerLocator.scrollIntoViewIfNeeded()
    const tocHighlightLocator = page.locator("#table-of-contents .active").first()
    await expect(tocHighlightLocator).toBeVisible()

    const initialHighlightText = await tocHighlightLocator.textContent()
    expect(initialHighlightText).not.toBeNull()

    const spoilerHeading = page.locator("#spoilers").first()
    await spoilerHeading.scrollIntoViewIfNeeded()

    // Wait for scroll event to fire and TOC to update
    await page.waitForFunction((initialText) => {
      const activeElement = document.querySelector("#table-of-contents .active")
      return activeElement && activeElement.textContent !== initialText
    }, initialHighlightText)

    const highlightText = await tocHighlightLocator.textContent()
    expect(highlightText).not.toBeNull()
    // skipcq: JS-0339
    await expect(tocHighlightLocator).not.toHaveText(initialHighlightText!)
  })
})

test.describe("Layout Breakpoints", () => {
  const breakpoints: { name: string; width: number }[] = [
    { name: "minDesktop", width: Math.ceil(minDesktopWidth) },
    { name: "maxMobile", width: Math.floor(maxMobileWidth) },
  ]
  for (const { name, width } of breakpoints) {
    test(`Layout at breakpoint ${name} (${width}px) (lostpixel)`, async ({ page }, testInfo) => {
      test.skip(!isDesktopViewport(page), "Desktop-only test")

      await page.setViewportSize({ width, height: 480 }) // Don't show much

      await takeRegressionScreenshot(page, testInfo, `layout-breakpoint-${name}-${width}px`)
    })
  }
})

test.describe("Admonitions", () => {
  for (const theme of ["light", "dark"]) {
    test(`Admonition click behaviors in ${theme} mode`, async ({ page }) => {
      await setTheme(page, theme as "light" | "dark")

      const admonition = page.locator("blockquote:has(#test-collapse)").first()
      await admonition.scrollIntoViewIfNeeded()

      // Initial state should be collapsed
      await expect(admonition).toHaveClass(/.*is-collapsed.*/)
      const initialScreenshot = await admonition.screenshot()

      // Click anywhere on admonition should open it
      await admonition.click()
      await expect(admonition).not.toHaveClass(/.*is-collapsed.*/)
      await waitForTransitionEnd(admonition)
      const openedScreenshot = await admonition.screenshot()
      expect(openedScreenshot).not.toEqual(initialScreenshot)

      // Click on content should NOT close it
      const content = admonition.locator(".admonition-content").first()
      await content.click()
      await expect(admonition).not.toHaveClass(/.*is-collapsed.*/)
      const afterContentClickScreenshot = await admonition.screenshot()
      expect(afterContentClickScreenshot).toEqual(openedScreenshot)

      // Click on title should close it
      const title = admonition.locator(".admonition-title").first()
      await title.click()
      await expect(admonition).toHaveClass(/.*is-collapsed.*/)

      await waitForTransitionEnd(admonition)
      await expect(admonition).toBeVisible()
    })
  }

  for (const status of ["open", "collapse"]) {
    test(`Regression testing on fold button appearance in ${status} state (lostpixel)`, async ({
      page,
    }, testInfo) => {
      const element = page.locator(`blockquote:has(#test-${status}) .fold-admonition-icon`).first()
      await element.scrollIntoViewIfNeeded()
      await expect(element).toBeVisible()

      await takeRegressionScreenshot(page, testInfo, `fold-button-appearance-${status}`, {
        elementToScreenshot: element,
        preserveSiblings: true,
      })
    })
  }

  test("color demo text isn't wrapping", async ({ page }) => {
    for (const identifier of ["#light-demo", "#dark-demo"]) {
      // Get all paragraph elements within the demo
      const textElements = page.locator(`${identifier} > div > p`)
      const count = await textElements.count()

      // Iterate through each paragraph element
      for (let i = 0; i < count; i++) {
        const element = textElements.nth(i)

        // Get computed styles for this element
        const computedStyle = await element.evaluate((el) => {
          const styles = window.getComputedStyle(el)
          return {
            lineHeight: parseFloat(styles.lineHeight),
            height: el.getBoundingClientRect().height,
          }
        })

        expect(computedStyle.height).toBeLessThanOrEqual(computedStyle.lineHeight * 1.01)
      }
    }
  })
})

test.describe("Clipboard button", () => {
  for (const theme of ["light", "dark"]) {
    test(`Clipboard button is visible when hovering over code block in ${theme} mode`, async ({
      page,
    }) => {
      await setTheme(page, theme as "light" | "dark")
      const clipboardButton = page.locator(".clipboard-button").first()
      await clipboardButton.scrollIntoViewIfNeeded()
      await expect(clipboardButton).toHaveCSS("opacity", "0")

      const codeBlock = page.locator("figure[data-rehype-pretty-code-figure]").first()
      await codeBlock.hover()
      await expect(clipboardButton).toHaveCSS("opacity", "1")
    })

    test(`Clicking the button changes it in ${theme} mode`, async ({ page }) => {
      await setTheme(page, theme as "light" | "dark")
      const clipboardButton = page.locator(".clipboard-button").first()
      const screenshotBeforeClicking = await clipboardButton.screenshot()

      await clipboardButton.click()
      const screenshotAfterClicking = await clipboardButton.screenshot()
      expect(screenshotAfterClicking).not.toEqual(screenshotBeforeClicking)
    })
  }
})

test.describe("Right sidebar", () => {
  test("Right sidebar scrolls independently", async ({ page }) => {
    test.skip(!isDesktopViewport(page), "Desktop-only test")

    const rightSidebar = page.locator("#right-sidebar")
    await expect(rightSidebar).toBeVisible()

    // Check if the content is actually taller than the sidebar viewport
    const isOverflowing = await rightSidebar.evaluate((el) => {
      return el.scrollHeight > el.clientHeight
    })

    expect(isOverflowing).toBeTruthy()

    const initialWindowScrollY = await page.evaluate(() => window.scrollY)
    const initialSidebarScrollTop = await rightSidebar.evaluate((el) => el.scrollTop)

    // Scroll the sidebar down
    await rightSidebar.evaluate((el) => {
      el.scrollBy(0, 100)
    })

    // Wait a moment for scroll to apply
    await page.waitForFunction(
      (args) => {
        const { initialScrollTop, tolerance } = args
        const rightSidebar = document.querySelector("#right-sidebar")
        if (!rightSidebar) return false
        return Math.abs(rightSidebar.scrollTop - (initialScrollTop + 100)) < tolerance
      },
      { initialScrollTop: initialSidebarScrollTop, tolerance: tightScrollTolerance },
    )

    const finalWindowScrollY = await page.evaluate(() => window.scrollY)
    const finalSidebarScrollTop = await rightSidebar.evaluate((el) => el.scrollTop)

    // Verify window did not scroll
    expect(finalWindowScrollY).toEqual(initialWindowScrollY)

    // Verify sidebar did scroll
    expect(finalSidebarScrollTop).toBeGreaterThan(initialSidebarScrollTop)
    expect(finalSidebarScrollTop).toBeCloseTo(initialSidebarScrollTop + 100, 0) // Allow for slight rounding
  })

  test("ContentMeta is visible (lostpixel)", async ({ page }, testInfo) => {
    await setDummyContentMeta(page)
    await takeRegressionScreenshot(page, testInfo, "content-meta-visible", {
      elementToScreenshot: page.locator("#content-meta"),
    })
  })

  test("ContentMeta first link has hover coloring", async ({ page }) => {
    test.skip(!isDesktopViewport(page), "Desktop-only test")

    await setDummyContentMeta(page)

    const firstLink = page.locator("#content-meta a").first()
    await firstLink.scrollIntoViewIfNeeded()
    await expect(firstLink).toBeVisible()

    const expectedHoverColor = await page.evaluate(() => {
      const dummy = document.createElement("div")
      dummy.style.color = "var(--color-link-hover)"
      document.body.appendChild(dummy)
      const color = getComputedStyle(dummy).color
      dummy.remove()
      return color
    })

    await firstLink.hover()

    // Wait until color matches expected hover color
    await page.waitForFunction(
      ([sel, expected]) => {
        const el = document.querySelector(sel)
        return el && getComputedStyle(el).color === expected
      },
      ["#content-meta a", expectedHoverColor],
    )

    const hoverColor = await firstLink.evaluate((el) => getComputedStyle(el).color)

    expect(hoverColor).toEqual(expectedHoverColor)
  })

  test("Backlinks are visible (lostpixel)", async ({ page }, testInfo) => {
    await setDummyContentMeta(page)
    const backlinks = page.locator("#backlinks").first()
    await backlinks.scrollIntoViewIfNeeded()
    await expect(backlinks).toBeVisible()

    const backlinksTitle = backlinks.locator(".admonition-title").first()
    await backlinksTitle.scrollIntoViewIfNeeded()
    await expect(backlinksTitle).toBeVisible()
    await expect(backlinksTitle).toHaveText("Links to this page")

    // Open the backlinks
    await backlinksTitle.click()
    // Don't hover over the backlinks
    await page.mouse.move(0, 0)
    await takeRegressionScreenshot(page, testInfo, "backlinks-visible", {
      elementToScreenshot: backlinks,
    })
  })
})

test.describe("Spoilers", () => {
  for (const theme of ["light", "dark"]) {
    // Before revealing screenshot is covered in the H1 test

    test(`Spoiler after revealing in ${theme} mode (lostpixel)`, async ({ page }, testInfo) => {
      await setTheme(page, theme as "light" | "dark")
      const spoiler = page.locator(".spoiler-container").first()
      await spoiler.scrollIntoViewIfNeeded()
      await expect(spoiler).toBeVisible()

      await spoiler.click()

      await expect(spoiler).toHaveClass(/revealed/)

      await takeRegressionScreenshot(page, testInfo, "spoiler-after-revealing", {
        elementToScreenshot: spoiler,
      })

      // Click again to close
      await spoiler.click()
      await expect(spoiler).not.toHaveClass(/revealed/)
    })
  }

  test("Tapping spoiler twice re-hides it on mobile", async ({ page }) => {
    test.skip(isDesktopViewport(page), "Mobile-only test")

    const spoiler = page.locator(".spoiler-container").first()
    await spoiler.scrollIntoViewIfNeeded()
    await expect(spoiler).toBeVisible()

    const initialScreenshot = await spoiler.screenshot()

    // Tap to reveal
    await spoiler.click()
    await expect(spoiler).toHaveClass(/revealed/)

    const revealedScreenshot = await spoiler.screenshot()
    expect(revealedScreenshot).not.toEqual(initialScreenshot)

    // Tap again to re-hide
    await spoiler.click()
    await expect(spoiler).not.toHaveClass(/revealed/)

    // Visually verify the spoiler is hidden again without tapping elsewhere
    const rehiddenScreenshot = await spoiler.screenshot()
    expect(rehiddenScreenshot).not.toEqual(revealedScreenshot)
  })

  test("Hovering over spoiler reveals it (lostpixel)", async ({ page }, testInfo) => {
    test.skip(!isDesktopViewport(page), "Desktop-only test")
    // Headless Firefox doesn't reliably apply CSS :hover pseudo-class
    test.skip(testInfo.project.use.browserName === "firefox", "Firefox headless :hover unreliable")

    const spoiler = page.locator(".spoiler-container").first()
    await spoiler.scrollIntoViewIfNeeded()
    await expect(spoiler).toBeVisible()

    const initialScreenshot = await spoiler.screenshot()

    await spoiler.hover()
    const revealedScreenshot = await spoiler.screenshot()
    expect(revealedScreenshot).not.toEqual(initialScreenshot)

    await takeRegressionScreenshot(page, testInfo, "spoiler-hover-reveal", {
      elementToScreenshot: spoiler,
      disableHover: false,
      preserveSiblings: true,
    })
  })
})

test("Single letter dropcaps visual regression (lostpixel)", async ({ page }, testInfo) => {
  const singleLetterDropcaps = page.locator("#single-letter-dropcap")
  await singleLetterDropcaps.scrollIntoViewIfNeeded()
  await takeRegressionScreenshot(page, testInfo, "single-letter-dropcap", {
    elementToScreenshot: singleLetterDropcaps,
  })
})

test.describe("Elvish toggle", () => {
  test("clicking elvish text toggles between Tengwar and English", async ({ page }) => {
    const elvishText = page.locator(".elvish").first()
    await elvishText.scrollIntoViewIfNeeded()

    // Wait for elvish toggle script to initialize
    await expect(elvishText).toHaveAttribute("data-elvish-initialized", "true")

    // Initially should show Tengwar (elvish-tengwar visible, elvish-translation hidden)
    const tengwar = elvishText.locator(".elvish-tengwar")
    const translation = elvishText.locator(".elvish-translation")

    await expect(tengwar).toBeVisible()
    await expect(translation).toBeHidden()

    // Click to toggle to English
    await elvishText.click()

    await expect(tengwar).toBeHidden()
    await expect(translation).toBeVisible()

    // Click again to toggle back to Tengwar
    await elvishText.click()

    await expect(tengwar).toBeVisible()
    await expect(translation).toBeHidden()
  })

  test("toggling elvish text does not cause layout shift", async ({ page }) => {
    test.skip(
      !isDesktopViewport(page),
      "More narrow viewports may have the English translation take more lines than the Elvish, which is fine.",
    )
    const elvishText = page.locator(".elvish").first()
    await elvishText.scrollIntoViewIfNeeded()

    // Wait for elvish toggle script to initialize
    await expect(elvishText).toHaveAttribute("data-elvish-initialized", "true")

    const lowerElt = page.locator(".footnotes").first()
    const lowerEltBoxBefore = await lowerElt.boundingBox()
    expect(lowerEltBoxBefore).not.toBeNull()

    await elvishText.click()

    const lowerEltBoxAfter = await lowerElt.boundingBox()
    expect(lowerEltBoxAfter).not.toBeNull()

    // The element below should not have moved (within 1px tolerance for rounding)
    // skipcq: JS-0339 - boxes are checked for nullability above
    expect(lowerEltBoxAfter!.y).toBeCloseTo(lowerEltBoxBefore!.y, 0)
  })

  test("elvish text maintains dotted underline when showing translation", async ({ page }) => {
    const elvishText = page.locator(".elvish").first()
    await elvishText.scrollIntoViewIfNeeded()

    // Wait for elvish toggle script to initialize
    await expect(elvishText).toHaveAttribute("data-elvish-initialized", "true")

    await elvishText.click()

    const textDecorationStyle = await elvishText.evaluate(
      (el) => window.getComputedStyle(el).textDecorationStyle,
    )
    expect(textDecorationStyle).toBe("dotted")
  })

  test("noscript fallback shows both Tengwar and translation when JS is disabled", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    await page.goto("http://localhost:8080/test-page", { waitUntil: "load" })

    const elvishText = page.locator(".elvish").first()
    await elvishText.scrollIntoViewIfNeeded()

    const tengwar = elvishText.locator(".elvish-tengwar")
    const translation = elvishText.locator(".elvish-translation")

    await expect(tengwar).toBeVisible()
    await expect(translation).toBeVisible()

    await context.close()
  })
})

test.describe("Video Speed Controller visibility", () => {
  test("hides VSC controller for no-vsc videos after img", async ({ page }) => {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div class="vsc-controller">Test</div>
        <img />
        <video class="no-vsc"></video>
      `
    })

    const vscController = page.locator(".vsc-controller")
    await expect(vscController).toBeHidden()
  })
  test("hides VSC controller for no-vsc videos", async ({ page }) => {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div class="vsc-controller">Test</div>
        <video class="no-vsc"></video>
      `
    })

    const vscController = page.locator(".vsc-controller")
    await expect(vscController).toBeHidden()
  })

  test("hides VSC controller for autoplay videos", async ({ page }) => {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div class="vsc-controller">Test</div>
        <video autoplay></video>
      `
    })

    const vscController = page.locator(".vsc-controller")
    await expect(vscController).toBeHidden()
  })

  test("shows VSC controller for regular videos", async ({ page }) => {
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div class="vsc-controller">Test</div>
        <video></video>
      `
    })

    const vscController = page.locator(".vsc-controller")
    await expect(vscController).toBeVisible()
  })

  async function getVideoPlaybackRate(page: Page, videoId: string): Promise<number> {
    return await page.evaluate((id) => {
      const video = document.getElementById(id) as HTMLVideoElement
      return video.playbackRate
    }, videoId)
  }

  const testCases = [
    { name: "no-vsc videos", html: '<video class="no-vsc" id="test-video"></video>' },
    { name: "loop+autoplay videos", html: '<video loop autoplay id="test-video"></video>' },
  ]

  for (const testCase of testCases) {
    test(`locks playback rate to 1.0 for ${testCase.name}`, async ({ page }) => {
      await page.addScriptTag({ path: "quartz/static/scripts/lockVideoPlaybackRate.js" })

      await page.evaluate((html: string) => {
        document.body.innerHTML = html
        // Trigger DOMContentLoaded to run the lockVideoPlaybackRate script
        // @ts-expect-error - DOMContentLoaded is a standard Event, not a CustomEvent
        document.dispatchEvent(new Event("DOMContentLoaded"))
      }, testCase.html)

      const playbackRate = await getVideoPlaybackRate(page, "test-video")
      expect(playbackRate).toBe(1.0)

      // Try to change the playback rate
      await page.evaluate(() => {
        const video = document.getElementById("test-video") as HTMLVideoElement
        video.playbackRate = 2.0
      })

      // Wait for the ratechange event and requestAnimationFrame to reset it back to 1.0
      await expect
        .poll(async () => await getVideoPlaybackRate(page, "test-video"), {
          intervals: [50, 100, 100, 100],
          timeout: 500,
        })
        .toBe(1.0)

      // Verify it was reset back to 1.0
      const resetPlaybackRate = await getVideoPlaybackRate(page, "test-video")
      expect(resetPlaybackRate).toBe(1.0)
    })
  }
})

test("First paragraph is the same before and after clicking on a heading", async ({
  page,
}, testInfo) => {
  const snapshotPath = testInfo.snapshotPath("first-paragraph.png")
  try {
    const firstParagraph = page.locator("#center-content article > p").first()

    // First, assert the initial state against a snapshot.
    // This either creates the snapshot or confirms the element is in the expected state.
    await expect(firstParagraph).toHaveScreenshot("first-paragraph.png", {
      maxDiffPixels: 0,
    })

    // Then, perform the action that might change the state.
    await page.goto(`${page.url()}#header-3`)
    await firstParagraph.scrollIntoViewIfNeeded()

    // Assert that the element's state still matches the original snapshot.
    await expect(firstParagraph).toHaveScreenshot("first-paragraph.png", {
      maxDiffPixels: 0,
    })
  } finally {
    await fs.rm(snapshotPath, { force: true })
  }
})

test.describe("Link color states", () => {
  for (const theme of ["light", "dark"]) {
    test(`Normal vs visited link colors in ${theme} mode (lostpixel)`, async ({
      page,
    }, testInfo) => {
      await setTheme(page, theme as "light" | "dark")

      // Create test HTML with both normal and visited links
      await page.evaluate(() => {
        document.body.innerHTML = `
          <div id="link-test-container" style="padding: 20px; display: flex; flex-direction: column; gap: 10px;">
            <a href="#never-visited" class="internal">Normal internal link</a>
            <a href="#already-visited" class="internal simulate-visited">Visited internal link</a>
            <a href="https://example.com" class="external" target="_blank" rel="noopener noreferrer">Normal external link</a>
            <a href="https://visited.com" class="external simulate-visited" target="_blank" rel="noopener noreferrer">Visited external link</a>
          </div>
        `
      })

      const linkContainer = page.locator("#link-test-container")
      await takeRegressionScreenshot(page, testInfo, `link-colors-${theme}`, {
        elementToScreenshot: linkContainer,
      })
    })
  }
})

test.describe("List alignment", () => {
  for (const { prefix, suffix } of [
    { prefix: "", suffix: "" },
    { prefix: "", suffix: " li" },
    { prefix: "blockquote > ", suffix: "" },
    { prefix: "blockquote > ", suffix: " li" },
    { prefix: "* table ", suffix: "" },
    { prefix: "", suffix: "> label > .checkbox-toggle" },
  ]) {
    test(`First ol li and first ul li have the same x-position (${prefix}...${suffix})`, async ({
      page,
    }) => {
      const firstOlLi = page.locator(`article > ${prefix} ol > li ${suffix}`).first()

      await firstOlLi.scrollIntoViewIfNeeded()
      await expect(firstOlLi).toBeVisible()

      const olPositionLeft = await firstOlLi.evaluate((el) => {
        const rect = el.getBoundingClientRect()
        const paddingLeft = parseFloat(getComputedStyle(el).paddingLeft)
        return rect.left + paddingLeft
      })

      const firstUlLi = page.locator(`article > ${prefix} ul > li ${suffix}`).first()
      await firstUlLi.scrollIntoViewIfNeeded()
      await expect(firstUlLi).toBeVisible()
      const ulPositionLeft = await firstUlLi.evaluate((el) => {
        const rect = el.getBoundingClientRect()
        const paddingLeft = parseFloat(getComputedStyle(el).paddingLeft)
        return rect.left + paddingLeft
      })

      expect(Math.abs(olPositionLeft - ulPositionLeft)).toBeLessThan(listTolerance)
    })
  }
})

test.describe("Checkboxes", () => {
  test("Checkboxes are visible and clickable", async ({ page }) => {
    const checkboxesSection = page.locator("h1:has-text('Checkboxes')")
    await checkboxesSection.scrollIntoViewIfNeeded()

    const firstCheckbox = page.locator("input.checkbox-toggle").first()
    await expect(firstCheckbox).toBeVisible()

    const initialChecked = await isElementChecked(firstCheckbox)
    await firstCheckbox.click()

    await expect(firstCheckbox).toBeChecked({ checked: !initialChecked })
  })

  test("Checkbox state persists across page reloads", async ({ page }) => {
    const checkboxesSection = page.locator("h1:has-text('Checkboxes')")
    await checkboxesSection.scrollIntoViewIfNeeded()

    const firstCheckbox = page.locator("input.checkbox-toggle").first()
    const initialState = await isElementChecked(firstCheckbox)

    // Toggle the checkbox
    await firstCheckbox.click()
    await expect(firstCheckbox).toBeChecked({ checked: !initialState })

    // Reload the page
    await page.reload({ waitUntil: "load" })
    await checkboxesSection.scrollIntoViewIfNeeded()

    // Check if state persisted
    const reloadedCheckbox = page.locator("input.checkbox-toggle").first()
    await expect(reloadedCheckbox).toBeChecked({ checked: !initialState })

    // Clean up: toggle back to initial state
    await reloadedCheckbox.click()
    await expect(reloadedCheckbox).toBeChecked({ checked: initialState })
  })

  test("Checkboxes in admonitions work correctly", async ({ page }) => {
    // Find the note admonition that contains checkboxes (not the one in the footnote)
    const noteAdmonition = page
      .locator(".admonition.note")
      .filter({ has: page.locator("input.checkbox-toggle") })
    await noteAdmonition.scrollIntoViewIfNeeded()

    const admonitionCheckbox = noteAdmonition.locator("input.checkbox-toggle").first()
    await expect(admonitionCheckbox).toBeVisible()

    const initialState = await isElementChecked(admonitionCheckbox)
    await admonitionCheckbox.click()

    await expect(admonitionCheckbox).toBeChecked({ checked: !initialState })
  })

  test("Checkbox states are stored in localStorage", async ({ page }) => {
    const checkboxesSection = page.locator("h1:has-text('Checkboxes')")
    await checkboxesSection.scrollIntoViewIfNeeded()

    const firstCheckbox = page.locator("input.checkbox-toggle").first()
    await firstCheckbox.click()

    // Check localStorage was updated
    const hasLocalStorageKey = await page.evaluate(() => {
      const slug = document.body.dataset.slug
      const key = `${slug}-checkbox-0`
      return localStorage.getItem(key) !== null
    })

    expect(hasLocalStorageKey).toBe(true)
  })

  test.describe("state restoration before first paint", () => {
    const clearCheckboxKeys = () => {
      const keysToRemove = Object.keys(localStorage).filter((key) =>
        key.startsWith("test-page-checkbox-"),
      )
      keysToRemove.forEach((key) => localStorage.removeItem(key))
    }

    // Ensure clean slate before each test
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(clearCheckboxKeys)
    })

    // Clean up after each test
    test.afterEach(async ({ page }) => {
      await page.evaluate(clearCheckboxKeys)
    })

    test("Checkbox state is restored before first paint (no flash of incorrect state)", async ({
      page,
    }) => {
      // This test verifies that checkbox state restoration happens synchronously
      // via MutationObserver in detectInitialState.js, BEFORE the nav event fires.
      // Without this fix, users would see a flash of the wrong checkbox state.

      const checkboxKey = "test-page-checkbox-0"

      // Set up localStorage BEFORE page load to simulate a returning user
      // who previously checked the first checkbox (which defaults to unchecked in HTML)
      await page.addInitScript(
        ({ key }) => {
          localStorage.setItem(key, "true")
        },
        { key: checkboxKey },
      )

      // Navigate to page and wait only for DOM content (not full load)
      // This gives us the earliest possible moment to check checkbox state
      await page.goto("http://localhost:8080/test-page", { waitUntil: "domcontentloaded" })

      // Immediately check checkbox state WITHOUT dispatching nav event
      // Before the fix, this would return the HTML default (unchecked)
      // After the fix, the MutationObserver restores state before we can check
      const checkboxStateBeforeNav = await page.evaluate(() => {
        const checkbox = document.querySelector("input.checkbox-toggle") as HTMLInputElement
        return checkbox?.checked
      })

      expect(checkboxStateBeforeNav).toBe(true)
    })

    const checkboxTestCases = [
      { index: 0, savedState: true, description: "checked" },
      { index: 1, savedState: false, description: "unchecked" },
      { index: 2, savedState: true, description: "checked" },
    ]

    for (const { index, savedState, description } of checkboxTestCases) {
      test(`Checkbox ${index} state (${description}) is restored before first paint`, async ({
        page,
      }) => {
        const checkboxKey = `test-page-checkbox-${index}`

        // Set up localStorage BEFORE page load
        await page.addInitScript(
          ({ key, state }) => {
            localStorage.setItem(key, state ? "true" : "false")
          },
          { key: checkboxKey, state: savedState },
        )

        await page.goto("http://localhost:8080/test-page", { waitUntil: "domcontentloaded" })

        // Check checkbox state immediately without dispatching nav event
        const checkboxState = await page.evaluate(
          ({ idx }) => {
            const checkboxes = document.querySelectorAll("input.checkbox-toggle")
            const checkbox = checkboxes[idx] as HTMLInputElement
            return checkbox?.checked
          },
          { idx: index },
        )

        expect(checkboxState).toBe(savedState)
      })
    }
  })
})

test.describe("Popovers on different page types", () => {
  const pageSlugs = ["all-posts", "tags/personal", "all-tags"]

  for (const pageSlug of pageSlugs) {
    test(`Popover appears on ${pageSlug} page`, async ({ page }) => {
      // Skip on non-desktop viewports since popovers are hidden on mobile/tablet
      test.skip(!isDesktopViewport(page), "Popovers only work on desktop viewports")

      await page.goto(`http://localhost:8080/${pageSlug}`, { waitUntil: "load" })
      await page.locator("body").waitFor({ state: "visible" })

      // Dispatch the 'nav' event to initialize popover functionality
      await page.evaluate(() => {
        window.dispatchEvent(new Event("nav"))
      })

      const popoverLink = page.locator("article a.can-trigger-popover").first()
      await popoverLink.scrollIntoViewIfNeeded()
      await expect(popoverLink).toBeVisible()

      await popoverLink.hover()
      await page.waitForFunction(
        () => {
          const popover = document.querySelector(".popover.popover-visible")
          return popover !== null
        },
        { timeout: 1000 },
      )

      const popover = page.locator(".popover.popover-visible")
      await expect(popover).toBeVisible()
      const popoverInner = popover.locator(".popover-inner")
      await expect(popoverInner).toBeVisible()

      await page.mouse.move(0, 0)
    })
  }
})
