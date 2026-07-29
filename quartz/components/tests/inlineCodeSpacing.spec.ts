import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// InlineCodeSpacing wraps the word before inline code in a `code-gap-after`
// span so CSS opens a gap between that word and the code's monospace glyph. The
// gap is a right margin rather than a character, so find-in-page and copied text
// still read as a single space, and a line breaking at the space leaves the code
// flush with the line start. This spec verifies both, in every browser/viewport
// project.
const GAP_CLASS = "code-gap-after"

test.describe("inline code spacing", () => {
  test("gaps the preceding word and keeps wrapped code flush at the line start", async ({
    page,
  }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate((gapClass) => {
      const host = document.createElement("div")
      // A 1px-wide column forces the space between the word and the code to
      // wrap, dropping the code to its own line. The second row is the same
      // markup without the gap class, so the gap is measured as a difference
      // against an otherwise identical control.
      host.innerHTML =
        `<div id="ics-host" style="width:1px"><span id="ics-word" class="${gapClass}">word</span> ` +
        '<code id="ics-code">xy</code></div>' +
        '<div id="ics-plain"><span>word</span> <code id="ics-plain-code">xy</code></div>' +
        `<div id="ics-gapped"><span class="${gapClass}">word</span> <code id="ics-gapped-code">xy</code></div>`

      const article = document.querySelector("article") ?? document.body
      article.appendChild(host)

      const get = (id: string): HTMLElement => {
        const el = document.getElementById(id)
        if (!el) throw new Error(`missing fixture element #${id}`)
        return el
      }
      const rect = (sel: string): DOMRect => {
        const el = host.querySelector<HTMLElement>(sel)
        if (!el) throw new Error(`missing fixture ${sel}`)
        return el.getBoundingClientRect()
      }

      const hostRect = get("ics-host").getBoundingClientRect()
      const wordRect = get("ics-word").getBoundingClientRect()
      const codeRect = get("ics-code").getBoundingClientRect()

      const result = {
        // How much further right the gap class pushes the code, versus the same
        // markup without it.
        gapWidth:
          rect("#ics-gapped-code").left -
          rect("#ics-gapped").left -
          (rect("#ics-plain-code").left - rect("#ics-plain").left),
        wrapDelta: codeRect.top - wordRect.top,
        codeIndent: codeRect.left - hostRect.left,
        wordIndent: wordRect.left - hostRect.left,
      }
      host.remove()
      return result
    }, GAP_CLASS)

    // The gap class widens the run: the margin renders, it isn't collapsed away.
    expect(measured.gapWidth).toBeGreaterThan(0)
    // The code really wrapped to a line below its word.
    expect(measured.wrapDelta).toBeGreaterThan(5)
    // The wrapped code is flush with the line start, exactly like the word at
    // the start of its own line: the gap sits on the previous line's trailing
    // edge, so it adds no indent here.
    expect(Math.abs(measured.codeIndent - measured.wordIndent)).toBeLessThan(1)
  })

  // Closing punctuation between two inline codes ("`a`); `b`") must stay on the
  // first code's line. The transformer gives closing punctuation no gap, so it
  // remains plain text hugging the code it follows (no space between them); when
  // the column forces a wrap, only the second code drops down.
  test("keeps closing punctuation on the first code's line when the next code wraps", async ({
    page,
  }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate((gapClass) => {
      const host = document.createElement("div")
      host.style.overflowWrap = "anywhere"
      // The width computed below assumes greedy line-breaking, so opt out of the
      // inherited `text-wrap: pretty`; its paragraph-level rebalancing would
      // otherwise keep "two" on the first line and defeat the forced wrap.
      host.style.setProperty("text-wrap", "auto")
      host.innerHTML =
        `<div id="ics-orphan"><span class="${gapClass}">word</span> ` +
        '<code id="ics-one">one</code><span id="ics-semi">); </span>' +
        '<code id="ics-two">two</code></div>'

      const article = document.querySelector("article") ?? document.body
      article.appendChild(host)

      const rect = (sel: string): DOMRect => {
        const el = host.querySelector<HTMLElement>(sel)
        if (!el) throw new Error(`missing fixture ${sel}`)
        return el.getBoundingClientRect()
      }

      const container = document.getElementById("ics-orphan")
      if (!container) throw new Error("missing fixture container")
      // Width fits "word one); " but not the trailing "two", forcing only it to
      // wrap. Measured while unconstrained, then applied.
      const width = Math.ceil(rect("#ics-semi").right - rect("#ics-orphan").left + 2)
      container.style.width = `${width}px`

      const oneTop = rect("#ics-one").top
      const result = {
        twoDroppedBy: rect("#ics-two").top - oneTop,
        semiDelta: Math.abs(rect("#ics-semi").top - oneTop),
      }
      host.remove()
      return result
    }, GAP_CLASS)

    // The column really forced the second code onto a new line.
    expect(measured.twoDroppedBy).toBeGreaterThan(5)
    // ...yet the closing ");" stayed on the first code's line.
    expect(measured.semiDelta).toBeLessThan(5)
  })
})
