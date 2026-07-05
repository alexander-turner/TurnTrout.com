import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// A favicon is a replaced inline element, so browsers allow a line break on its
// trailing edge. When a footnote reference immediately follows a favicon-ending
// link, that break can orphan the tiny reference number onto its own line. The
// favicon transformer defends against this by gluing the link and the footnote
// `<sup>` with a word joiner (U+2060), which is universally supported, so this
// assertion runs on every browser/viewport project.
test.describe("footnote reference after a favicon", () => {
  test("keeps the reference number from wrapping onto its own line", async ({ page }) => {
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
        paragraph.innerHTML = `Alpha beta gamma delta epsilon the ${linkHtml}${glue}${supHtml} zeta eta theta.`
        article.appendChild(paragraph)
        return paragraph
      }

      // A superscript `<sup>` and a middle-aligned favicon sit at different
      // heights on the same line, so compare against half a line box: a wrapped
      // reference drops a full line below, well past the threshold.
      const sameLine = (paragraph: HTMLElement) => {
        const fav = paragraph.querySelector<HTMLElement>(".fav-glyph")
        const sup = paragraph.querySelector<HTMLElement>(".fn-ref")
        if (!fav || !sup) throw new Error("missing fixture elements")
        const lineHeight = parseFloat(getComputedStyle(paragraph).lineHeight) || 24
        return sup.getBoundingClientRect().top - fav.getBoundingClientRect().top < lineHeight * 0.5
      }

      const control = build("")
      const fixed = build(WORD_JOINER)

      // Shrink both paragraphs together until the control (no word joiner)
      // strands the footnote number on its own line.
      let orphanWidth = 0
      for (let w = 360; w >= 120; w -= 2) {
        control.style.width = `${w}px`
        control.style.maxWidth = `${w}px`
        fixed.style.width = `${w}px`
        fixed.style.maxWidth = `${w}px`
        if (!sameLine(control)) {
          orphanWidth = w
          break
        }
      }

      const result = {
        controlOrphaned: orphanWidth > 0 && !sameLine(control),
        fixedKeepsTogether: sameLine(fixed),
        orphanWidth,
      }
      control.remove()
      fixed.remove()
      return result
    })

    // Sanity: the chosen width genuinely orphans the reference under greedy wrapping.
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
        while (prev && prev.nodeType === Node.TEXT_NODE && prev.textContent === "") {
          prev = prev.previousSibling
        }
        const prevIsFaviconLink = prev instanceof Element && endsWithFavicon(prev)
        if (!prevIsFaviconLink) continue
        faviconBackedRefs += 1
        if (sup.previousSibling?.textContent !== WORD_JOINER) allGlued = false
      }
      return { faviconBackedRefs, allGlued }
    })

    expect(glued.faviconBackedRefs).toBeGreaterThan(0)
    expect(glued.allGlued).toBe(true)
  })
})
