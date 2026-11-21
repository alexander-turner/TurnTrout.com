import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// A full-width table fills its container, but a column never shrinks below
// its longest word. When the words don't fit, the table widens and its
// container scrolls rather than splitting a word across rows.
for (const [label, containerWidth, overflows] of [
  ["narrow", 280, true],
  ["wide", 900, false],
] as const) {
  test(`a full-width table in a ${label} container keeps every word whole`, async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const layout = await page.evaluate((width) => {
      const article = document.querySelector("article") ?? document.body
      const container = document.createElement("div")
      container.className = "table-container"
      container.style.width = `${width}px`
      container.style.maxWidth = "none"
      const words = ["Optimal", "classifier", "truthfulness", "informativeness"]
      const cells = words.map((word) => `<td>${word}</td>`).join("")
      container.innerHTML = `<table class="full-width"><tbody><tr>${cells}</tr></tbody></table>`
      article.appendChild(container)

      const table = container.querySelector("table") as HTMLTableElement
      const rowsOf = (cell: Element) => {
        const range = document.createRange()
        range.selectNodeContents(cell)
        const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0)
        return new Set(rects.map((rect) => Math.round(rect.top))).size
      }
      const result = {
        split: Array.from(table.querySelectorAll("td"))
          .filter((cell) => rowsOf(cell) > 1)
          .map((cell) => cell.textContent),
        fillsContainer: table.getBoundingClientRect().width >= container.clientWidth - 1,
        scrolls: container.scrollWidth > container.clientWidth,
      }
      container.remove()
      return result
    }, containerWidth)

    expect(layout).toEqual({ split: [], fillsContainer: true, scrolls: overflows })
  })
}
