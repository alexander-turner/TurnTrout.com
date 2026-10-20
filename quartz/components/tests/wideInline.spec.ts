import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// The test page's wide-math demo holds `So $…$, as claimed.` in a column
// narrower than the formula, so the formula must wrap between its terms.
test.describe("wide inline math", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")
    await page.evaluate(() => document.fonts.ready)
  })

  test("wraps like text, beside the text around it", async ({ page }) => {
    const math = page.locator("#wide-math-demo .katex-html")
    await expect(math).toHaveClass(/wide-inline/)

    const rows = await page.locator("#wide-math-demo").evaluate((demo) => {
      const middleOf = (rect: DOMRect) => (rect.top + rect.bottom) / 2
      const textRect = (node: Node | undefined, start: number, end: number) => {
        if (!node) throw new Error("missing text in the demo")
        const range = document.createRange()
        range.setStart(node, start)
        range.setEnd(node, end)
        return range.getBoundingClientRect()
      }
      const paragraph = demo.querySelector("p")
      const bases = demo.querySelectorAll(".katex-html > .base")
      const comma = Array.from(demo.querySelector(".nowrap-span")?.childNodes ?? []).find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.includes(","),
      )
      if (!paragraph || bases.length < 2) throw new Error("missing demo math")
      const halfFont = parseFloat(getComputedStyle(paragraph).fontSize) / 2
      const sameRow = (a: DOMRect, b: DOMRect) => Math.abs(middleOf(a) - middleOf(b)) < halfFont
      const commaRect = textRect(comma, 0, 1)
      const firstBase = bases[0].getBoundingClientRect()
      const lastBase = bases[bases.length - 1].getBoundingClientRect()
      return {
        mathWraps: !sameRow(firstBase, lastBase),
        mathStartsBesideLeadingText: sameRow(
          textRect(paragraph.firstChild ?? undefined, 0, 2),
          firstBase,
        ),
        commaBesideLastTerm: sameRow(commaRect, lastBase),
        commaInsideColumn: commaRect.right <= paragraph.getBoundingClientRect().right + 1,
      }
    })

    expect(rows).toEqual({
      mathWraps: true,
      mathStartsBesideLeadingText: true,
      commaBesideLastTerm: true,
      commaInsideColumn: true,
    })
  })

  test("is remeasured when the page width changes", async ({ page }) => {
    const math = page.locator("#wide-math-demo .katex-html")
    await expect(math).toHaveClass(/wide-inline/)

    await page.locator("#wide-math-demo").evaluate((demo) => {
      demo.style.width = "60rem"
    })
    const [width, height] = await page.evaluate(() => [window.innerWidth, window.innerHeight])
    await page.setViewportSize({ width: width - 1, height })

    await expect(math).not.toHaveClass(/wide-inline/)
  })
})
