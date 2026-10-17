import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// A page listing's tags render as inline `<li>`s with no whitespace between
// them. In a row too narrow for the next tag, that tag must move to the next
// row whole rather than split mid-word.
test("a page listing wraps between tags, never inside one", async ({ page }) => {
  await gotoPage(page, "http://localhost:8080/test-page")

  const splitTags = await page.evaluate(() => {
    const article = document.querySelector("article") ?? document.body
    const listing = document.createElement("div")
    listing.className = "page-listing"
    listing.style.width = "200px"
    const tags = ["governance", "deepmind", "military", "personal", "AI"]
    const items = tags.map((tag) => `<li><a class="internal tag-link" href="#">${tag}</a></li>`)
    listing.innerHTML = `<ul class="tags">${items.join("")}</ul>`
    article.appendChild(listing)

    const links = Array.from(listing.querySelectorAll("a"))
    const rowsOf = (link: Element) =>
      new Set(Array.from(link.getClientRects()).map((rect) => Math.round(rect.top))).size
    const listRows = new Set(links.map((link) => Math.round(link.getBoundingClientRect().top)))
    const result = {
      wraps: listRows.size > 1,
      split: links.filter((link) => rowsOf(link) > 1).map((link) => link.textContent),
    }
    listing.remove()
    return result
  })

  // The list wraps (so the scenario is exercised), yet no tag splits.
  expect(splitTags).toEqual({ wraps: true, split: [] })
})
