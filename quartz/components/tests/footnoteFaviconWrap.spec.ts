import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// A favicon is a replaced inline element, so browsers allow a line break on its
// trailing edge. When a footnote reference immediately follows a favicon-ending
// link, that break can orphan the tiny reference number onto its own line. The
// favicon transformer defends against this by wrapping the link and the footnote
// `<sup>` in a `white-space: nowrap` span (`.favicon-footnote-span`). The first
// test measures the rendered effect (Chromium-scoped; see its note); the second
// asserts the wrapper is present in the DOM on every browser/viewport project.
test.describe("footnote reference after a favicon", () => {
  test("keeps the reference number from wrapping onto its own line", async ({ page }, testInfo) => {
    // This is a synthetic layout probe: it shrinks a paragraph to a knife-edge
    // width and reads which line the reference lands on. Proving the *control*
    // orphans relies on greedy line-break heuristics around replaced elements,
    // which diverge across Firefox and WebKit. The cross-browser guarantee that
    // the wrapper is emitted is covered by the DOM assertion below, so scope this
    // rendering probe to Chromium (as the sibling figcaption test does).
    test.skip(!testInfo.project.name.includes("Chrome"), "engine-specific line-break heuristics")

    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate(() => {
      const article = document.querySelector("article") ?? document.body

      // Mirrors what the favicon transformer emits: the link's last chars plus a
      // favicon glyph live in a nowrap span, followed by a footnote `<sup>`.
      const linkHtml =
        '<a href="#" style="text-decoration:underline">some link te' +
        '<span class="favicon-span">xt<span class="fav-glyph" style="display:inline-block;' +
        'width:14px;height:14px;background:#888;vertical-align:middle"></span></span></a>'
      const supHtml = '<sup class="fn-ref"><a href="#fn">1</a></sup>'

      // The fix wraps the link + sup in `.favicon-footnote-span`; the control
      // leaves them as bare siblings so the break between them stays open.
      const build = (wrap: boolean) => {
        const paragraph = document.createElement("p")
        paragraph.style.margin = "0"
        // Force greedy wrapping: article text inherits `text-wrap: pretty`, which
        // Chromium honors by pulling the favicon down to avoid the very orphan
        // this test needs the control to exhibit.
        paragraph.style.textWrap = "wrap"
        // Measure on one line first: no width cap so nothing wraps yet.
        paragraph.style.width = "1000px"
        paragraph.style.maxWidth = "none"
        const inner = `${linkHtml}${supHtml}`
        paragraph.innerHTML = wrap ? `<span class="favicon-footnote-span">${inner}</span>` : inner
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

      const control = build(false)
      const fixed = build(true)

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
    // Without the wrapper the reference is stranded on its own line.
    expect(measured.controlOrphaned).toBe(true)
    // The fix: the nowrap wrapper keeps the reference number glued to the favicon.
    expect(measured.fixedKeepsTogether).toBe(true)
  })

  test("the transformer wraps a real favicon-ending link and its footnote ref", async ({
    page,
  }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const glued = await page.evaluate(() => {
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
      // each such ref must sit in a `.favicon-footnote-span` beside that link so
      // the nowrap wrapper suppresses the break between them.
      let faviconBackedRefs = 0
      let allWrapped = true
      for (const sup of document.querySelectorAll("sup")) {
        if (!isFootnoteRef(sup)) continue
        const prev = sup.previousElementSibling
        if (!(prev instanceof Element) || !endsWithFavicon(prev)) continue
        faviconBackedRefs += 1
        const parent = sup.parentElement
        const wrappedTogether =
          parent?.classList.contains("favicon-footnote-span") === true &&
          prev.parentElement === parent
        if (!wrappedTogether) allWrapped = false
      }
      return { faviconBackedRefs, allWrapped }
    })

    expect(glued.faviconBackedRefs).toBeGreaterThan(0)
    expect(glued.allWrapped).toBe(true)
  })

  test("a long favicon-ending link with a footnote ref wraps instead of overflowing", async ({
    page,
  }) => {
    // The nowrap wrapper must freeze only the link↔`<sup>` boundary. If it also
    // forces the link's own text nowrap, a long favicon-ending link is rendered
    // on a single line that runs off the page. Build the exact structure the
    // transformer emits inside a narrow container and assert it stays contained
    // while the reference stays glued to the favicon.
    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate(() => {
      const article = document.querySelector("article") ?? document.body

      const container = document.createElement("div")
      container.style.width = "320px"
      container.style.margin = "0"
      container.innerHTML =
        '<p style="margin:0"><span class="favicon-footnote-span">' +
        '<a href="#" style="text-decoration:underline">their Terms of Service promise to ' +
        "&ldquo;send an email to the user account before disclosing information " +
        '[to the government]<span class="favicon-span">&rdquo;' +
        '<span class="fav-glyph" style="display:inline-block;width:14px;height:14px;' +
        'background:#888;vertical-align:middle"></span></span></a>' +
        '<sup class="fn-ref"><a href="#fn">1</a></sup></span></p>'
      article.appendChild(container)

      const paragraph = container.querySelector("p")
      if (!paragraph) throw new Error("missing fixture paragraph")
      const rectOf = (selector: string) => {
        const el = container.querySelector<HTMLElement>(selector)
        if (!el) throw new Error(`missing fixture element: ${selector}`)
        return el.getBoundingClientRect()
      }

      const lineHeight = parseFloat(getComputedStyle(paragraph).lineHeight) || 24
      const result = {
        // The paragraph's content fits within the 320px container instead of
        // spilling past its right edge on one unbreakable line.
        overflow: paragraph.scrollWidth - container.clientWidth,
        // The reference number still shares the favicon's line.
        refGluedToFavicon: rectOf(".fn-ref").top - rectOf(".fav-glyph").top < lineHeight * 0.5,
      }
      container.remove()
      return result
    })

    expect(measured.overflow).toBeLessThanOrEqual(1)
    expect(measured.refGluedToFavicon).toBe(true)
  })
})
