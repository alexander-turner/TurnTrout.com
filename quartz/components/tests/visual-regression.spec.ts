import { type TestInfo } from "@playwright/test"
import { type Page } from "playwright"

import { maxMobileWidth, minDesktopWidth } from "../../styles/variables"
import {
  forceHslInvertClass,
  listTolerance,
  tightScrollTolerance,
  TOC_DETECTION_BAND_FRACTION,
  TOC_MANUAL_SCROLL_GRACE_MS,
} from "../constants"
import { expect, test } from "./fixtures"
import {
  captureStableScreenshot,
  gotoPage,
  isDesktopViewport,
  isElementChecked,
  isFirefox,
  moveMouseToSafePosition,
  reloadPage,
  setTheme,
  takeRegressionScreenshot,
  WAIT_POLL_INTERVAL_MS,
  waitForTransitionEnd,
} from "./visual_utils"

// Visual regression tests don't need assertions
/* eslint-disable playwright/expect-expect */

// Test constants
const THEMES = ["dark", "light"] as const
const LIGHT_THEMES = ["light", "dark"] as const
const MOCK_PAGE_SLUGS = ["404"]
const DYNAMIC_PAGE_SLUGS = ["recent", "tags/personal"]
const FOLD_STATES = ["open", "collapse"] as const

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

  // Use domcontentloaded instead of load — Firefox can stall on subresource
  // loads (images, fonts) in CI, causing 30s timeout in beforeEach.
  await gotoPage(page, "http://localhost:8080/test-page", "domcontentloaded")

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
        'Published on <time datetime="2024-01-01">January <span class="date-ordinal-num">1</span><span class="ordinal-suffix">st</span>, 2024</time>'
    }

    const lastUpdatedStr = document.querySelector(".last-updated-str")
    if (lastUpdatedStr) {
      lastUpdatedStr.innerHTML =
        '<a href="#" class="external" target="_blank" rel="noopener noreferrer">Updated</a> on <time datetime="2024-01-02">January <span class="date-ordinal-num">2</span><span class="ordinal-suffix">nd</span>, 2024</time>'
    }

    const backlinksUl = document.querySelector("#backlinks .admonition-content ul")
    if (backlinksUl) {
      backlinksUl.innerHTML = `
        <li><a href="#" class="internal can-trigger-popover" title="Read the original post">Dummy Backlink 1</a><a href="#a" class="backlink-excerpt internal can-trigger-popover">[...] the first idea appears when <span class="backlink-highlight">this page</span> is cited in a longer sentence that wraps across several lines [...]</a><a href="#b" class="backlink-excerpt internal can-trigger-popover">a second place where <span class="backlink-highlight">this page</span> is referenced again [...]</a></li>
        <li><a href="#" class="internal can-trigger-popover" title="Read the original post">Dummy Backlink 2</a><a href="#c" class="backlink-excerpt internal can-trigger-popover">A shorter excerpt where the agent <img class="inline-img" src="https://assets.turntrout.com/static/images/chevron.avif" alt="chevron sprite" width="16" height="16"> mentions <span class="backlink-highlight">this page</span> here.</a></li>
      `
    }
  })
}

/**
 * The force-hsl-invert image is post-processed client-side via canvas
 * (accurateInvert.ts) in both themes; its decode/processing timing is
 * nondeterministic in Firefox, producing spurious diffs in the Images section.
 * Hide it there (visibility:hidden preserves layout) so the section stays
 * stable.
 */
async function hideForceHslInvertInFirefox(page: Page, testInfo: TestInfo): Promise<void> {
  if (!isFirefox(testInfo)) return
  await page.evaluate((cls) => {
    document
      .querySelectorAll<HTMLElement>(`img.${cls}`)
      .forEach((img) => (img.style.visibility = "hidden"))
  }, forceHslInvertClass)
}

/**
 * The sidebar and mobile TOCs mirror every heading in test-page.md, so any
 * screenshot including them would churn whenever a section is added, removed,
 * or reordered — regardless of position on the page. Swap in a fixed stub list
 * so every TOC-including shot (the whole-page integration screenshot and the
 * dedicated "Table of contents" screenshots) stays decoupled from the page's
 * heading set. The TOC component's data-driven behavior (active-heading
 * tracking, click delegation) is covered by non-visual tests elsewhere in this
 * file, which don't depend on the stub's exact structure. The stub entries
 * still carry the markup real headings render into (small-caps, inline code,
 * italics, a full-size number prefix) so those styles stay covered here too.
 */
const STUB_TOC_OL = `<ol>
  <li><a href="#stub-one" class="internal same-page-link" data-for="stub-one"><span><abbr class="small-caps">Nasa</abbr> and the moon</span></a></li>
  <li><a href="#stub-two" class="internal same-page-link" data-for="stub-two"><span>Second section with <code class="inline-code">inline_code</code></span></a><ol>
    <li><a href="#stub-two-a" class="internal same-page-link" data-for="stub-two-a"><span>Nested <em>italic</em> entry</span></a></li>
  </ol></li>
  <li><a href="#stub-three" class="internal same-page-link" data-for="stub-three"><span><span class="number-prefix">1984: </span>Full-size numbers</span></a></li>
</ol>`

async function stubTableOfContents(page: Page): Promise<void> {
  await page.evaluate((ol) => {
    document.querySelectorAll("#toc-content, #toc-content-mobile").forEach((el) => {
      el.innerHTML = ol
    })
  }, STUB_TOC_OL)
}

test.describe("Test page sections", () => {
  THEMES.forEach((theme) => {
    // Per-section detail is covered by the isolated fixtures in
    // section-fixtures.spec.ts; this viewport shot is the cross-section
    // integration check (header + how the top sections stack together).
    test(`Normal page in ${theme} mode (screenshot)`, async ({ page }, testInfo) => {
      await setTheme(page, theme as "light" | "dark")

      await hideForceHslInvertInFirefox(page, testInfo)
      await stubTableOfContents(page)

      await takeRegressionScreenshot(page, testInfo, `test-page-normal-${theme}`)
    })
  })
})

// The index page's SPA can replace the document shortly after load, destroying
// the execution context (killing any in-flight page.evaluate) and discarding
// DOM edits made before the swap. waitForFunction survives that: Playwright
// re-injects the predicate into each new context, so mutating inside the poll
// guarantees the edit lands in the document that gets screenshotted. Wait for
// webfonts, drop every paragraph but the dropcap one, and resolve only once
// that state holds.
async function keepOnlyFirstParagraph(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      if (document.fonts?.status !== "loaded") return false
      const article = document.querySelector("article")
      if (!article) return false
      article.querySelectorAll("p").forEach((p, idx) => {
        if (idx > 0) p.remove()
      })
      return article.querySelectorAll("p").length === 1
    },
    undefined,
    { timeout: 10_000, polling: WAIT_POLL_INTERVAL_MS },
  )
}

test.describe("Unique content around the site", () => {
  test("Welcome page (screenshot)", async ({ page }, testInfo) => {
    // Default domcontentloaded gate: takeRegressionScreenshot's viewport-image
    // wait covers image readiness, and a `load` gate can stall on WebKit's
    // never-settling navbar video.
    await gotoPage(page, "http://localhost:8080")
    await page.locator("body").waitFor({ state: "visible" })

    await keepOnlyFirstParagraph(page)

    await takeRegressionScreenshot(page, testInfo, "site-page-welcome")
  })

  MOCK_PAGE_SLUGS.forEach((pageSlug) => {
    test(`${pageSlug} (screenshot)`, async ({ page }, testInfo) => {
      await gotoPage(page, `http://localhost:8080/${pageSlug}`)
      await page.locator("body").waitFor({ state: "visible" })
      await takeRegressionScreenshot(page, testInfo, `site-page-${pageSlug}`)
    })
  })

  // Several pages update based on new posts
  // Mock the data to prevent needless updating of the screenshots
  DYNAMIC_PAGE_SLUGS.forEach((pageSlug) => {
    const url = `http://localhost:8080/${pageSlug}`

    test(`${pageSlug} (screenshot)`, async ({ page }, testInfo) => {
      await gotoPage(page, url)
      await page.locator("body").waitFor({ state: "visible" })

      // Remove all but the oldest numOldest posts; stable as I add more
      const numOldest = 5
      await page.evaluate((numKeepOldest: number) => {
        const listElement = document.querySelectorAll("ul.page-listing-list")[0]
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

        // Mock the total-count paragraph so the screenshot stays stable as
        // posts/tagged pages are added. The all-posts ("recent") page renders
        // it as "This site has N blog posts."; tag pages render it as
        // "N items with this tag." Replace the count with the number of items
        // actually shown so the text stays consistent with the trimmed list.
        const countParagraph =
          document.querySelector("#center-content article > p") ??
          document.querySelector("#center-content .page-listing > p")
        if (countParagraph?.textContent) {
          countParagraph.textContent = countParagraph.textContent.replace(
            /\d+/,
            String(numKeepOldest),
          )
        }
      }, numOldest)

      await takeRegressionScreenshot(page, testInfo, `recent-posts-oldest-${numOldest}`, {
        elementToScreenshot: page.locator("#center-content"),
      })
    })
  })

  test("All-tags with dummy values (screenshot)", async ({ page }, testInfo) => {
    const url = "http://localhost:8080/all-tags"
    await gotoPage(page, url)
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

  test("Big favicon demo (screenshot)", async ({ page }, testInfo) => {
    await gotoPage(page, "http://localhost:8080/design", "domcontentloaded")
    const bigFaviconDemo = page.locator("#big-favicon-demo")
    await bigFaviconDemo.scrollIntoViewIfNeeded()
    await expect(bigFaviconDemo).toBeVisible()

    await takeRegressionScreenshot(page, testInfo, "design-big-favicon-demo", {
      elementToScreenshot: bigFaviconDemo,
    })
  })

  test("Reward warning (screenshot)", async ({ page }, testInfo) => {
    await gotoPage(
      page,
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

  test("LW Question admonition (screenshot)", async ({ page }, testInfo) => {
    await gotoPage(
      page,
      "http://localhost:8080/question-about-defining-alignment-in-simple-setting",
    )
    await page.locator("body").waitFor({ state: "visible" })

    const questionAdmonition = page.locator(".admonition.question").first()
    await expect(questionAdmonition).toBeVisible()

    await takeRegressionScreenshot(page, testInfo, "lw-question-admonition", {
      elementToScreenshot: questionAdmonition,
    })
  })

  test("Goose code block (screenshot)", async ({ page }, testInfo) => {
    await gotoPage(page, "http://localhost:8080/goose-fixture")
    await page.locator("body").waitFor({ state: "visible" })

    const gooseCodeBlock = page.locator("#goose-terminal").first()
    await gooseCodeBlock.scrollIntoViewIfNeeded()
    await expect(gooseCodeBlock).toBeVisible()

    await takeRegressionScreenshot(page, testInfo, "open-source-goose-terminal", {
      elementToScreenshot: gooseCodeBlock,
    })
  })

  for (const theme of LIGHT_THEMES) {
    test(`GDM signature in ${theme} mode (screenshot)`, async ({ page }, testInfo) => {
      await gotoPage(page, "http://localhost:8080/gdm-signature-fixture")
      await setTheme(page, theme)

      const signature = page.locator("#gdm-signature").first()
      await signature.scrollIntoViewIfNeeded()
      await expect(signature).toBeVisible()
      // The name renders in the serif face; wait for fonts so its metrics are
      // settled before the shot.
      await page.evaluate(() => document.fonts.ready)

      await takeRegressionScreenshot(page, testInfo, `gdm-signature-${theme}`, {
        elementToScreenshot: signature,
      })
    })
  }

  for (const theme of LIGHT_THEMES) {
    test(`Inversion demo in ${theme} mode (screenshot)`, async ({ page }, testInfo) => {
      await gotoPage(page, "http://localhost:8080/inversion-demo-fixture")
      await setTheme(page, theme)

      const figure = page.locator("main figure").first()
      await figure.scrollIntoViewIfNeeded()
      await expect(figure).toBeVisible()
      // Wait for every subfigure image to decode so the comparison is stable.
      for (const img of await figure.locator("img").all()) {
        await expect(img).toHaveJSProperty("complete", true)
      }

      await takeRegressionScreenshot(page, testInfo, `inversion-demo-${theme}`, {
        elementToScreenshot: figure,
      })
    })
  }

  for (const theme of LIGHT_THEMES) {
    test(`Cheese network architecture Mermaid diagrams in ${theme} mode (screenshot)`, async ({
      page,
    }, testInfo) => {
      await gotoPage(page, "http://localhost:8080/cheese-network-architecture-fixture")
      await setTheme(page, theme)
      // Fonts drive Mermaid label metrics; wait so the layout is stable.
      await page.evaluate(() => document.fonts.ready)

      const diagrams = page.locator('svg[id*="mermaid"]')
      await expect(diagrams).toHaveCount(2)

      const names = ["blocks", "forward-pass"]
      for (const [index, name] of names.entries()) {
        const diagram = diagrams.nth(index)
        await diagram.scrollIntoViewIfNeeded()
        await expect(diagram).toBeVisible()

        await takeRegressionScreenshot(
          page,
          testInfo,
          `cheese-network-architecture-${name}-${theme}`,
          {
            elementToScreenshot: diagram,
          },
        )
      }
    })
  }
})

test.describe("Table of contents", () => {
  test("TOC is visible (screenshot)", async ({ page }) => {
    let selector: string
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (isDesktopViewport(page)) {
      selector = "#toc-content"
    } else {
      selector = "*:has(> #toc-content-mobile)"
    }

    await expect(page.locator(selector)).toBeVisible()
  })

  test("Desktop TOC visual test (screenshot)", async ({ page }, testInfo) => {
    test.skip(!isDesktopViewport(page))

    // Decouple this shot from test-page.md's heading set (see stubTableOfContents).
    await stubTableOfContents(page)

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

  test("TOC visual test (screenshot)", async ({ page }, testInfo) => {
    test.skip(isDesktopViewport(page))

    // Decouple this shot from test-page.md's heading set (see stubTableOfContents).
    await stubTableOfContents(page)

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

  test("Mobile TOC: clicking the <li> navigates via click delegation", async ({ page }) => {
    test.skip(isDesktopViewport(page))

    const firstLi = page.locator("#toc-content-mobile > ol > li").first()
    await expect(firstLi).toBeVisible()

    const href = await firstLi.locator("> a").getAttribute("href")

    // Dispatch a click directly on the <li>. When negative text-indent shifts
    // the <a>'s text outside its layout box, taps near the left edge hit the
    // <li> instead of the <a>. The click delegation handler on
    // #toc-content-mobile should forward the click to the child <a>.
    await firstLi.dispatchEvent("click")
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(href)
  })

  test("Scrolling down changes TOC highlight", async ({ page }) => {
    test.skip(!isDesktopViewport(page))

    // Wait for the TOC observer to initialize and set an active link
    await page.waitForFunction(
      () => document.querySelector("#table-of-contents .active") !== null,
      null,
      { timeout: 15_000, polling: WAIT_POLL_INTERVAL_MS },
    )

    // Scroll a mid-page heading to the top of the viewport so it enters
    // the IntersectionObserver's detection zone (top 30%).
    // Wait for a rAF after scrolling so the IntersectionObserver processes the change.
    await page.evaluate(() => {
      document.querySelector("#spoilers")?.scrollIntoView({ block: "start" })
      return new Promise((resolve) => requestAnimationFrame(resolve))
    })
    await page.waitForFunction(
      () => document.querySelector("#table-of-contents .active")?.textContent?.trim() !== "",
      null,
      { timeout: 15_000, polling: WAIT_POLL_INTERVAL_MS },
    )

    // Need the raw string to pass into waitForFunction below
    const initialHighlightText = await page
      .locator("#table-of-contents .active")
      .first()
      .textContent()
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (!initialHighlightText) {
      throw new Error("Expected initial TOC highlight text to be non-null")
    }

    // Scroll to a different heading, wait for rAF so IntersectionObserver fires
    await page.evaluate(() => {
      document.querySelector("#lists")?.scrollIntoView({ block: "start" })
      return new Promise((resolve) => requestAnimationFrame(resolve))
    })

    // Wait for IntersectionObserver to fire and TOC to update
    await page.waitForFunction(
      (initialText) => {
        const activeElement = document.querySelector("#table-of-contents .active")
        return activeElement && activeElement.textContent !== initialText
      },
      initialHighlightText,
      { timeout: 15_000, polling: WAIT_POLL_INTERVAL_MS },
    )

    const highlightText = page.locator("#table-of-contents .active").first()
    await expect(highlightText).not.toHaveText(initialHighlightText)
  })

  test("Re-initializing while scrolled past the detection band highlights the passed heading", async ({
    page,
  }) => {
    test.skip(!isDesktopViewport(page))

    await page.waitForFunction(
      () => document.querySelector("#table-of-contents .active") !== null,
      null,
      { timeout: 15_000, polling: WAIT_POLL_INTERVAL_MS },
    )

    // Reproduce a fresh load that lands below every heading: scroll past the
    // detection band so no heading intersects it, then re-run the TOC setup
    // the way a `nav` dispatch would. This exercises the scroll fallback, not
    // the IntersectionObserver's visible-section branch.
    const { expectedSlug, firstSlug, headingsInBand } = await page.evaluate((bandFraction) => {
      const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("#toc-content a"))
      const navSlugs = new Set(navLinks.map((l) => l.getAttribute("href")?.split("#")[1]))
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>(
          "#center-content article h1, #center-content article h2",
        ),
      ).filter((s) => s.id && navSlugs.has(s.id))

      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" })

      const boundary = window.innerHeight * bandFraction
      const headingsInBand = sections.filter((s) => {
        const rect = s.getBoundingClientRect()
        return rect.top < boundary && rect.bottom > 0
      }).length

      // Mirror getActiveSectionByScroll: last heading scrolled above the band.
      let expected = ""
      for (const s of sections) {
        if (s.getBoundingClientRect().top > boundary) break
        expected = s.id
      }

      document.dispatchEvent(new CustomEvent("nav", { detail: { url: window.location.pathname } }))
      return { expectedSlug: expected, firstSlug: sections[0]?.id ?? "", headingsInBand }
    }, TOC_DETECTION_BAND_FRACTION)

    // Guard that the scenario is meaningful: the fallback (not the observer)
    // must drive the result, and the answer must differ from the first entry
    // that the buggy code left stuck.
    expect(headingsInBand).toBe(0)
    expect(expectedSlug).not.toBe(firstSlug)

    await page.waitForFunction(
      (slug) => {
        const active = document.querySelector("#table-of-contents .active")
        return active?.getAttribute("href")?.split("#")[1] === slug
      },
      expectedSlug,
      { timeout: 15_000, polling: WAIT_POLL_INTERVAL_MS },
    )
  })

  const waitForActiveHref = (page: Page, slug: string) =>
    page.waitForFunction(
      (target) =>
        document
          .querySelector("#toc-content a.active")
          ?.getAttribute("href")
          ?.endsWith(`#${target}`) ?? false,
      slug,
      { timeout: 15_000, polling: WAIT_POLL_INTERVAL_MS },
    )

  const activateHeading = (page: Page, slug: string) =>
    page.evaluate((target) => {
      document.getElementById(target)?.scrollIntoView({ block: "start" })
      return new Promise((resolve) => requestAnimationFrame(resolve))
    }, slug)

  test("Auto-scrolls the sidebar to keep the active link visible", async ({ page }) => {
    test.skip(!isDesktopViewport(page))
    // Reduced motion forces the sidebar's scroll-behavior to auto (instant), so
    // positions settle synchronously and assertions stay deterministic.
    await page.emulateMedia({ reducedMotion: "reduce" })

    const rightSidebar = page.locator("#right-sidebar")
    await expect(rightSidebar).toBeVisible()
    expect(await rightSidebar.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)

    await page.waitForFunction(
      () => document.querySelector("#toc-content a.active") !== null,
      null,
      {
        timeout: 15_000,
        polling: WAIT_POLL_INTERVAL_MS,
      },
    )

    // The last observable (h1/h2) heading that still has >= 2 ToC entries after
    // it, so both the active link and its 2-entry scrolloff buffer are testable.
    const target = await page.evaluate(() => {
      const navLinks = Array.from(document.querySelectorAll("#toc-content a"))
      const slugs = navLinks.map((l) => l.getAttribute("href")?.split("#")[1] ?? "")
      const navSet = new Set(slugs)
      const sections = Array.from(
        document.querySelectorAll("#center-content article h1, #center-content article h2"),
      ).filter((s) => s.id && navSet.has(s.id))
      for (let i = sections.length - 1; i >= 0; i--) {
        const linkIdx = slugs.indexOf(sections[i].id)
        if (linkIdx >= 0 && linkIdx + 2 <= navLinks.length - 1) {
          return { slug: sections[i].id, bufferIdx: linkIdx + 2 }
        }
      }
      return null
    })
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (!target) throw new Error("No observable heading with a 2-entry buffer on the test page")

    const initialScrollTop = await rightSidebar.evaluate((el) => el.scrollTop)
    await activateHeading(page, target.slug)
    await waitForActiveHref(page, target.slug)

    const down = await page.evaluate((bufferIdx) => {
      const sidebar = document.getElementById("right-sidebar")
      const active = document.querySelector("#toc-content a.active")
      const buffer = Array.from(document.querySelectorAll("#toc-content a"))[bufferIdx]
      if (!sidebar || !active || !buffer) return null
      const s = sidebar.getBoundingClientRect()
      const a = active.getBoundingClientRect()
      const b = buffer.getBoundingClientRect()
      return {
        scrollTop: sidebar.scrollTop,
        activeVisible: a.top >= s.top - 1 && a.bottom <= s.bottom + 1,
        bufferVisible: b.bottom <= s.bottom + 1,
      }
    }, target.bufferIdx)
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (!down) throw new Error("Expected sidebar, active link, and buffer link to exist")
    expect(down.scrollTop).toBeGreaterThan(initialScrollTop)
    expect(down.activeVisible).toBe(true)
    expect(down.bufferVisible).toBe(true)

    // Scrolling back to the top re-syncs the sidebar upward: it scrolls up from
    // its down position and the newly active link returns to view. (It need not
    // land exactly at 0 — the first link sits below the list's padding.)
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: "instant" })
      return new Promise((resolve) => requestAnimationFrame(resolve))
    })
    await page.waitForFunction(
      (prevTop) => {
        const sidebar = document.getElementById("right-sidebar")
        const active = document.querySelector("#toc-content a.active")
        if (!sidebar || !active) return false
        const s = sidebar.getBoundingClientRect()
        const a = active.getBoundingClientRect()
        const visible = a.top >= s.top - 1 && a.bottom <= s.bottom + 1
        return sidebar.scrollTop < prevTop && visible
      },
      down.scrollTop,
      { timeout: 15_000, polling: WAIT_POLL_INTERVAL_MS },
    )
  })

  test("A manually scrolled sidebar is not yanked back within the grace period", async ({
    page,
  }) => {
    test.skip(!isDesktopViewport(page))
    await page.emulateMedia({ reducedMotion: "reduce" })

    // Shrink the viewport height (keeping the desktop width) so only a handful
    // of ToC entries fit: middle and late headings are then reliably off-screen
    // regardless of how much the real ToC overflows.
    const viewport = page.viewportSize()
    await page.setViewportSize({
      width: viewport?.width ?? Math.ceil(minDesktopWidth) + 400,
      height: 500,
    })

    const rightSidebar = page.locator("#right-sidebar")
    await expect(rightSidebar).toBeVisible()
    expect(await rightSidebar.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)

    await page.waitForFunction(
      () => document.querySelector("#toc-content a.active") !== null,
      null,
      {
        timeout: 15_000,
        polling: WAIT_POLL_INTERVAL_MS,
      },
    )

    // The last observable (h1/h2) heading always wins the detection band when
    // scrolled to (nothing follows it), and a middle heading well-separated from
    // it — both reliably activatable, both with ToC links below the fold when
    // the sidebar sits at the top.
    const headings = await page.evaluate(() => {
      const navSet = new Set(
        Array.from(document.querySelectorAll("#toc-content a")).map(
          (l) => l.getAttribute("href")?.split("#")[1] ?? "",
        ),
      )
      const observable = Array.from(
        document.querySelectorAll("#center-content article h1, #center-content article h2"),
      )
        .filter((s) => s.id && navSet.has(s.id))
        .map((s) => s.id)
      return { mid: observable[Math.floor(observable.length / 2)], last: observable.at(-1) }
    })
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (!headings.mid || !headings.last || headings.mid === headings.last) {
      throw new Error("Test page needs >= 3 well-separated observable headings")
    }

    // The reader scrolls the sidebar to the top, marking manual intent via the
    // wheel event. (Top, so a suppressed re-sync would have to scroll *down* to
    // reveal the active link — making the stayed-put assertion meaningful.)
    const manualAt = await page.evaluate(() => {
      const sidebar = document.getElementById("right-sidebar")
      if (!sidebar) return null
      sidebar.scrollTop = 0
      sidebar.dispatchEvent(new WheelEvent("wheel", { bubbles: true }))
      return performance.now()
    })
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (manualAt === null) throw new Error("#right-sidebar not found")

    // Activating the last heading changes the active section, but the sidebar
    // must NOT scroll while the grace period is active. The active-link poll
    // resolves within a frame, far inside the multi-second grace, so this does
    // not race the clock.
    await activateHeading(page, headings.last)
    await waitForActiveHref(page, headings.last)
    const suppressed = await page.evaluate(() => {
      const sidebar = document.getElementById("right-sidebar")
      const active = document.querySelector("#toc-content a.active")
      if (!sidebar || !active) return null
      const s = sidebar.getBoundingClientRect()
      const a = active.getBoundingClientRect()
      return { scrollTop: sidebar.scrollTop, activeBelowFold: a.top > s.bottom }
    })
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (!suppressed) throw new Error("Expected sidebar and active link to exist")
    // The active link is below the fold, so auto-scroll WOULD move the sidebar
    // were it not suppressed — the stayed-at-0 assertion is therefore meaningful.
    expect(suppressed.activeBelowFold).toBe(true)
    expect(suppressed.scrollTop).toBe(0)

    // Once the grace period lapses, the next section change re-syncs the sidebar
    // — here scrolling down to reveal the middle heading's link.
    await page.waitForFunction(
      ([start, grace]) => performance.now() - start > grace,
      [manualAt, TOC_MANUAL_SCROLL_GRACE_MS],
      { timeout: 15_000, polling: WAIT_POLL_INTERVAL_MS },
    )
    await activateHeading(page, headings.mid)
    await waitForActiveHref(page, headings.mid)
    const resynced = await page.evaluate(() => {
      const sidebar = document.getElementById("right-sidebar")
      const active = document.querySelector("#toc-content a.active")
      if (!sidebar || !active) return null
      const s = sidebar.getBoundingClientRect()
      const a = active.getBoundingClientRect()
      return {
        scrollTop: sidebar.scrollTop,
        activeVisible: a.top >= s.top - 1 && a.bottom <= s.bottom + 1,
      }
    })
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (!resynced) throw new Error("Expected sidebar and active link to exist after re-sync")
    expect(resynced.scrollTop).toBeGreaterThan(0)
    expect(resynced.activeVisible).toBe(true)
  })

  test("Auto-scroll leaves the mobile sidebar alone", async ({ page }) => {
    test.skip(isDesktopViewport(page))
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))

    await page.waitForFunction(() => document.querySelector("#toc-content a") !== null, null, {
      timeout: 15_000,
      polling: WAIT_POLL_INTERVAL_MS,
    })

    await page.evaluate(() => {
      const headings = document.querySelectorAll(
        "#center-content article h1, #center-content article h2",
      )
      headings[Math.floor(headings.length / 2)]?.scrollIntoView({ block: "start" })
      return new Promise((resolve) => requestAnimationFrame(resolve))
    })

    const scrollTop = await page.evaluate(
      () => document.getElementById("right-sidebar")?.scrollTop ?? -1,
    )
    expect(scrollTop).toBe(0)
    expect(errors).toEqual([])
  })
})

test.describe("Layout Breakpoints", () => {
  const breakpoints: { name: string; width: number }[] = [
    { name: "minDesktop", width: Math.ceil(minDesktopWidth) },
    { name: "maxMobile", width: Math.floor(maxMobileWidth) },
  ]
  for (const { name, width } of breakpoints) {
    test(`Layout at breakpoint ${name} (${width}px) (screenshot)`, async ({ page }, testInfo) => {
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
      // The opened and after-content-click captures compare byte-for-byte,
      // so both must be stable frames rather than raw one-shot captures.
      const openedScreenshot = await captureStableScreenshot(
        () => admonition.screenshot(),
        `admonition-opened-${theme}`,
      )
      expect(openedScreenshot).not.toEqual(initialScreenshot)

      // Click on content should NOT close it
      const content = admonition.locator(".admonition-content").first()
      await content.click()
      await expect(admonition).not.toHaveClass(/.*is-collapsed.*/)
      const afterContentClickScreenshot = await captureStableScreenshot(
        () => admonition.screenshot(),
        `admonition-after-content-click-${theme}`,
      )
      expect(afterContentClickScreenshot).toEqual(openedScreenshot)

      // Click on title should close it
      const title = admonition.locator(".admonition-title").first()
      await title.click()
      await expect(admonition).toHaveClass(/.*is-collapsed.*/)

      await waitForTransitionEnd(admonition)
      await expect(admonition).toBeVisible()
    })
  }

  FOLD_STATES.forEach((status) => {
    test(`Regression testing on fold button appearance in ${status} state (screenshot)`, async ({
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
  })

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
  LIGHT_THEMES.forEach((theme) => {
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
  })
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

    expect(isOverflowing).toBe(true)

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
      { polling: WAIT_POLL_INTERVAL_MS },
    )

    const finalWindowScrollY = await page.evaluate(() => window.scrollY)
    const finalSidebarScrollTop = await rightSidebar.evaluate((el) => el.scrollTop)

    // Verify window did not scroll
    expect(finalWindowScrollY).toEqual(initialWindowScrollY)

    // Verify sidebar did scroll
    expect(finalSidebarScrollTop).toBeGreaterThan(initialSidebarScrollTop)
    expect(finalSidebarScrollTop).toBeCloseTo(initialSidebarScrollTop + 100, 0) // Allow for slight rounding
  })

  test("Right sidebar fades top/bottom based on scroll position", async ({ page }) => {
    test.skip(!isDesktopViewport(page), "Desktop-only test")

    const rightSidebar = page.locator("#right-sidebar")
    await expect(rightSidebar).toBeVisible()

    const overflows = await rightSidebar.evaluate((el) => el.scrollHeight > el.clientHeight)
    expect(overflows).toBe(true)

    // At the top: only the bottom fade should be active (more content below).
    await rightSidebar.evaluate((el) => {
      el.scrollTop = 0
    })
    await expect(rightSidebar).not.toHaveClass(/can-scroll-up/)
    await expect(rightSidebar).toHaveClass(/can-scroll-down/)

    // Halfway through the scrollable range: both fades active.
    await rightSidebar.evaluate((el) => {
      el.scrollTop = Math.floor((el.scrollHeight - el.clientHeight) / 2)
    })
    await expect(rightSidebar).toHaveClass(/can-scroll-up/)
    await expect(rightSidebar).toHaveClass(/can-scroll-down/)

    // At the bottom: only the top fade should be active.
    await rightSidebar.evaluate((el) => {
      el.scrollTop = el.scrollHeight - el.clientHeight
    })
    await expect(rightSidebar).toHaveClass(/can-scroll-up/)
    await expect(rightSidebar).not.toHaveClass(/can-scroll-down/)
  })

  test("Right sidebar fade at mid-scroll (screenshot)", async ({ page }, testInfo) => {
    test.skip(!isDesktopViewport(page), "Desktop-only test")

    const rightSidebar = page.locator("#right-sidebar")
    await expect(rightSidebar).toBeVisible()

    // Replace the real TOC with a synthetic list so the baseline doesn't drift
    // when test-page.md adds or removes headings.
    await page.evaluate(() => {
      const ol = document.querySelector("#toc-content > ol")
      if (!ol) throw new Error("TOC ol not found")
      ol.innerHTML = Array.from({ length: 40 }, () => "<li><a>Test heading</a></li>").join("")
    })

    // Scroll halfway through the (now-overflowing) sidebar so both fades show.
    await rightSidebar.evaluate((el) => {
      el.scrollTop = Math.floor((el.scrollHeight - el.clientHeight) / 2)
    })
    await expect(rightSidebar).toHaveClass(/can-scroll-up/)
    await expect(rightSidebar).toHaveClass(/can-scroll-down/)

    await takeRegressionScreenshot(page, testInfo, "right-sidebar-fade-mid-scroll", {
      elementToScreenshot: rightSidebar,
    })
  })

  test("ContentMeta is visible (screenshot)", async ({ page }, testInfo) => {
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
      { polling: WAIT_POLL_INTERVAL_MS },
    )

    const hoverColor = await firstLink.evaluate((el) => getComputedStyle(el).color)

    expect(hoverColor).toEqual(expectedHoverColor)
  })

  test("Backlinks are visible (screenshot)", async ({ page }, testInfo) => {
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
    await moveMouseToSafePosition(page)
    await takeRegressionScreenshot(page, testInfo, "backlinks-visible", {
      elementToScreenshot: backlinks,
    })
  })

  // ContentMeta (and thus backlinks) is visible on both desktop and mobile, so this
  // screenshot runs across every viewport project to cover the stacked mobile layout.
  test("Backlink excerpts render below titles (screenshot)", async ({ page }, testInfo) => {
    await setDummyContentMeta(page)
    const backlinks = page.locator("#backlinks").first()
    await backlinks.scrollIntoViewIfNeeded()

    const backlinksTitle = backlinks.locator(".admonition-title").first()
    await backlinksTitle.click()

    const firstExcerpt = backlinks.locator(".backlink-excerpt").first()
    await firstExcerpt.scrollIntoViewIfNeeded()
    await expect(firstExcerpt).toBeVisible()
    await expect(backlinks.locator(".backlink-highlight").first()).toBeVisible()

    await moveMouseToSafePosition(page)
    await takeRegressionScreenshot(page, testInfo, "backlink-excerpts", {
      elementToScreenshot: backlinks,
    })
  })
})

test.describe("Spoilers", () => {
  for (const theme of ["light", "dark"]) {
    // Before revealing screenshot is covered in the H1 test

    test(`Spoiler after revealing in ${theme} mode (screenshot)`, async ({ page }, testInfo) => {
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

  test("Clicking spoiler twice re-hides it", async ({ page }) => {
    const spoiler = page.locator(".spoiler-container").first()
    await spoiler.scrollIntoViewIfNeeded()
    await expect(spoiler).toBeVisible()

    const initialScreenshot = await spoiler.screenshot()

    // Click to reveal
    await spoiler.click()
    await expect(spoiler).toHaveClass(/revealed/)

    const revealedScreenshot = await spoiler.screenshot()
    expect(revealedScreenshot).not.toEqual(initialScreenshot)

    // Click again to re-hide
    await spoiler.click()
    await expect(spoiler).not.toHaveClass(/revealed/)

    // Visually verify the spoiler is hidden again
    const rehiddenScreenshot = await spoiler.screenshot()
    expect(rehiddenScreenshot).not.toEqual(revealedScreenshot)
  })
})

test("Single letter dropcaps visual regression (screenshot)", async ({ page }, testInfo) => {
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

    // Use page.goto directly instead of gotoPage, because gotoPage calls
    // page.waitForFunction (for SPA router init) which requires JS execution.
    await page.goto("http://localhost:8080/test-page", { waitUntil: "load" })

    const elvishText = page.locator(".elvish").first()

    const tengwar = elvishText.locator(".elvish-tengwar")
    const translation = elvishText.locator(".elvish-translation")

    // Use CSS visibility checks only -- scrollIntoViewIfNeeded() executes JS
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

  const videoTestCases = [
    { name: "no-vsc videos", html: '<video class="no-vsc" id="test-video"></video>' },
    { name: "loop+autoplay videos", html: '<video loop autoplay id="test-video"></video>' },
  ]

  videoTestCases.forEach((testCase) => {
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

      // The lock shadows the setter, so the write is blocked before it
      // lands and the rate reads 1.0 with no settling wait.
      const resetPlaybackRate = await getVideoPlaybackRate(page, "test-video")
      expect(resetPlaybackRate).toBe(1.0)
    })
  })
})

test("First paragraph is the same before and after clicking on a heading", async ({ page }) => {
  const firstParagraph = page.locator("#center-content article > p").first()

  // The captures compare byte-for-byte, so the webfont swap must complete
  // before the first one and each capture must be a stable frame.
  await page.evaluate(() => document.fonts.ready)
  const screenshotBefore = await captureStableScreenshot(
    () => firstParagraph.screenshot(),
    "first-paragraph-before-anchor-nav",
  )

  // Navigate to a heading anchor (triggers SPA navigation).
  await gotoPage(page, `${page.url()}#header-3`)
  await firstParagraph.scrollIntoViewIfNeeded()

  // The paragraph should look identical after the navigation.
  const screenshotAfter = await captureStableScreenshot(
    () => firstParagraph.screenshot(),
    "first-paragraph-after-anchor-nav",
  )
  expect(screenshotAfter).toEqual(screenshotBefore)
})

test.describe("Link color states", () => {
  for (const theme of ["light", "dark"]) {
    test(`Normal vs visited link colors in ${theme} mode (screenshot)`, async ({
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

  test("monospace arrow inside a link inherits the link color", async ({ page }) => {
    const arrowLink = page.locator("a:has(.monospace-arrow)").first()
    await arrowLink.scrollIntoViewIfNeeded()
    await expect(arrowLink).toBeVisible()

    const arrow = arrowLink.locator(".monospace-arrow").first()
    const linkColor = await arrowLink.evaluate((el) => getComputedStyle(el).color)
    const arrowColor = await arrow.evaluate((el) => getComputedStyle(el).color)

    expect(arrowColor).toEqual(linkColor)
  })
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

    // Reload the page — use domcontentloaded to avoid Firefox subresource stalls
    await reloadPage(page, "domcontentloaded")
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

  test.describe("cascade behavior", () => {
    // Clear checkbox localStorage before each test so checkboxes start in their HTML default state
    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => {
        Object.keys(localStorage)
          .filter((key) => key.startsWith("test-page-checkbox-"))
          .forEach((key) => localStorage.removeItem(key))
      })
      await reloadPage(page)
    })

    test("Checking parent checkbox cascades to nested children", async ({ page }) => {
      const checkboxesSection = page.locator("h1:has-text('Checkboxes')")
      await checkboxesSection.scrollIntoViewIfNeeded()

      // Find checkboxes by their label text to be invariant to additions elsewhere
      const parentCheckbox = page.getByLabel("Checked off", { exact: true })
      const nestedChild = page.getByLabel("Nested unchecked item")
      const deeplyNested = page.getByLabel("Third nested")

      // Uncheck the parent (initially "[x] Checked off" in HTML)
      await parentCheckbox.click()

      await expect(parentCheckbox).toBeChecked({ checked: false })
      await expect(nestedChild).toBeChecked({ checked: false })
      await expect(deeplyNested).toBeChecked({ checked: false })

      // Check the parent — children should cascade to checked.
      // Safari may need time for the cascade event handler to propagate.
      await parentCheckbox.click()

      await expect(async () => {
        await expect(parentCheckbox).toBeChecked({ checked: true })
        await expect(nestedChild).toBeChecked({ checked: true })
        await expect(deeplyNested).toBeChecked({ checked: true })
      }).toPass({ timeout: 5_000 })

      // Uncheck parent — children should NOT be affected (cascade down only on check)
      await parentCheckbox.click()

      await expect(parentCheckbox).toBeChecked({ checked: false })
      await expect(nestedChild).toBeChecked({ checked: true })
      await expect(deeplyNested).toBeChecked({ checked: true })
    })

    test("Unchecking nested checkbox is independent from parent", async ({ page }) => {
      const checkboxesSection = page.locator("h1:has-text('Checkboxes')")
      await checkboxesSection.scrollIntoViewIfNeeded()

      const parentCheckbox = page.getByLabel("Checked off", { exact: true })
      const nestedChild = page.getByLabel("Nested unchecked item")

      // Uncheck the parent first (initially "[x] Checked off" in HTML)
      await parentCheckbox.click()

      // Check parent (cascades to child), then uncheck child.
      // Safari may need time for the cascade event handler to propagate.
      await parentCheckbox.click()
      await expect(async () => {
        await expect(nestedChild).toBeChecked({ checked: true })
      }).toPass({ timeout: 5_000 })

      await nestedChild.click()
      await expect(nestedChild).toBeChecked({ checked: false })
      await expect(parentCheckbox).toBeChecked({ checked: true })
    })

    test("Re-checking parent re-cascades to previously unchecked children", async ({ page }) => {
      const checkboxesSection = page.locator("h1:has-text('Checkboxes')")
      await checkboxesSection.scrollIntoViewIfNeeded()

      const parentCheckbox = page.getByLabel("Checked off", { exact: true })
      const nestedChild = page.getByLabel("Nested unchecked item")

      // Uncheck the parent first (initially "[x] Checked off" in HTML)
      await parentCheckbox.click()

      // Check parent (cascades), uncheck child, uncheck parent, re-check parent.
      // Safari may need time for the cascade event handler to propagate.
      await parentCheckbox.click()
      await expect(async () => {
        await expect(nestedChild).toBeChecked({ checked: true })
      }).toPass({ timeout: 5_000 })
      await nestedChild.click()
      await expect(nestedChild).toBeChecked({ checked: false })

      await parentCheckbox.click() // uncheck parent
      await parentCheckbox.click() // re-check parent — should re-cascade

      await expect(async () => {
        await expect(nestedChild).toBeChecked({ checked: true })
      }).toPass({ timeout: 5_000 })
    })
  })

  test.describe("state restoration before first paint", () => {
    const clearCheckboxKeys = () => {
      const keysToRemove = Object.keys(localStorage).filter((key) =>
        key.startsWith("test-page-checkbox-"),
      )
      keysToRemove.forEach((key) => localStorage.removeItem(key))
    }

    // Clean up after each test
    test.afterEach(async ({ page }) => {
      await page.evaluate(clearCheckboxKeys)
    })

    test("Checkbox state is restored before first paint (no flash of incorrect state)", async ({
      page,
    }) => {
      // Verifies that checkbox state restoration happens synchronously via
      // MutationObserver in detectInitialState.js, BEFORE the nav event fires.

      // Set localStorage on the live page, then reload to trigger restoration.
      // We use evaluate+reloadPage instead of addInitScript+gotoPage because
      // WebKit treats same-URL goto() as a soft refresh that skips init scripts.
      await page.evaluate(() => {
        localStorage.setItem("test-page-checkbox-0", "true")
      })
      await reloadPage(page, "load")

      // Check checkbox state — MutationObserver restores before first paint, but
      // Safari may deliver the callback slightly after load.
      await expect(async () => {
        const checkboxChecked = await page.evaluate(() => {
          const checkbox = document.querySelector("input.checkbox-toggle") as HTMLInputElement
          return checkbox?.checked
        })
        expect(checkboxChecked).toBe(true)
      }).toPass({ timeout: 10_000 })
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

        // Set localStorage on the live page, then reload to trigger restoration.
        await page.evaluate(
          ({ key, state }) => {
            localStorage.setItem(key, state ? "true" : "false")
          },
          { key: checkboxKey, state: savedState },
        )
        await reloadPage(page, "load")

        // Check checkbox state — MutationObserver restores before first paint, but
        // Safari may deliver the callback slightly after load.
        await expect(async () => {
          const checkboxState = await page.evaluate(
            ({ idx }) => {
              const checkboxes = document.querySelectorAll("input.checkbox-toggle")
              const checkbox = checkboxes[idx] as HTMLInputElement
              return checkbox?.checked
            },
            { idx: index },
          )
          expect(checkboxState).toBe(savedState)
        }).toPass({ timeout: 10_000 })
      })
    }
  })
})

test.describe("Scroll indicators", () => {
  test("Footnote table shows right fade when overflowing", async ({ page }) => {
    const footnoteTableContainer = page
      .locator('li[id^="user-content-fn-"] .table-container')
      .first()
    await footnoteTableContainer.scrollIntoViewIfNeeded()

    // Only assert if the table actually overflows (guaranteed on mobile, likely on all viewports)
    const overflows = await footnoteTableContainer.evaluate((el) => el.scrollWidth > el.clientWidth)
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (!overflows) return

    const scrollIndicator = footnoteTableContainer.locator("..")
    await expect(scrollIndicator).toHaveClass(/can-scroll-right/)
  })

  test("Left fade appears after scrolling a wide element right", async ({ page }) => {
    // Target the scroll-indicator wrapping the wide Maxwell's equations
    const scrollIndicator = page.locator(".scroll-indicator").filter({ hasText: "∇" }).first()
    const scrollable = scrollIndicator.locator(".katex-display")
    await scrollable.scrollIntoViewIfNeeded()

    // Scroll to the middle of the element
    await scrollable.evaluate((el) => {
      el.scrollLeft = Math.floor((el.scrollWidth - el.clientWidth) / 2)
    })

    await expect(scrollIndicator).toHaveClass(/can-scroll-left/)
    await expect(scrollIndicator).toHaveClass(/can-scroll-right/)

    // Verify the ::before pseudo-element reaches full opacity after transition
    await expect(async () => {
      const beforeOpacity = await scrollIndicator.evaluate((el) => {
        return window.getComputedStyle(el, "::before").opacity
      })
      expect(beforeOpacity).toBe("1")
    }).toPass()
  })
})

test.describe("Popovers on different page types", () => {
  const pageSlugs = ["all-posts", "tags/personal", "all-tags"]

  for (const pageSlug of pageSlugs) {
    test(`Popover appears on ${pageSlug} page`, async ({ page }) => {
      // Skip on non-desktop viewports since popovers are hidden on mobile/tablet
      test.skip(!isDesktopViewport(page), "Popovers only work on desktop viewports")

      // These assertions only need the parsed DOM and the `nav` event below;
      // waiting for the full `load` event ties the test to every CDN
      // subresource on heavy listing pages (e.g. all-tags), which can exceed
      // the WebKit test timeout on macOS runners.
      await gotoPage(page, `http://localhost:8080/${pageSlug}`, "domcontentloaded")
      await page.locator("body").waitFor({ state: "visible" })

      // Dispatch the 'nav' event to initialize popover functionality
      await page.evaluate(() => {
        window.dispatchEvent(new Event("nav"))
      })

      // Clear mouseMovedSinceNav flag set to false by the nav event above
      await page.mouse.move(1, 1)

      const popoverLink = page.locator("article a.can-trigger-popover").first()
      await popoverLink.scrollIntoViewIfNeeded()
      await expect(popoverLink).toBeVisible()

      await popoverLink.hover()

      // The popover appears only after the hover-intent delay
      // (popoverRemovalDelayMs) plus a fetch and render of the target page,
      // so give it a generous timeout for slow CI runners.
      const popover = page.locator(".popover.popover-visible")
      await expect(popover).toBeVisible({ timeout: 15_000 })
      const popoverInner = popover.locator(".popover-inner")
      await expect(popoverInner).toBeVisible()

      await moveMouseToSafePosition(page)
    })
  }
})
