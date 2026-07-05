import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// A favicon is a replaced inline element, so browsers allow a line break on its
// trailing edge. When a footnote reference immediately follows a favicon-ending
// link, that break can orphan the tiny reference number onto its own line. The
// favicon transformer defends against this by gluing the link and the footnote
// `<sup>` with a word joiner (U+2060). The first test measures the rendered
// effect (Chromium-scoped; see its note); the second asserts the joiner is
// present in the DOM on every browser/viewport project.
test.describe("footnote reference after a favicon", () => {
  test("keeps the reference number from wrapping onto its own line", async ({ page }, testInfo) => {
    // This is a synthetic layout probe: it shrinks a paragraph to a knife-edge
    // width and reads which line the reference lands on. That measurement rides
    // on engine-specific line-break heuristics around replaced elements, which
    // diverge across Firefox and WebKit. The cross-browser guarantee that the
    // joiner is actually emitted is covered by the DOM assertion below, so scope
    // this rendering probe to Chromium (as the sibling figcaption test does).
    test.skip(!testInfo.project.name.includes("Chrome"), "engine-specific line-break heuristics")

    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate(() => {
      const WORD_JOINER = "⁠"
      const article = document.querySelector("article") ?? document.body

      // Mirrors what the favicon transformer emits: the link's last chars plus a
      // favicon glyph live in a nowrap span, followed by a footnote `<sup>`.
      const linkHtml =
        '<a href="#" style="text-decoration:underline">some link te' +
        '<span class="favicon-span">xt<span class="fav-glyph" style="display:inline-block;' +
        'width:14px;height:14px;background:#888;vertical-align:middle"></span></span></a>'
      const supHtml = '<sup class="fn-ref"><a href="#fn">1</a></sup>'

      const build = (glue: string) => {
        const paragraph = document.createElement("p")
        paragraph.style.margin = "0"
        // Force greedy wrapping: article text inherits `text-wrap: pretty`, which
        // Chromium honors by pulling the favicon down to avoid the very orphan
        // this test needs the control to exhibit. The word joiner still holds
        // under greedy wrapping, which is the property under test.
        paragraph.style.textWrap = "wrap"
        // Measure on one line first: no width cap so nothing wraps yet.
        paragraph.style.width = "1000px"
        paragraph.style.maxWidth = "none"
        paragraph.innerHTML = `${linkHtml}${glue}${supHtml}`
        article.appendChild(paragraph)
        return paragraph
      }

      const rectIn = (paragraph: HTMLElement, selector: string) => {
        const el = paragraph.querySelector<HTMLElement>(selector)
        if (!el) throw new Error(`missing fixture element: ${selector}`)
        return el.getBoundingClientRect()
      }

      // A superscript `<sup>` and a middle-aligned favicon sit at different
      // heights on the same line, so compare against half a line box: a wrapped
      // reference drops a full line below, well past the threshold.
      const sameLine = (paragraph: HTMLElement) => {
        const lineHeight = parseFloat(getComputedStyle(paragraph).lineHeight) || 24
        return (
          rectIn(paragraph, ".fn-ref").top - rectIn(paragraph, ".fav-glyph").top < lineHeight * 0.5
        )
      }

      const control = build("")
      const fixed = build(WORD_JOINER)

      // With everything on one line, the only width that strands the reference
      // is the sliver between the favicon's right edge and the reference's right
      // edge: wide enough for the favicon, too narrow for the digit after it. A
      // greedy scan can step over this ~few-pixel window (font metrics vary per
      // browser), so target it directly instead.
      const paraLeft = control.getBoundingClientRect().left
      const favRight = rectIn(control, ".fav-glyph").right - paraLeft
      const supRight = rectIn(control, ".fn-ref").right - paraLeft
      const targetWidth = Math.ceil(favRight) + 2

      for (const paragraph of [control, fixed]) {
        paragraph.style.width = `${targetWidth}px`
        paragraph.style.maxWidth = `${targetWidth}px`
      }

      const result = {
        // The favicon fits at targetWidth but the reference digit does not.
        windowExists: supRight - targetWidth > 1,
        controlOrphaned: !sameLine(control),
        fixedKeepsTogether: sameLine(fixed),
      }
      control.remove()
      fixed.remove()
      return result
    })

    // Sanity: the chosen width genuinely leaves the reference no room on the line.
    expect(measured.windowExists).toBe(true)
    // Without the joiner the reference is stranded on its own line.
    expect(measured.controlOrphaned).toBe(true)
    // The fix: the word joiner keeps the reference number glued to the favicon.
    expect(measured.fixedKeepsTogether).toBe(true)
  })

  test("the transformer glues a real favicon-ending link to its footnote ref", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const glued = await page.evaluate(() => {
      const WORD_JOINER = "⁠"
      const isFootnoteRef = (el: Element) =>
        el.tagName === "SUP" &&
        Boolean(el.querySelector("a[data-footnote-ref], a[id^='user-content-fnref']"))
      const endsWithFavicon = (el: Element): boolean => {
        const last = [...el.childNodes]
          .filter((n) => !(n.nodeType === Node.TEXT_NODE && !n.textContent?.trim()))
          .at(-1)
        if (!(last instanceof Element)) return false
        return last.classList.contains("favicon") || endsWithFavicon(last)
      }

      // At least one footnote ref on the page follows a favicon-ending link, and
      // each such ref must be immediately preceded by the word joiner.
      let faviconBackedRefs = 0
      let allGlued = true
      for (const sup of document.querySelectorAll("sup")) {
        if (!isFootnoteRef(sup)) continue
        let prev = sup.previousSibling
        const immediatelyGlued =
          prev?.nodeType === Node.TEXT_NODE && prev.textContent === WORD_JOINER
        while (
          prev &&
          prev.nodeType === Node.TEXT_NODE &&
          (prev.textContent === "" || prev.textContent === WORD_JOINER)
        ) {
          prev = prev.previousSibling
        }
        const prevIsFaviconLink = prev instanceof Element && endsWithFavicon(prev)
        if (!prevIsFaviconLink) continue
        faviconBackedRefs += 1
        if (!immediatelyGlued) allGlued = false
      }
      return { faviconBackedRefs, allGlued }
    })

    expect(glued.faviconBackedRefs).toBeGreaterThan(0)
    expect(glued.allGlued).toBe(true)
  })
})
