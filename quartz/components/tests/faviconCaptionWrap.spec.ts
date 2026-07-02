import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// The favicon transformer wraps a link's last word plus its favicon in a
// `white-space: nowrap` span (`.favicon-span`) so the icon never orphans alone.
// Under greedy wrapping that whole unit can still fall to its own line,
// stranding the last word. Figcaptions defend against this with
// `text-wrap: pretty`, which pulls the preceding word down to share the line.
// This is a progressive enhancement: only Chromium reliably implements
// `text-wrap: pretty`, so the assertion is scoped there (it degrades to greedy
// wrapping elsewhere).
test.describe("figcaption favicon wrapping", () => {
  test("keeps a trailing favicon-span from orphaning onto its own line", async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.includes("Chrome"), "text-wrap: pretty is Chromium-only")

    await gotoPage(page, "http://localhost:8080/test-page")

    const measured = await page.evaluate(() => {
      const article = document.querySelector("article") ?? document.body
      const cap = document.createElement("figcaption")
      // The last word ("her.") and a favicon glyph live in a nowrap span,
      // mirroring what the favicon transformer emits.
      cap.innerHTML =
        'moments before they pushed the lever and it <span id="pre">killed</span> ' +
        '<span class="favicon-span">her.<span style="display:inline-block;width:14px;' +
        'height:14px;background:#888;vertical-align:middle"></span></span>'
      article.appendChild(cap)

      const pre = cap.querySelector<HTMLElement>("#pre")
      const fav = cap.querySelector<HTMLElement>(".favicon-span")
      if (!pre || !fav) throw new Error("missing fixture elements")

      const sameLine = () =>
        Math.abs(pre.getBoundingClientRect().top - fav.getBoundingClientRect().top) < 1

      // Shrink the caption until the favicon unit would orphan under greedy
      // wrapping. The control (text-wrap: wrap) proves the width really
      // strands the unit on its own line.
      cap.style.textWrap = "wrap"
      let orphanWidth = 0
      for (let w = 360; w >= 120; w -= 2) {
        cap.style.width = `${w}px`
        cap.style.maxWidth = `${w}px`
        if (!sameLine()) {
          orphanWidth = w
          break
        }
      }
      const controlOrphaned = orphanWidth > 0 && !sameLine()

      // Clear the inline override so the figcaption falls back to its real
      // stylesheet value. If `custom.scss` sets `text-wrap: pretty`, the
      // preceding word is pulled down to share the favicon unit's line.
      cap.style.textWrap = ""
      const resolvedTextWrap = getComputedStyle(cap).getPropertyValue("text-wrap-style")
      const stylesheetKeepsTogether = sameLine()

      cap.remove()
      return { controlOrphaned, stylesheetKeepsTogether, orphanWidth, resolvedTextWrap }
    })

    // Sanity: the chosen width genuinely orphans the unit under greedy wrapping.
    expect(measured.controlOrphaned).toBe(true)
    // The figcaption stylesheet resolves to `pretty` (the fix in custom.scss).
    expect(measured.resolvedTextWrap).toBe("pretty")
    // The fix: `text-wrap: pretty` pulls the preceding word down to share the line.
    expect(measured.stylesheetKeepsTogether).toBe(true)
  })
})
