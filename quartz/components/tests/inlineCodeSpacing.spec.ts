import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// The InlineCodeSpacing transformer carries the leading gap on a zero-width
// `.inline-code-gap` marker's right margin rather than a left margin on the
// code. The point is that a trailing margin is discarded at a soft wrap, so the
// code sits flush when it falls to the start of a line while keeping the gap
// mid-line. That behavior is layout-engine-dependent, so this spec asserts it
// directly across every browser/viewport project rather than trusting one.
test.describe("inline code spacing marker", () => {
  test("adds a gap mid-line but stays flush at a wrapped line start", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate(() => {
      const MARKER = '<span class="inline-code-gap" aria-hidden="true"></span>'
      const host = document.createElement("div")
      host.style.width = "320px"
      // Each pair differs only by the marker, so the gap it introduces is the
      // difference in the code's left edge. A full-width inline-block fills the
      // first line, forcing the marker+code onto the next line regardless of font
      // metrics — a deterministic, cross-browser wrap.
      host.innerHTML =
        '<p style="margin:0"><span>word</span><code id="ics-mid-plain">x</code></p>' +
        `<p style="margin:0"><span>word</span>${MARKER}<code id="ics-mid-gap">x</code></p>` +
        '<p style="margin:0"><span style="display:inline-block;width:100%"></span><code id="ics-wrap-plain">x</code></p>' +
        `<p style="margin:0"><span style="display:inline-block;width:100%"></span>${MARKER}<code id="ics-wrap-gap">x</code></p>`

      const article = document.querySelector("article") ?? document.body
      article.appendChild(host)

      const leftOf = (id: string): number => {
        const el = document.getElementById(id)
        if (!el) throw new Error(`missing fixture element #${id}`)
        return el.getBoundingClientRect().left
      }

      const result = {
        midGap: leftOf("ics-mid-gap") - leftOf("ics-mid-plain"),
        wrapGap: leftOf("ics-wrap-gap") - leftOf("ics-wrap-plain"),
      }
      host.remove()
      return result
    })

    // Mid-line, the marker pushes the code right by a visible amount.
    expect(measured.midGap).toBeGreaterThan(0.5)
    // At a wrapped line start the marker's trailing margin is discarded, so the
    // code is essentially as flush as the no-marker control — far less than the
    // mid-line gap.
    expect(measured.wrapGap).toBeLessThan(measured.midGap * 0.5)
  })
})
