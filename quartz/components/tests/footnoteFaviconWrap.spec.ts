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
        const p = document.createElement("p")
        p.style.margin = "0"
        p.innerHTML = `Alpha beta gamma delta epsilon the ${linkHtml}${glue}${supHtml} zeta eta theta.`
        article.appendChild(p)
        return p
      }

      // A superscript `<sup>` and a middle-aligned favicon sit at different
      // heights on the same line, so compare against half a line box: a wrapped
      // reference drops a full line below, well past the threshold.
      const sameLine = (p: HTMLElement) => {
        const fav = p.querySelector<HTMLElement>(".fav-glyph")
        const sup = p.querySelector<HTMLElement>(".fn-ref")
        if (!fav || !sup) throw new Error("missing fixture elements")
        const lineHeight = parseFloat(getComputedStyle(p).lineHeight) || 24
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
})
