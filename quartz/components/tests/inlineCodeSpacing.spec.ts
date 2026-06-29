import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// InlineCodeSpacing gives the word before inline code a small right-margin gap
// (`.inline-code-gap`) so the monospace glyph doesn't crowd it. A trailing
// margin collapses at a line end, so when the code wraps to the start of a line
// it must sit flush there (no indent) — this spec verifies, in every
// browser/viewport project, both that the gap exists and that wrapped code stays
// flush with its line start.
test.describe("inline code spacing", () => {
  test("gaps the preceding word and keeps wrapped code flush at the line start", async ({
    page,
  }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate(() => {
      const host = document.createElement("div")
      // A 1px-wide column forces the space between the word and the code to
      // wrap, dropping the code to its own line.
      host.innerHTML =
        '<div id="ics-host" style="width:1px"><span id="ics-word" class="inline-code-gap">word</span> <code id="ics-code">xy</code></div>'

      const article = document.querySelector("article") ?? document.body
      article.appendChild(host)

      const get = (id: string): HTMLElement => {
        const el = document.getElementById(id)
        if (!el) throw new Error(`missing fixture element #${id}`)
        return el
      }
      const hostRect = get("ics-host").getBoundingClientRect()
      const wordRect = get("ics-word").getBoundingClientRect()
      const codeRect = get("ics-code").getBoundingClientRect()

      const result = {
        marginRight: parseFloat(getComputedStyle(get("ics-word")).marginRight),
        wrapDelta: codeRect.top - wordRect.top,
        codeIndent: codeRect.left - hostRect.left,
        wordIndent: wordRect.left - hostRect.left,
      }
      host.remove()
      return result
    })

    // The word carries the gap.
    expect(measured.marginRight).toBeGreaterThan(0)
    // The code really wrapped to a line below its word.
    expect(measured.wrapDelta).toBeGreaterThan(5)
    // The wrapped code is flush with the line start, exactly like the word at
    // the start of its own line — the gap lives on the word's trailing edge, not
    // as a leading indent on the code.
    expect(Math.abs(measured.codeIndent - measured.wordIndent)).toBeLessThan(1)
  })
})
