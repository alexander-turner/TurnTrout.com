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

// The test page's relation-wrap demo is sized so "We swept α ∈" would fit on
// its first line; the set must still open the second line beside `∈`.
test("the relation-wrap demo keeps the relation beside its operand", async ({ page }) => {
  await gotoPage(page, "http://localhost:8080/test-page")

  const demo = page.locator("#relation-wrap-demo")
  const tops = await demo.evaluate((element) => {
    const top = (selector: string): number => {
      const target = element.querySelector(selector)
      if (!target) throw new Error(`missing ${selector} in the demo`)
      return target.getBoundingClientRect().top
    }
    return { relation: top(".katex-html .mrel"), set: top(".katex-html .mopen") }
  })
  const fontSize = await demo.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))

  expect(Math.abs(tops.set - tops.relation)).toBeLessThan(fontSize / 2)
})
