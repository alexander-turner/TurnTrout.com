import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// The test page's inline `$e^{i\pi} + 1 = 0$` holds one binary operator and one
// relation. Squeezed into a 1px-wide paragraph, the formula wraps at every
// break opportunity it has: one must remain after `+`, and none may follow `=`.
test("inline math never breaks after a relation", async ({ page }) => {
  await gotoPage(page, "http://localhost:8080/test-page")

  const lines = await page.evaluate(() => {
    const source = Array.from(document.querySelectorAll("article p .katex")).find((katex) =>
      katex.querySelector(".katex-html .mrel"),
    )
    if (!source) throw new Error("no inline math with a relation on the test page")

    const probe = document.createElement("p")
    probe.style.cssText = "width:1px;max-width:1px;margin:0"
    probe.appendChild(source.cloneNode(true))
    source.closest("article")?.appendChild(probe)

    const atoms = Array.from(
      probe.querySelectorAll<HTMLElement>(
        ".katex-html > .base > .mord, .katex-html > .base > .mbin, .katex-html > .base > .mrel",
      ),
    )
    const tops = atoms.map((atom) => atom.getBoundingClientRect().top)
    const fontSize = parseFloat(getComputedStyle(atoms[0]).fontSize)
    const sharesLineWithNext = (cls: string): boolean => {
      const index = atoms.findIndex((atom) => atom.classList.contains(cls))
      if (index < 0 || index + 1 >= atoms.length) throw new Error(`no operand after .${cls}`)
      return Math.abs(tops[index + 1] - tops[index]) < fontSize / 2
    }

    const result = {
      afterBinaryOperator: sharesLineWithNext("mbin"),
      afterRelation: sharesLineWithNext("mrel"),
    }
    probe.remove()
    return result
  })

  expect(lines).toEqual({ afterBinaryOperator: false, afterRelation: true })
})
