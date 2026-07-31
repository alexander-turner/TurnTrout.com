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
})
