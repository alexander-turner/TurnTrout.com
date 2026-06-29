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

  // Closing punctuation between two inline codes ("`a`); `b`") must stay on the
  // first code's line. The transformer leaves "); " as plain text after the
  // first code's nowrap span, so when the column forces a wrap only the second
  // code drops down — the ");" hugs what it closes instead of orphaning.
  test("keeps closing punctuation on the first code's line when the next code wraps", async ({
    page,
  }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate(() => {
      const host = document.createElement("div")
      host.style.overflowWrap = "anywhere"
      host.innerHTML =
        '<div id="ics-orphan"><span class="inline-code-nowrap"><span>word</span> ' +
        '<code class="inline-code-gap">one</code></span><span id="ics-semi">); </span>' +
        '<code id="ics-two">two</code></div>'

      const article = document.querySelector("article") ?? document.body
      article.appendChild(host)

      const rect = (sel: string): DOMRect => {
        const el = host.querySelector<HTMLElement>(sel)
        if (!el) throw new Error(`missing fixture ${sel}`)
        return el.getBoundingClientRect()
      }

      const span1 = rect(".inline-code-nowrap").width
      const semi = rect("#ics-semi").width
      const two = rect("#ics-two").width
      // Fits "word one); " but not the trailing "two", forcing only it to wrap.
      const container = document.getElementById("ics-orphan")
      if (!container) throw new Error("missing fixture container")
      container.style.width = `${Math.ceil(span1 + semi + two * 0.4)}px`

      const span1Top = rect(".inline-code-nowrap").top
      const result = {
        twoDroppedBy: rect("#ics-two").top - span1Top,
        semiDelta: Math.abs(rect("#ics-semi").top - span1Top),
      }
      host.remove()
      return result
    })

    // The column really forced the second code onto a new line.
    expect(measured.twoDroppedBy).toBeGreaterThan(5)
    // ...yet the closing ");" stayed on the first code's line.
    expect(measured.semiDelta).toBeLessThan(5)
  })
})
