import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// Browsers open a soft-wrap opportunity at each edge of an atomic inline box.
// The second test measures which trailing punctuation actually falls through
// that opportunity — a closing quote does, a closing bracket does not — which
// is why `inlineAtomGlue` only has to adopt quotes.
test.describe("inline atom quote wrapping", () => {
  test("keeps a closing quote in the atom's nowrap span", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const gooseEmoji = page.locator('figcaption img.emoji[alt="🪿"]')
    await expect(gooseEmoji).toHaveCount(1)

    const spanText = await gooseEmoji.evaluate(
      (img) => img.closest(".nowrap-span")?.textContent ?? null,
    )
    // Both the opening and the closing curly quote share the emoji's span.
    expect(spanText).toBe("“”")

    const sprite = page.locator('p img.inline-img[alt="green dot"]')
    await expect(sprite).toHaveCount(1)
    const spriteSpanText = await sprite.evaluate(
      (img) => img.closest(".nowrap-span")?.textContent ?? null,
    )
    expect(spriteSpanText).toBe("“”")

    // A favicon reaches its closing quote by a different route: the quote is
    // moved inside the link before the icon is spliced in beside it.
    const favicon = page.locator('p a[href*="arxiv.org/abs/1912.01217"] .nowrap-span')
    await expect(favicon).toHaveCount(1)
    expect(await favicon.evaluate((span) => span.textContent)).toContain("”")
  })

  test("a quote falls through the box edge, a bracket does not", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate(() => {
      const article = document.querySelector("article") ?? document.body
      const atom =
        '<span style="display:inline-block;width:14px;height:14px;' +
        'background:#888;vertical-align:middle"></span>'

      const build = (inner: string): HTMLParagraphElement => {
        const p = document.createElement("p")
        p.innerHTML = `pushed the lever and it killed ${inner}`
        article.appendChild(p)
        return p
      }

      // Narrowest width at which the trailing mark leaves the atom's line, or 0
      // if it never does.
      const strandWidth = (p: HTMLParagraphElement): number => {
        const box = p.querySelector<HTMLElement>("#atom")
        const mark = p.querySelector<HTMLElement>("#mark")
        if (!box || !mark) throw new Error("missing fixture elements")
        for (let w = 300; w >= 60; w -= 1) {
          p.style.width = `${w}px`
          p.style.maxWidth = `${w}px`
          if (mark.getBoundingClientRect().top - box.getBoundingClientRect().top > 1) return w
        }
        return 0
      }

      const cases = {
        // Control: a quote outside the atom's box strands at some width.
        looseQuote: `<span id="atom">${atom}</span><span id="mark">”</span>`,
        // A bracket never strands, so it needs no box of its own.
        looseBracket: `<span id="atom">${atom}</span><span id="mark">)</span>`,
        // The fix: the quote shares the atom's nowrap box.
        gluedQuote: `<span id="atom" class="nowrap-span">${atom}<span id="mark">”</span></span>`,
      }

      const result: Record<string, number> = {}
      for (const [name, inner] of Object.entries(cases)) {
        const p = build(inner)
        result[name] = strandWidth(p)
        p.remove()
      }
      return result
    })

    expect(measured.looseQuote).toBeGreaterThan(0)
    expect(measured.looseBracket).toBe(0)
    expect(measured.gluedQuote).toBe(0)
  })
})
