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

  // Each glued code path in turn gets a column one pixel wider than the path:
  // the path fits a line, but not with the punctuation and favicon glued to it.
  test("wraps each glued code path whose glue would overrun its line", async ({ page }) => {
    const paths = page.locator("article .nowrap-span .inline-code-path:has(wbr)")
    const count = await paths.count()
    expect(count).toBeGreaterThan(0)
    const [width, height] = await page.evaluate(() => [window.innerWidth, window.innerHeight])

    const misplaced: string[] = []
    for (let i = 0; i < count; i++) {
      const path = paths.nth(i)
      await path.evaluate((element) => {
        let column = element.closest(".nowrap-span")
        if (!column) throw new Error("missing glue")
        while (
          column.parentElement &&
          ["contents", "inline"].includes(getComputedStyle(column).display)
        ) {
          column = column.parentElement
        }
        element.classList.remove("wide-inline")
        const style = (column as HTMLElement).style
        style.boxSizing = "content-box"
        style.width = `${element.getBoundingClientRect().width + 1}px`
        column.setAttribute("data-test-column", "")
      })
      // Resizing re-marks the paths against their new columns. Successive
      // widths differ, so each resize changes the width the marking sees.
      await page.setViewportSize({ width: width - 1 - (i % 2), height })
      await expect(path).toHaveClass(/wide-inline/)

      const problems = await path.evaluate((element) => {
        const column = document.querySelector("[data-test-column]") as HTMLElement
        const glued = element.closest(".nowrap-span")
        if (!glued) throw new Error("missing glue")
        const style = getComputedStyle(column)
        const columnEnd =
          column.getBoundingClientRect().right -
          parseFloat(style.paddingRight) -
          parseFloat(style.borderRightWidth)
        const middleOf = (rect: DOMRect) => (rect.top + rect.bottom) / 2
        const pathRows = Array.from(element.getClientRects())
        const firstRow = pathRows[0]
        const lastRow = pathRows[pathRows.length - 1]
        const glueRect = (before: boolean) => {
          const range = document.createRange()
          range.selectNodeContents(glued)
          if (before) range.setEndBefore(element)
          else range.setStartAfter(element)
          return Array.from(range.getClientRects()).filter((rect) => rect.width > 0)
        }
        const leading = glueRect(true).at(-1)
        const trailing = glueRect(false)[0]
        const offRow = (rect: DOMRect | undefined, row: DOMRect) =>
          rect !== undefined && Math.abs(middleOf(rect) - middleOf(row)) > row.height / 2
        const result = [
          offRow(leading, firstRow) && "leading glue off the path's first row",
          offRow(trailing, lastRow) && "trailing glue off the path's last row",
          Array.from(glued.getClientRects()).some((row) => row.right > columnEnd + 1) &&
            "glue past the column",
        ].filter((problem): problem is string => typeof problem === "string")

        column.removeAttribute("data-test-column")
        column.style.removeProperty("width")
        column.style.removeProperty("box-sizing")
        return result.map((problem) => `${glued.textContent?.slice(-24)}: ${problem}`)
      })
      misplaced.push(...problems)
    }
    expect(misplaced).toEqual([])
  })
})
