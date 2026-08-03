import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// A spoiler is authored as a block quote and replaces it in the tree, so it has
// to stand off from its neighbors by exactly what the block quote it replaced
// would have. Without that standoff, the test page's consecutive spoilers butt
// against each other with no seam between them.

test.describe("spoiler spacing", () => {
  test("stands consecutive spoilers off by a block quote's margin", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate(() => {
      const spoilers = [...document.querySelectorAll("article .spoiler-container")]
      const blockquote = document.querySelector("article blockquote")
      if (spoilers.length < 2 || !blockquote) {
        throw new Error("test page must carry a block quote and consecutive spoilers")
      }
      const boxes = spoilers.map((el) => el.getBoundingClientRect())
      return {
        gaps: boxes.slice(1).map((box, i) => box.top - boxes[i].bottom),
        blockquoteMargin: Number.parseFloat(getComputedStyle(blockquote).marginBottom),
      }
    })

    // Adjacent block margins collapse, so the seam between two spoilers is one
    // margin wide rather than two.
    expect(measured.blockquoteMargin).toBeGreaterThan(0)
    for (const gap of measured.gaps) {
      expect(gap).toBeCloseTo(measured.blockquoteMargin, 0)
    }
  })
})
