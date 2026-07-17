import {
  charsToSpace,
  charsToSpaceItalic,
  charsToSpaceMost,
  charsToSpaceMostItalic,
  EMPTY_GLYPH_CONTEXT,
  nudgeClassFor,
} from "../../plugins/transformers/favicons"
import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// Deterministic check of the favicon left-gap model, in two layers:
//
//  1. The computed `margin-left` of a favicon must resolve to the model's
//     exact value for every (nudge class, context) pair — this pins the CSS
//     (variable overrides, selector specificity) to the pixel.
//  2. The rendered ink gap — margin plus the last glyph's right side bearing
//     measured inside the favicon's vertical band (0.2em–0.7em above the
//     baseline, mirroring the icon's raised box) — must stay inside a
//     crowding floor and a drift ceiling for every probed (context, glyph)
//     pair, using the site's real fonts.
//
// Set membership itself is pinned exactly by `nudgeClassFor` unit tests in
// favicons.test.ts; the band here catches rendering-level regressions (wrong
// font served, margin model applied in the wrong context) rather than
// re-deriving membership.
const PROBE_CHARS: readonly string[] = [
  ...new Set([
    ...charsToSpace,
    ...charsToSpaceMost,
    ...charsToSpaceItalic,
    ...charsToSpaceMostItalic,
    ..."oenas",
  ]),
]

interface ContextSpec {
  name: "serif" | "italic" | "smallCaps" | "code"
  wrapperHtml: [string, string]
  context: typeof EMPTY_GLYPH_CONTEXT
}

const CONTEXTS: readonly ContextSpec[] = [
  { name: "serif", wrapperHtml: ["", ""], context: EMPTY_GLYPH_CONTEXT },
  {
    name: "italic",
    wrapperHtml: ["<em>", "</em>"],
    context: { ...EMPTY_GLYPH_CONTEXT, italic: true },
  },
  {
    name: "smallCaps",
    wrapperHtml: ['<abbr class="small-caps">', "</abbr>"],
    context: { ...EMPTY_GLYPH_CONTEXT, smallCaps: true },
  },
  {
    name: "code",
    wrapperHtml: ["<code>", "</code>"],
    context: { ...EMPTY_GLYPH_CONTEXT, code: true },
  },
]

// margin-left = 0.125·base + nudge − inset·size, with base-margin 8px and a
// domainless icon (inset 0). Inside code a uniform −0.125·base nudge replaces
// the per-glyph classes.
const BASE_MARGIN = 8
const EXPECTED_MARGIN_PX: Readonly<Record<string, number>> = {
  "serif|null": 0.125 * BASE_MARGIN,
  "serif|close-text": 0.25 * BASE_MARGIN,
  "serif|closer-text": 0.375 * BASE_MARGIN,
  "italic|null": 0.125 * BASE_MARGIN,
  "italic|close-text": 0.25 * BASE_MARGIN,
  "italic|closer-text": 0.375 * BASE_MARGIN,
  "smallCaps|null": 0.125 * BASE_MARGIN,
  "smallCaps|close-text": 0.25 * BASE_MARGIN,
  "smallCaps|closer-text": 0.375 * BASE_MARGIN,
  "code|null": 0,
}

// Crowding floors per class (deep overhangers accept tighter clearance, as in
// the serif audit) and drift ceilings per context. Ink-in-band understates the
// perceptual audit for glyphs whose flat edges read closer than round ones, so
// the serif/smallCaps ceilings are generous; code is tight because its gap is
// context-uniform.
const FLOOR_PX: Readonly<Record<string, number>> = {
  null: -0.25,
  "close-text": -0.75,
  "closer-text": -1.5,
}
const CEILING_PX: Readonly<Record<string, number>> = {
  serif: 6,
  italic: 4,
  smallCaps: 6,
  code: 2.5,
}

interface Measurement {
  key: string
  marginPx: number
  gapPx: number | null
}

interface Probe {
  key: string
  contextName: ContextSpec["name"]
  char: string
  wrapperHtml: [string, string]
  nudgeClass: ReturnType<typeof nudgeClassFor>
}

function collectFailures(probes: readonly Probe[], measurements: readonly Measurement[]): string[] {
  const failures: string[] = []
  for (const probe of probes) {
    const measured = measurements.find((m) => m.key === probe.key)
    if (!measured) {
      failures.push(`${probe.key}: no measurement`)
      continue
    }
    const expectedMargin =
      EXPECTED_MARGIN_PX[`${probe.contextName}|${probe.nudgeClass ?? "null"}`] ??
      EXPECTED_MARGIN_PX[`${probe.contextName}|null`]
    if (Math.abs(measured.marginPx - expectedMargin) > 0.1) {
      failures.push(`${probe.key}: margin ${measured.marginPx.toFixed(2)}px != ${expectedMargin}px`)
    }
    if (measured.gapPx !== null) {
      const floor = FLOOR_PX[probe.nudgeClass ?? "null"]
      const ceiling = CEILING_PX[probe.contextName]
      if (measured.gapPx < floor || measured.gapPx > ceiling) {
        failures.push(
          `${probe.key} (${probe.nudgeClass ?? "no class"}): ` +
            `gap ${measured.gapPx.toFixed(2)}px outside [${floor}, ${ceiling}]`,
        )
      }
    }
  }
  return failures
}

test.describe("favicon ink gap", () => {
  test("margins resolve exactly and ink gaps stay inside the band", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const probes: Probe[] = CONTEXTS.flatMap((ctx) =>
      PROBE_CHARS.map((char) => ({
        key: `${ctx.name}|${char}`,
        contextName: ctx.name,
        char,
        wrapperHtml: ctx.wrapperHtml,
        nudgeClass: nudgeClassFor(char, ctx.context),
      })),
    )

    const measurements: Measurement[] = await page.evaluate(async (probeList) => {
      const host = document.createElement("div")
      const article = document.querySelector("article") ?? document.body
      article.appendChild(host)

      const canvas = document.createElement("canvas")
      const CANVAS_FONT_PX = 400
      canvas.width = 1600
      canvas.height = 900
      const ctx2d = canvas.getContext("2d")
      if (!ctx2d) throw new Error("no canvas context")

      // Right side bearing of `char` inside the favicon's vertical band,
      // in em of the rendered font. Null when the glyph has no ink there.
      const bearingInBand = (style: CSSStyleDeclaration, char: string): number | null => {
        const baseline = 700
        ctx2d.clearRect(0, 0, canvas.width, canvas.height)
        ctx2d.font = `${style.fontStyle} ${CANVAS_FONT_PX}px ${style.fontFamily}`
        ctx2d.fontVariantCaps = style.fontVariantCaps as CanvasFontVariantCaps
        ctx2d.textBaseline = "alphabetic"
        ctx2d.fillText(char, 400, baseline)
        const advance = ctx2d.measureText(char).width
        const top = Math.floor(baseline - 0.7 * CANVAS_FONT_PX)
        const bottom = Math.ceil(baseline - 0.2 * CANVAS_FONT_PX)
        const image = ctx2d.getImageData(0, 0, canvas.width, canvas.height)
        for (let x = canvas.width - 1; x >= 0; x--) {
          for (let y = top; y <= bottom; y++) {
            if (image.data[(y * canvas.width + x) * 4 + 3] > 40) {
              return (400 + advance - x) / CANVAS_FONT_PX
            }
          }
        }
        return null
      }

      await document.fonts.ready
      const results: { key: string; marginPx: number; gapPx: number | null }[] = []
      for (const probe of probeList) {
        host.innerHTML =
          `<p>${probe.wrapperHtml[0]}<span class="ink-probe">${probe.char}</span>` +
          `<svg class="favicon${probe.nudgeClass ? ` ${probe.nudgeClass}` : ""}" aria-hidden="true"></svg>` +
          `${probe.wrapperHtml[1]}</p>`
        const probeSpan = host.querySelector<HTMLElement>(".ink-probe")
        const favicon = host.querySelector<SVGElement>("svg.favicon")
        if (!probeSpan || !favicon) throw new Error(`fixture failed for ${probe.key}`)
        const faviconStyle = getComputedStyle(favicon)
        const probeStyle = getComputedStyle(probeSpan)
        const marginPx = parseFloat(faviconStyle.marginLeft)
        const fontSizePx = parseFloat(probeStyle.fontSize)
        const bearingEm = bearingInBand(probeStyle, probe.char)
        results.push({
          key: probe.key,
          marginPx,
          gapPx: bearingEm === null ? null : marginPx + bearingEm * fontSizePx,
        })
      }
      host.remove()
      return results
    }, probes)

    const failures = collectFailures(probes, measurements)
    expect(failures, failures.join("\n")).toEqual([])
  })
})
