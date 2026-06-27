import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// InlineCodeSpacing wraps a word and the inline code that follows it in a
// `white-space: nowrap` span (`.inline-code-nowrap`) so the code can never fall
// to the start of a line, then gives the code a left-margin gap
// (`.inline-code-gap`). A left margin alone is not enough — some engines keep a
// trailing margin at a soft wrap and some drop it — so this spec verifies, in
// every browser/viewport project, that the nowrap join actually keeps the code
// on its word's line while a plain space would let it wrap away.
test.describe("inline code spacing", () => {
  test("keeps code on its preceding word's line with a left-margin gap", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate(() => {
      const host = document.createElement("div")
      // A 1px-wide column forces every break opportunity to wrap. The nowrap
      // join must keep word + code on one line; the plain-space control must
      // not.
      host.innerHTML =
        '<div id="ics-join" style="width:1px"><span class="inline-code-nowrap"><span id="ics-jw">word</span> <code id="ics-jc" class="inline-code-gap">x</code></span></div>' +
        '<div id="ics-ctrl" style="width:1px"><span id="ics-cw">word</span> <code id="ics-cc">x</code></div>'

      const article = document.querySelector("article") ?? document.body
      article.appendChild(host)

      const topOf = (id: string): number => {
        const el = document.getElementById(id)
        if (!el) throw new Error(`missing fixture element #${id}`)
        return el.getBoundingClientRect().top
      }
      const code = document.getElementById("ics-jc")
      if (!code) throw new Error("missing fixture code element")

      const result = {
        joinDelta: Math.abs(topOf("ics-jc") - topOf("ics-jw")),
        controlDelta: topOf("ics-cc") - topOf("ics-cw"),
        marginLeft: parseFloat(getComputedStyle(code).marginLeft),
      }
      host.remove()
      return result
    })

    // The plain-space control wraps the code a full line below its word,
    // proving the 1px column really forces a break.
    expect(measured.controlDelta).toBeGreaterThan(5)
    // The nowrap join keeps the code on its word's line: the small top offset
    // (the code's smaller font sits on the same baseline) is far less than the
    // control's line-height separation.
    expect(measured.joinDelta).toBeLessThan(measured.controlDelta * 0.5)
    // The code carries the leading-gap margin.
    expect(measured.marginLeft).toBeGreaterThan(0)
  })
})
