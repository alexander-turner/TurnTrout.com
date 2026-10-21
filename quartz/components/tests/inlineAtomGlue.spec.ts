import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

test.describe("inline atom glue", () => {
  test("keeps trailing punctuation in the atom's nowrap span", async ({ page }) => {
    const spanTextOf = (selector: string) =>
      page.locator(selector).evaluate((img) => img.closest(".nowrap-span")?.textContent ?? null)

    await gotoPage(page, "http://localhost:8080/test-page")

    const gooseEmoji = page.locator('figcaption img.emoji[alt="🪿"]')
    await expect(gooseEmoji).toHaveCount(1)
    // Both the opening and the closing curly quote share the emoji's span.
    expect(await spanTextOf('figcaption img.emoji[alt="🪿"]')).toBe("“”")

    const sprite = page.locator('p img.inline-img[alt="green dot"]')
    await expect(sprite).toHaveCount(1)
    // punctilio swaps the comma inside the closing quote, so the glued run is
    // the whole `,”`.
    expect(await spanTextOf('p img.inline-img[alt="green dot"]')).toBe("“,”")

    // A favicon reaches its closing quote by a different route: the quote is
    // moved inside the link before the icon is spliced in beside it.
    const favicon = page.locator('p a[href*="arxiv.org/abs/1912.01217"] .nowrap-span')
    await expect(favicon).toHaveCount(1)
    expect(await favicon.evaluate((span) => span.textContent)).toContain("”")
  })

  // The break opportunity at an atomic inline box's edge is what the transformer
  // exists to close. Each case puts the atom and one trailing mark in a
  // paragraph too narrow for both, so the mark can only share the atom's line if
  // no break is allowed between them.
  test("a nowrap span closes the break opportunity at an atom's box edge", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate(() => {
      const article = document.querySelector("article") ?? document.body
      const atom =
        '<span class="probe-atom" style="display:inline-block;width:14px;height:14px;' +
        'background:#888"></span>'

      const stranded = (inner: string): boolean => {
        const p = document.createElement("p")
        p.style.cssText = "width:16px;max-width:16px;margin:0"
        p.innerHTML = inner
        article.appendChild(p)
        const box = p.querySelector<HTMLElement>(".probe-atom")
        const mark = p.querySelector<HTMLElement>("#mark")
        if (!box || !mark) throw new Error("missing fixture elements")
        const fellThrough = mark.getBoundingClientRect().top - box.getBoundingClientRect().top > 1
        p.remove()
        return fellThrough
      }

      return {
        looseQuote: stranded(`${atom}<span id="mark">”</span>`),
        looseComma: stranded(`${atom}<span id="mark">,</span>`),
        gluedQuote: stranded(`<span class="nowrap-span">${atom}<span id="mark">”</span></span>`),
        gluedComma: stranded(`<span class="nowrap-span">${atom}<span id="mark">,</span></span>`),
      }
    })

    // Punctuation falls through the box edge whatever its line-breaking class,
    // which is why the glued set is all closing punctuation.
    expect(measured.looseQuote).toBe(true)
    expect(measured.looseComma).toBe(true)
    expect(measured.gluedQuote).toBe(false)
    expect(measured.gluedComma).toBe(false)
  })

  // The test page's `$e^{i\pi} + 1 = 0$.` glues its period to the math. In a
  // paragraph exactly as wide as the math, the period doesn't fit beside it: the
  // line must break inside the math rather than at its trailing edge.
  test("keeps punctuation glued to inline math at the math's trailing edge", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const periodBesideLastOperand = await page.evaluate(() => {
      const source = Array.from(document.querySelectorAll("article p .nowrap-span")).find(
        (span) => span.querySelector(".katex .mrel") && span.textContent?.endsWith("."),
      )
      const article = source?.closest("article")
      if (!source || !article)
        throw new Error("no glued inline math with a relation on the test page")

      const place = (width: string) => {
        const probe = document.createElement("p")
        probe.style.cssText = `width:${width};max-width:${width};margin:0`
        const clone = source.cloneNode(true) as HTMLElement
        probe.appendChild(clone)
        article.appendChild(probe)
        const katex = clone.querySelector(".katex")
        const period = Array.from(clone.childNodes).find((node) => node.nodeType === Node.TEXT_NODE)
        if (!katex || !period) throw new Error("missing fixture elements")
        return { probe, katex, period }
      }

      const natural = place("max-content")
      const mathWidth =
        natural.katex.getBoundingClientRect().right - natural.probe.getBoundingClientRect().left
      natural.probe.remove()

      const { probe, katex, period } = place(`${mathWidth}px`)
      // Rows compare by vertical midpoint: the operand's box and the period's
      // glyph box differ in height but share a row's center.
      const middleOf = (rect: DOMRect) => (rect.top + rect.bottom) / 2
      const operands = katex.querySelectorAll(".katex-html > .base > .mord")
      const lastOperand = middleOf(operands[operands.length - 1].getBoundingClientRect())
      const range = document.createRange()
      range.selectNodeContents(period)
      const halfFont = parseFloat(getComputedStyle(probe).fontSize) / 2
      const result = Math.abs(middleOf(range.getBoundingClientRect()) - lastOperand) < halfFont
      probe.remove()
      return result
    })

    expect(periodBesideLastOperand).toBe(true)
  })

  // Math whose only `.base` is its last must still allow a break before it;
  // otherwise the line breaks inside the preceding math to make room.
  test("breaks before single-base math rather than inside earlier math", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const earlierMathOnOneRow = await page.evaluate(() => {
      const source = Array.from(document.querySelectorAll("article p .nowrap-span")).find(
        (span) => span.querySelectorAll(".katex-html > .base").length > 1,
      )
      const article = source?.closest("article")
      if (!source || !article) throw new Error("no glued multi-base inline math on the test page")

      const earlier = source.cloneNode(true) as HTMLElement
      const single = source.cloneNode(true) as HTMLElement
      const singleBases = single.querySelectorAll(".katex-html > .base")
      singleBases.forEach((base, i) => i < singleBases.length - 1 && base.remove())

      const probe = document.createElement("p")
      probe.style.cssText = "width:max-content;margin:0"
      probe.append("If ", earlier, " then ")
      article.appendChild(probe)
      // Room for everything up to "then", but not for the single-base math too.
      const width = probe.getBoundingClientRect().width + 2
      probe.append(single)
      probe.style.width = `${width}px`

      // Rows compare by vertical midpoint, as above.
      const middleOf = (rect: DOMRect) => (rect.top + rect.bottom) / 2
      const operands = earlier.querySelectorAll(".katex-html > .base > .mord")
      const first = middleOf(operands[0].getBoundingClientRect())
      const last = middleOf(operands[operands.length - 1].getBoundingClientRect())
      const halfFont = parseFloat(getComputedStyle(probe).fontSize) / 2
      probe.remove()
      return Math.abs(first - last) < halfFont
    })

    expect(earlierMathOnOneRow).toBe(true)
  })
})
