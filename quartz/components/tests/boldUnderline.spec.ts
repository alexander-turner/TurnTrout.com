import sharp from "sharp"

import { FAUX_BOLD_WRAPPERS } from "./fauxBoldContexts"
import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// Faux bold is a text-shadow, and a text shadow repaints an element's text
// decorations along with its glyphs. A vertical component therefore drops a
// second copy of every underline below the first, and the line's weight stops
// being `text-decoration-thickness` and becomes "thickness plus however much
// of the shadow the engine painted" — a quantity engines vary on, per painted
// segment. Where skip-ink splits a line around a descender, one word's
// underline can lose the copy its neighbours keep and render visibly thinner.
//
// The invariant: in every faux-bold context, an underline weighs the same with
// the shadow as without it. Stated per context against its own shadowless
// twin, so it holds whatever color, size, or face that context sets.

// Probe text with no descenders, so the only ink below the baseline is the
// underline itself and the band can be found without modelling font metrics.
const PROBE_TEXT = "common moon zone"
// Rows count as the underline when they carry ink across at least this
// fraction of the probe's width. Inter-letter gaps keep glyph rows well under
// it; a rule spans the whole run.
const MIN_UNDERLINE_COVERAGE = 0.6
// Ink that counts as a column being painted rather than rasterizer noise, on
// the 0–255 luminance scale.
const MIN_COLUMN_INK = 8
// How far the shadow may move an underline's weight. A vertical offset of
// $faux-bold-offset measures 30-35% across these contexts at both device
// scales; zero offset measures 0.0-0.2%. The threshold sits between those two
// populations with room to spare on either side.
const MAX_WEIGHT_DRIFT = 0.12

interface Strip {
  readonly data: Buffer
  readonly width: number
  readonly height: number
}

interface RowInk {
  /** Ink above background summed across the row, 0–255 per column. */
  readonly total: number
  /** Columns carrying more than rasterizer noise. */
  readonly painted: number
}

/** How much ink one pixel row of a decoded capture carries. */
function measureRow(strip: Strip, y: number): RowInk {
  let total = 0
  let painted = 0
  for (let x = 0; x < strip.width; x++) {
    const i = (y * strip.width + x) * 4
    const luminance = 0.299 * strip.data[i] + 0.587 * strip.data[i + 1] + 0.114 * strip.data[i + 2]
    const ink = 255 - luminance
    total += ink
    if (ink >= MIN_COLUMN_INK) painted++
  }
  return { total, painted }
}

/**
 * Weight of the probe's underline, as a thickness in device pixels.
 *
 * The band is the lowest run of rows painted across {@link
 * MIN_UNDERLINE_COVERAGE} of the strip — with descender-free probe text that
 * is the underline and nothing else. One row of slack on each side catches the
 * antialiased fringe, which is where a 0.3px shadow copy shows up. Dividing
 * the ink by the strip's width and by full strength keeps probes of different
 * widths comparable.
 * @param strip - Decoded capture of the probe and the space below it.
 */
function underlineWeight(strip: Strip): number {
  const rows = Array.from({ length: strip.height }, (_, y) => measureRow(strip, y))
  const covered = rows
    .map((row, y) => (row.painted >= strip.width * MIN_UNDERLINE_COVERAGE ? y : -1))
    .filter((y) => y >= 0)
  if (covered.length === 0) throw new Error("Probe painted no underline")

  const bottom = covered[covered.length - 1]
  const coveredRows = new Set(covered)
  let top = bottom
  while (coveredRows.has(top - 1)) top--

  let total = 0
  for (let y = Math.max(0, top - 1); y <= Math.min(strip.height - 1, bottom + 1); y++) {
    total += rows[y].total
  }
  return total / (strip.width * 255)
}

test.describe("Faux-bold underlines", () => {
  // Cheap, exact statement of the rule the pixels below demonstrate: the
  // shadow may widen glyphs, but it may not displace anything vertically.
  test("the faux-bold shadow has no vertical component", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const shadows: { name: string; shadow: string }[] = await page.evaluate((wrappers) => {
      const host = document.createElement("div")
      const article = document.querySelector("article") ?? document.body
      article.appendChild(host)
      const measured = wrappers.map((wrapper) => {
        host.innerHTML = `${wrapper.open}<span id="probe">text</span>${wrapper.close}`
        const probe = host.querySelector("#probe")
        if (!probe) throw new Error(`fixture failed for ${wrapper.name}`)
        return { name: wrapper.name, shadow: getComputedStyle(probe).textShadow }
      })
      host.remove()
      return measured
    }, FAUX_BOLD_WRAPPERS)

    // Computed form is "<color> <x> <y> <blur>"; the vertical offset is the
    // second length and must be zero however the engine spells it.
    const failures = shadows
      .map(({ name, shadow }) => {
        const lengths = shadow.match(/-?[\d.]+px/g) ?? []
        const vertical = lengths[1] ?? "0px"
        return parseFloat(vertical) === 0 ? "" : `${name}: vertical offset ${vertical} in ${shadow}`
      })
      .filter(Boolean)
    expect(failures, failures.join("\n")).toEqual([])
  })

  for (const wrapper of FAUX_BOLD_WRAPPERS.filter((w) => w.bolded)) {
    test(`an underline in ${wrapper.name} weighs the same with the shadow as without`, async ({
      page,
    }) => {
      await gotoPage(page, "http://localhost:8080/test-page")

      const box = await page.evaluate(
        ({ open, close, text }) => {
          const host = document.createElement("div")
          host.id = "bold-underline-probe-host"
          const article = document.querySelector("article") ?? document.body
          article.appendChild(host)
          host.innerHTML = `${open}<a id="bold-underline-probe" href="#">${text}</a>${close}`
          const probe = document.querySelector("#bold-underline-probe")
          if (!probe) throw new Error("probe failed to render")
          // The clip below is viewport-relative, so the probe has to be on
          // screen before its box is read.
          probe.scrollIntoView({ block: "center" })
          const rect = probe.getBoundingClientRect()
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        },
        { open: wrapper.open, close: wrapper.close, text: PROBE_TEXT },
      )

      // Capture from mid-glyph down past the rule: the band finder wants the
      // underline to be the lowest painted run in the strip.
      const clip = {
        x: box.x,
        y: box.y + box.height * 0.5,
        width: box.width,
        height: box.height * 0.5 + 4,
      }
      const capture = async (): Promise<Strip> => {
        const buffer = await page.screenshot({ clip })
        const { data, info } = await sharp(buffer)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
        return { data, width: info.width, height: info.height }
      }

      const shadowed = underlineWeight(await capture())
      await page.evaluate(() => {
        const probe = document.querySelector("#bold-underline-probe")
        if (!(probe instanceof HTMLElement)) throw new Error("probe disappeared")
        probe.style.textShadow = "none"
      })
      const bare = underlineWeight(await capture())

      await page.evaluate(() => document.querySelector("#bold-underline-probe-host")?.remove())

      const drift = Math.abs(shadowed - bare) / bare
      expect(
        drift,
        `${wrapper.name}: underline weighs ${shadowed.toFixed(3)}px with the shadow and ` +
          `${bare.toFixed(3)}px without it (${(drift * 100).toFixed(0)}% drift)`,
      ).toBeLessThanOrEqual(MAX_WEIGHT_DRIFT)
    })
  }
})
