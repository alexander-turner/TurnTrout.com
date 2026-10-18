import type { Page } from "@playwright/test"

import { mobileBreakpoint } from "../../styles/variables"
import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

interface Fixture {
  html: string
  // The element whose content width is set, as a multiple of `measured`'s width.
  sized: string
  measured: string
  fraction: number
  // The element whose text is split into rows; defaults to `measured`.
  rowsOf?: string
}

/** Lays out ``html`` at the fixture's width and returns the row element's text by row. */
function rowsOf(page: Page, fixture: Fixture): Promise<string[]> {
  return page.evaluate(({ html, sized, measured, fraction, rowsOf: rowElement }) => {
    const article = document.querySelector("article") ?? document.body
    const host = document.createElement("div")
    host.innerHTML = html
    article.appendChild(host)
    const box = host.querySelector<HTMLElement>(sized)
    const target = host.querySelector<HTMLElement>(measured)
    const rowSource = host.querySelector<HTMLElement>(rowElement ?? measured)
    if (!box || !target || !rowSource) throw new Error("missing fixture elements")

    const style = getComputedStyle(box)
    const chrome = [
      style.paddingLeft,
      style.paddingRight,
      style.borderLeftWidth,
      style.borderRightWidth,
    ].reduce((sum, value) => sum + parseFloat(value), 0)
    box.style.width = "max-content"
    const natural = target.getBoundingClientRect().width
    box.style.boxSizing = "border-box"
    box.style.width = `${chrome + natural * fraction}px`

    const rows = new Map<number, string>()
    const walker = document.createTreeWalker(rowSource, NodeFilter.SHOW_TEXT)
    for (
      let node = walker.nextNode() as Text | null;
      node;
      node = walker.nextNode() as Text | null
    ) {
      for (let i = 0; i < node.length; i++) {
        const range = document.createRange()
        range.setStart(node, i)
        range.setEnd(node, i + 1)
        const rect = range.getClientRects()[0]
        if (!rect || rect.width === 0) continue
        const row = Math.round((rect.top + rect.bottom) / 8)
        rows.set(row, (rows.get(row) ?? "") + node.data[i])
      }
    }
    host.remove()
    return [...rows.values()]
  }, fixture)
}

// A `<wbr>` inside a code token is a break opportunity the line breaker prefers
// over an earlier space, so a token holding one moves to the next row whole when
// it fits there, and breaks at its `<wbr>` only when wider than a row. Each case
// sizes its container from the token's measured width.
test.describe("code token wrapping", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")
  })

  const codeLine =
    '<figure data-rehype-pretty-code-figure=""><pre><code data-line-numbers="" ' +
    'data-line-numbers-max-digits="1"><span data-line=""><span>result = </span>' +
    '<span class="code-token"><span>print(<wbr>is_prime(3))</span></span></span></code></pre></figure>'

  for (const [label, fraction, expected] of [
    ["moves a token that fits a row to the next row whole", 1.05, ["print(is_prime(3))"]],
    ["breaks a token wider than a row at its seam", 0.75, ["print(", "is_prime(3))"]],
  ] as const) {
    test(`in a code block, ${label}`, async ({ page }) => {
      const rows = await rowsOf(page, {
        html: codeLine,
        sized: "[data-line]",
        measured: ".code-token",
        fraction,
      })
      expect(rows).toEqual(expected)
    })
  }

  const path = '<code class="inline-code-path">r/<wbr>Fantasy_World_Building</code>'

  test("a path in running text moves to the next line whole", async ({ page }) => {
    const rows = await rowsOf(page, {
      html: `<p>including ${path}.</p>`,
      sized: "p",
      measured: "code",
      fraction: 1.05,
    })
    expect(rows).toEqual(["r/Fantasy_World_Building"])
  })

  // Narrower than the path but wider than the part after its slash.
  test("a path in a heading breaks after its slash in place", async ({ page }) => {
    const rows = await rowsOf(page, {
      html: `<h2>In ${path}</h2>`,
      sized: "h2",
      measured: "code",
      fraction: 0.96,
      rowsOf: "h2",
    })
    expect(rows).toEqual(["In r/", "Fantasy_World_Building"])
  })

  test("a long code token stays inline on narrow screens", async ({ page }) => {
    const display = await page.evaluate(() => {
      const figure = document.createElement("figure")
      figure.innerHTML =
        '<pre><code><span data-line=""><span class="code-token code-token-wide">x</span>' +
        "</span></code></pre>"
      document.body.appendChild(figure)
      const token = figure.querySelector(".code-token")
      if (!token) throw new Error("missing fixture element")
      const value = getComputedStyle(token).display
      figure.remove()
      return value
    })
    const width = page.viewportSize()?.width ?? 0
    expect(display).toBe(width > mobileBreakpoint ? "inline-block" : "inline")
  })
})
