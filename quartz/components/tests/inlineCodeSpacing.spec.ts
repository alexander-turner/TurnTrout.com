import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// InlineCodeSpacing appends a hair space (U+200A) to the word before inline
// code so the monospace glyph doesn't crowd it. The hair space sits before the
// word's trailing breakable space, so when the code wraps to the start of a
// line it must sit flush there (no indent) — this spec verifies, in every
// browser/viewport project, both that the gap exists and that wrapped code
// stays flush with its line start.
const HAIR_SPACE = "\u200a"
const SIX_PER_EM_SPACE = "\u2006"

test.describe("inline code spacing", () => {
  test("gaps the preceding word and keeps wrapped code flush at the line start", async ({
    page,
  }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate((hairSpace) => {
      const host = document.createElement("div")
      // A 1px-wide column forces the space between the word and the code to
      // wrap, dropping the code to its own line.
      host.innerHTML =
        '<div id="ics-host" style="width:1px"><span id="ics-word">word</span>' +
        `${hairSpace} <code id="ics-code">xy</code></div>`

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

      // Width of the hair space as rendered: a range over the text node
      // between the word span and the code.
      const gapNode = get("ics-word").nextSibling as globalThis.Text
      const range = document.createRange()
      range.setStart(gapNode, 0)
      range.setEnd(gapNode, 1)
      const gapWidth = range.getBoundingClientRect().width

      const result = {
        gapWidth,
        wrapDelta: codeRect.top - wordRect.top,
        codeIndent: codeRect.left - hostRect.left,
        wordIndent: wordRect.left - hostRect.left,
      }
      host.remove()
      return result
    }, HAIR_SPACE)

    // The hair space renders with real width on the word's line.
    expect(measured.gapWidth).toBeGreaterThan(0)
    // The code really wrapped to a line below its word.
    expect(measured.wrapDelta).toBeGreaterThan(5)
    // The wrapped code is flush with the line start, exactly like the word at
    // the start of its own line — the gap lives on the word's trailing edge,
    // not as a leading indent on the code.
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

    const measured = await page.evaluate((hairSpace) => {
      const host = document.createElement("div")
      host.style.overflowWrap = "anywhere"
      host.innerHTML =
        `<div id="ics-orphan"><span>word</span>${hairSpace} ` +
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
    }, HAIR_SPACE)

    // The column really forced the second code onto a new line.
    expect(measured.twoDroppedBy).toBeGreaterThan(5)
    // ...yet the closing ");" stayed on the first code's line.
    expect(measured.semiDelta).toBeLessThan(5)
  })

  // The six-per-em space after inline code must render narrower than the
  // ordinary space it replaces (the code's trailing side bearing already pads
  // the gap), while still giving the following word a place to wrap.
  test("renders the gap after code narrower than a plain space and keeps it breakable", async ({
    page,
  }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate((sixPerEmSpace) => {
      const host = document.createElement("div")
      host.innerHTML =
        `<div id="ics-narrow"><code>xy</code>${sixPerEmSpace}word</div>` +
        '<div id="ics-plain"><code>xy</code> word</div>' +
        `<div id="ics-wrap" style="width:1px"><code id="ics-wrap-code">xy</code>${sixPerEmSpace}<span id="ics-wrap-word">word</span></div>`

      const article = document.querySelector("article") ?? document.body
      article.appendChild(host)

      const spaceWidth = (containerId: string): number => {
        const container = document.getElementById(containerId)
        const gapNode = container?.querySelector("code")?.nextSibling as globalThis.Text | null
        if (!gapNode) throw new Error(`missing gap text in #${containerId}`)
        const range = document.createRange()
        range.setStart(gapNode, 0)
        range.setEnd(gapNode, 1)
        return range.getBoundingClientRect().width
      }

      const rect = (id: string): DOMRect => {
        const el = document.getElementById(id)
        if (!el) throw new Error(`missing fixture element #${id}`)
        return el.getBoundingClientRect()
      }

      const result = {
        narrowWidth: spaceWidth("ics-narrow"),
        plainWidth: spaceWidth("ics-plain"),
        wrapDelta: rect("ics-wrap-word").top - rect("ics-wrap-code").top,
      }
      host.remove()
      return result
    }, SIX_PER_EM_SPACE)

    // The six-per-em space renders with real, but reduced, width.
    expect(measured.narrowWidth).toBeGreaterThan(0)
    expect(measured.narrowWidth).toBeLessThan(measured.plainWidth)
    // A word after the six-per-em space can still wrap to the next line.
    expect(measured.wrapDelta).toBeGreaterThan(5)
  })
})
