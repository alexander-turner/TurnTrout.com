import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// Code-block line numbers are `[data-line]::before` pseudo-elements in a gutter
// left of a 1px `::after` separator. A long first token (e.g. a BibTeX citation
// key) must wrap in place on the number's row rather than drop to the next
// row, and the number must stay left of the separator however many digits the
// block's line count needs.
test.describe("code block line numbers", () => {
  for (const { label, lineCount, maxDigits } of [
    { label: "single-digit", lineCount: 3, maxDigits: "1" },
    { label: "two-digit", lineCount: 12, maxDigits: "2" },
  ] as const) {
    test(`keeps a long first token on its number's row (${label} gutter)`, async ({ page }) => {
      await gotoPage(page, "http://localhost:8080/test-page")

      const measured = await page.evaluate(
        ({ lineCount, maxDigits }) => {
          const article = document.querySelector("article") ?? document.body
          const figure = document.createElement("figure")
          figure.setAttribute("data-rehype-pretty-code-figure", "")
          figure.style.width = "240px"
          const longToken = "Azarbal2025RecontextualizationMitigatesSpecificationGaming"
          const rows = [`<span data-line=""><span id="cln-first">@misc{${longToken},</span></span>`]
          for (let i = 1; i < lineCount; i++) {
            rows.push(`<span data-line=""><span class="cln-short">  year = 2025,</span></span>`)
          }
          figure.innerHTML =
            `<pre><code data-line-numbers="" data-line-numbers-max-digits="${maxDigits}">` +
            `${rows.join("\n")}</code></pre>`
          article.appendChild(figure)

          const first = document.getElementById("cln-first")
          const line = first?.parentElement
          const short = figure.querySelector(".cln-short")
          const shortLine = short?.parentElement
          if (!first || !line || !short || !shortLine) throw new Error("missing fixture elements")

          const lineRect = line.getBoundingClientRect()
          const tokenRects = first.getClientRects()
          // A short row's text sits on its number's row by construction, so its
          // offset within its row is the baseline for the long token's.
          const shortOffset =
            short.getBoundingClientRect().top - shortLine.getBoundingClientRect().top
          const number = getComputedStyle(line, "::before")
          const separator = getComputedStyle(line, "::after")
          const result = {
            firstRowOffset: tokenRects[0].top - lineRect.top - shortOffset,
            wrappedRows: tokenRects.length,
            numberRight: parseFloat(number.left) + parseFloat(number.width),
            separatorLeft: parseFloat(separator.left),
            contentLeft: tokenRects[0].left - lineRect.left - line.clientLeft,
          }
          figure.remove()
          return result
        },
        { lineCount, maxDigits },
      )

      // The token wraps (so the scenario is exercised) yet starts on the
      // number's row.
      expect(measured.wrappedRows).toBeGreaterThan(1)
      expect(Math.abs(measured.firstRowOffset)).toBeLessThan(1)
      // Number, then separator, then code, left to right.
      expect(measured.numberRight).toBeLessThan(measured.separatorLeft)
      expect(measured.separatorLeft).toBeLessThan(measured.contentLeft)
    })
  }
})
