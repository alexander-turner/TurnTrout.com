import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

const dropcapParagraph = 'article[data-use-dropcap="true"] > p:first-of-type'

/** Drags from (x, y), relative to the drop-cap paragraph, to its end and returns the copied text. */
async function copyDragFrom(page: Page, dx: number, dy: number): Promise<string> {
  const paragraph = page.locator(dropcapParagraph)
  await paragraph.evaluate((el) => el.scrollIntoView({ block: "center" }))
  const box = await paragraph.boundingBox()
  if (!box) throw new Error("drop-cap paragraph has no box")

  const copied = page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        // Bubble phase, so it reads the selection after the drop-cap handler ran.
        document.addEventListener(
          "copy",
          (event) => {
            event.preventDefault()
            resolve(window.getSelection()?.toString() ?? "")
          },
          { once: true },
        )
      }),
  )
  // On a phone the left margin is narrower than |dx|; stay inside the viewport.
  await page.mouse.move(Math.max(2, box.x + dx), box.y + dy)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 5, box.y + box.height - 5, { steps: 15 })
  await page.mouse.up()
  await page.evaluate(() => document.execCommand("copy"))
  return copied
}

test.describe("drop cap copy", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")
  })

  // The line's start position sits after the floated drop cap, so these drags
  // begin the selection one letter into the paragraph.
  for (const [label, dx, dy] of [
    ["the left margin", -20, 10],
    ["inside the drop cap", 10, 10],
  ] as const) {
    test(`a selection dragged from ${label} copies the drop cap`, async ({ page }) => {
      const firstLetter = await page.locator(dropcapParagraph).getAttribute("data-first-letter")
      const copied = await copyDragFrom(page, dx, dy)
      expect(copied.trimStart().charAt(0).toUpperCase()).toBe(firstLetter)
    })
  }
})
