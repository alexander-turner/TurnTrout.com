import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// The default fixtures stub CDN videos with an empty 204 response, so the
// <video> never gains intrinsic dimensions from a loaded resource — the same
// state a real page is in before the video downloads. A shrink-to-fit
// float-right figure would then collapse to the 300px default object width and
// jump to its real width once the video arrives (layout shift). The
// asset-dimensions transformer exposes `--natural-width`, and custom.scss uses
// it to give the float a definite width up front. This spec locks that in.
test.describe("float-right video figures reserve a definite width", () => {
  test("figure width matches the natural width capped at the float max-width", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/design")

    const data = await page.evaluate(() => {
      const video = Array.from(document.querySelectorAll("video")).find((v) =>
        /play and pause/i.test(v.getAttribute("aria-label") ?? ""),
      )
      const figure = video?.closest("figure")
      if (!video || !figure?.parentElement) {
        throw new Error("Could not find the float-right pond video figure on /design")
      }

      const containingBlock = figure.parentElement
      const cbStyle = getComputedStyle(containingBlock)
      const contentWidth =
        containingBlock.clientWidth -
        parseFloat(cbStyle.paddingLeft) -
        parseFloat(cbStyle.paddingRight)
      const naturalWidth = parseFloat(getComputedStyle(video).getPropertyValue("--natural-width"))
      return { naturalWidth, contentWidth, figureWidth: figure.getBoundingClientRect().width }
    })

    // The transformer must have stamped a usable natural width on the video.
    expect(data.naturalWidth).toBeGreaterThan(0)

    // The float-right max-width is 45% of its containing block; the figure should
    // render at the smaller of the video's natural width and that cap — never the
    // 300px default that an unsized <video> would otherwise impose.
    const floatMaxWidth = 0.45 * data.contentWidth
    const expectedWidth = Math.min(data.naturalWidth, floatMaxWidth)
    expect(Math.abs(data.figureWidth - expectedWidth)).toBeLessThan(10)
  })
})
