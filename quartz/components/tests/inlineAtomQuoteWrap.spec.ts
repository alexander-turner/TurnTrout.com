import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// An inline atom (emoji, favicon, authored sprite) is a UAX #14 class-CB box,
// so LB20 opens a break on each of its edges. LB13 already bars `)` and `.`
// from starting a line, but a quote is class QU and its LB19 protection is
// evaluated after LB20 — so only a shared `white-space: nowrap` box keeps a
// closing quote beside the atom it closes.
test.describe("inline atom quote wrapping", () => {
  test("keeps a closing quote in the atom's nowrap span", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const gooseEmoji = page.locator('figcaption img.emoji[alt="🪿"]')
    await expect(gooseEmoji).toHaveCount(1)

    const spanText = await gooseEmoji.evaluate((img) => {
      const span = img.closest(".nowrap-span")
      return span ? span.textContent : null
    })
    // Both the opening and the closing curly quote share the emoji's span.
    expect(spanText).toBe("“”")

    const sprite = page.locator('p img.inline-img[alt="chevron sprite"]').first()
    await expect(sprite).toHaveCount(1)
    const spriteGlued = await sprite.evaluate((img) => img.closest(".nowrap-span") !== null)
    expect(spriteGlued).toBe(true)
  })

  test("a quote outside the span strands, inside it does not", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate(() => {
      const article = document.querySelector("article") ?? document.body
      const atom =
        '<span style="display:inline-block;width:14px;height:14px;' +
        'background:#888;vertical-align:middle"></span>'

      // Two paragraphs identical but for the span boundary: the control leaves
      // the closing quote outside the atom's nowrap box.
      const build = (glued: boolean): HTMLParagraphElement => {
        const p = document.createElement("p")
        p.innerHTML = glued
          ? `pushed the lever and it killed <span class="nowrap-span">${atom}<span id="q">”</span></span>`
          : `pushed the lever and it killed <span class="nowrap-span">${atom}</span><span id="q">”</span>`
        article.appendChild(p)
        return p
      }

      // Narrow enough that the quote is the only thing that can fall through.
      const strandsAt = (p: HTMLParagraphElement): number => {
        const atomBox = p.querySelector<HTMLElement>(".nowrap-span")
        const quote = p.querySelector<HTMLElement>("#q")
        if (!atomBox || !quote) throw new Error("missing fixture elements")
        for (let w = 300; w >= 60; w -= 1) {
          p.style.width = `${w}px`
          p.style.maxWidth = `${w}px`
          const delta = quote.getBoundingClientRect().top - atomBox.getBoundingClientRect().top
          if (delta > 1) return w
        }
        return 0
      }

      const control = build(false)
      const controlStrandWidth = strandsAt(control)
      const glued = build(true)
      const gluedStrandWidth = strandsAt(glued)

      control.remove()
      glued.remove()
      return { controlStrandWidth, gluedStrandWidth }
    })

    // Sanity: without the shared box, some width does strand the quote.
    expect(measured.controlStrandWidth).toBeGreaterThan(0)
    // The fix: inside the box, no width ever separates quote from atom.
    expect(measured.gluedStrandWidth).toBe(0)
  })
})
