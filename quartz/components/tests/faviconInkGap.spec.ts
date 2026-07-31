import type { Page } from "@playwright/test"

import {
  charsToSpace,
  charsToSpaceCode,
  charsToSpaceItalic,
  charsToSpaceMost,
  charsToSpaceMostCode,
  charsToSpaceMostItalic,
  EMPTY_GLYPH_CONTEXT,
  nudgeClassFor,
} from "../../plugins/transformers/favicons"
import { fauxBoldOffset } from "../../styles/variables"
import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// Deterministic check of the favicon left-gap model, in two layers:
//
//  1. The computed `margin-left` of a favicon must resolve to the model's
//     exact value for every (nudge class, context) pair — this pins the CSS
//     (variable overrides, selector specificity) to the pixel.
//  2. The rendered ink gap — margin plus the last glyph's right side bearing,
//     measured inside the band the icon actually occupies — must hold one
//     constant across every face and every plausible link-ending glyph.
//
// The band is derived per probe from the rendered icon rather than assumed.
// `--favicon-size` is rem-denominated while glyphs scale in em, so the icon
// covers a different slice of the glyph in each context: 0.125em–0.750em in
// body text but 0.154em–0.926em inside `<code>`. A fixed band measures the
// wrong ink in every context but one.
//
// Set membership itself is pinned exactly by `nudgeClassFor` unit tests in
// favicons.test.ts; this spec catches rendering-level regressions (wrong font
// served, margin model applied in the wrong context) rather than re-deriving
// membership.
const PROBE_CHARS: readonly string[] = [
  ...new Set([
    ...charsToSpace,
    ...charsToSpaceMost,
    ...charsToSpaceItalic,
    ...charsToSpaceMostItalic,
    ..."oenas",
  ]),
]
// The monospace sets are their own membership, so the code context probes them
// rather than the proportional faces' chars.
const CODE_PROBE_CHARS: readonly string[] = [
  ...new Set([...charsToSpaceCode, ...charsToSpaceMostCode, ..."oenas"]),
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

// margin-left = 0.125·base + nudge − inset·size, with a domainless icon
// (inset 0). $base-margin is rem-denominated, so the absolute pixel value
// varies with the viewport's root font size; the invariant is the RATIO to
// the classless serif margin (the "unit"): close-text doubles it,
// closer-text triples it, and inside code a uniform −0.125·base nudge
// cancels it to zero, which the code classes return by a half step and a
// whole step.
const MARGIN_UNIT_MULTIPLIER: Readonly<Record<string, number>> = {
  "close-text": 2,
  "closer-text": 3,
  "code-close-text": 0.5,
  "code-closer-text": 1,
}
const UNIT_PROBE_KEY = "serif|o"

// Crowding floors per class (deep overhangers accept tighter clearance, as in
// the serif audit) and drift ceilings per context, in em of the probe's font
// so they scale with the viewport's root font size like the glyphs do.
// Ink-in-band understates the perceptual audit for glyphs whose flat edges
// read closer than round ones (serif "R"), thin monospace glyphs ("l", "[")
// center in FiraCode's fixed advance with legitimately wide bearings, and a
// capital "L"'s arm sits below the band leaving only its stem, so every
// ceiling is generous — the exact margin-ratio layer above is the regression
// ratchet, not the band.
const FLOOR_EM: Readonly<Record<string, number>> = {
  null: -0.0125,
  "close-text": -0.0375,
  "closer-text": -0.075,
  "code-close-text": -0.0125,
  "code-closer-text": -0.0125,
}
const CEILING_EM: Readonly<Record<string, number>> = {
  serif: 0.32,
  italic: 0.22,
  smallCaps: 0.4,
  code: 0.4,
}

interface Measurement {
  key: string
  marginPx: number
  fontSizePx: number
  gapPx: number | null
  fromFallbackFace: boolean
  fromUnsupportedSmallCaps: boolean
  bandTopEm: number
  bandBottomEm: number
}

interface Probe {
  key: string
  contextName: ContextSpec["name"]
  char: string
  wrapperHtml: [string, string]
  nudgeClass: ReturnType<typeof nudgeClassFor>
}

/** The probe's expected margin as a multiple of the classless serif margin. */
function marginMultiplier(probe: Probe): number {
  if (probe.nudgeClass) return MARGIN_UNIT_MULTIPLIER[probe.nudgeClass]
  // The uniform monospace correction cancels the classless margin entirely.
  return probe.contextName === "code" ? 0 : 1
}

function collectFailures(probes: readonly Probe[], measurements: readonly Measurement[]): string[] {
  const unit = measurements.find((m) => m.key === UNIT_PROBE_KEY)
  if (!unit || unit.marginPx <= 0) {
    return [`margin unit probe ${UNIT_PROBE_KEY} missing or non-positive`]
  }
  const failures: string[] = []
  for (const probe of probes) {
    const measured = measurements.find((m) => m.key === probe.key)
    if (!measured) {
      failures.push(`${probe.key}: no measurement`)
      continue
    }
    const expectedMargin = marginMultiplier(probe) * unit.marginPx
    if (Math.abs(measured.marginPx - expectedMargin) > 0.1) {
      failures.push(
        `${probe.key}: margin ${measured.marginPx.toFixed(2)}px != ${expectedMargin.toFixed(2)}px`,
      )
    }
    if (measured.gapPx !== null) {
      const gapEm = measured.gapPx / measured.fontSizePx
      const floor = FLOOR_EM[probe.nudgeClass ?? "null"]
      const ceiling = CEILING_EM[probe.contextName]
      if (gapEm < floor || gapEm > ceiling) {
        failures.push(
          `${probe.key} (${probe.nudgeClass ?? "no class"}): ` +
            `gap ${gapEm.toFixed(3)}em outside [${floor}, ${ceiling}]`,
        )
      }
    }
  }
  return failures
}

/** Builds one probe per (context, char) pair with its expected nudge class. */
function buildProbes(contexts: readonly ContextSpec[], chars: readonly string[]): Probe[] {
  return contexts.flatMap((ctx) =>
    chars.map((char) => ({
      key: `${ctx.name}|${char}`,
      contextName: ctx.name,
      char,
      wrapperHtml: ctx.wrapperHtml,
      nudgeClass: nudgeClassFor(char, ctx.context),
    })),
  )
}

/**
 * Renders each probe (glyph + favicon inside its context wrapper) on the page
 * and measures the favicon's computed margin plus the glyph's right side
 * bearing inside the favicon's vertical band, using the site's real fonts.
 *
 * The band is read off the rendered icon rather than assumed: `--favicon-size`
 * is rem-denominated while glyphs scale in em, so the slice of a glyph the icon
 * actually sits beside differs per context (0.125em–0.750em in body text,
 * 0.060em–0.362em in an `h1`). A zero-sized inline-block marker in the same
 * line box supplies the baseline the band is measured from.
 */
async function measureProbes(page: Page, probes: readonly Probe[]): Promise<Measurement[]> {
  return await page.evaluate(async (probeList) => {
    const host = document.createElement("div")
    const article = document.querySelector("article") ?? document.body
    article.appendChild(host)

    const canvas = document.createElement("canvas")
    const CANVAS_FONT_PX = 400
    const PEN_X = 400
    canvas.width = 1600
    canvas.height = 900
    const ctx2d = canvas.getContext("2d")
    if (!ctx2d) throw new Error("no canvas context")

    // Selects the face and, for a small-caps context, the real `smcp` form.
    // Substituting the capital instead (as an earlier revision did) measures a
    // glyph the page never renders: the small-cap forms carry their own
    // advance widths and bearings.
    const applyFont = (style: CSSStyleDeclaration, family?: string): void => {
      ctx2d.font = `${style.fontStyle} ${CANVAS_FONT_PX}px ${family ?? style.fontFamily}`
      ctx2d.fontVariantCaps = style.fontVariantCaps === "small-caps" ? "small-caps" : "normal"
    }

    // Right side bearing of `char` inside `[bottomEm, topEm]` above the
    // baseline, in em of the rendered font. Null when the glyph has no ink
    // there — such a glyph cannot crowd the icon.
    const bearingInBand = (
      style: CSSStyleDeclaration,
      char: string,
      topEm: number,
      bottomEm: number,
    ): number | null => {
      const baseline = 700
      ctx2d.clearRect(0, 0, canvas.width, canvas.height)
      applyFont(style)
      ctx2d.textBaseline = "alphabetic"
      ctx2d.fillText(char, PEN_X, baseline)
      const advance = ctx2d.measureText(char).width
      const top = Math.max(0, Math.floor(baseline - topEm * CANVAS_FONT_PX))
      const bottom = Math.min(canvas.height - 1, Math.ceil(baseline - bottomEm * CANVAS_FONT_PX))
      const image = ctx2d.getImageData(0, 0, canvas.width, canvas.height)
      for (let x = canvas.width - 1; x >= 0; x--) {
        for (let y = top; y <= bottom; y++) {
          if (image.data[(y * canvas.width + x) * 4 + 3] > 40) {
            return (PEN_X + advance - x) / CANVAS_FONT_PX
          }
        }
      }
      return null
    }

    // True when the requested family has no outline for `char`, so the
    // canvas drew whichever face the platform substitutes. Such a glyph
    // measures differently per OS. Detected by advance width: a substituted
    // glyph matches what a nonexistent family produces, since both resolve
    // through the same fallback chain.
    const isFallbackGlyph = (style: CSSStyleDeclaration, char: string): boolean => {
      applyFont(style)
      const requested = ctx2d.measureText(char).width
      applyFont(style, '"__no_such_family__"')
      const substituted = ctx2d.measureText(char).width
      return Math.abs(requested - substituted) < 0.01
    }

    // Canvas-level `font-variant-caps` support differs per engine. Where it is
    // missing, a lowercase probe silently measures the lowercase glyph, which
    // is exactly the blind spot this sweep exists to close — so detect it and
    // report those probes rather than judging them. A face with real `smcp`
    // gives the small-cap form a different advance from the lowercase one.
    const smallCapsUnsupported = (style: CSSStyleDeclaration, char: string): boolean => {
      if (style.fontVariantCaps !== "small-caps" || !/[a-z]/.test(char)) return false
      applyFont(style)
      const smallCap = ctx2d.measureText(char).width
      ctx2d.fontVariantCaps = "normal"
      return Math.abs(smallCap - ctx2d.measureText(char).width) < 0.01
    }

    await document.fonts.ready
    const results: {
      key: string
      marginPx: number
      fontSizePx: number
      gapPx: number | null
      fromFallbackFace: boolean
      fromUnsupportedSmallCaps: boolean
      bandTopEm: number
      bandBottomEm: number
    }[] = []
    for (const probe of probeList) {
      host.innerHTML =
        `<p>${probe.wrapperHtml[0]}<span class="ink-probe">${probe.char}</span>` +
        `<svg class="favicon${probe.nudgeClass ? ` ${probe.nudgeClass}` : ""}" aria-hidden="true"></svg>` +
        `<span class="baseline-probe" style="display:inline-block;width:0;height:0"></span>` +
        `${probe.wrapperHtml[1]}</p>`
      const probeSpan = host.querySelector<HTMLElement>(".ink-probe")
      const favicon = host.querySelector<SVGElement>("svg.favicon")
      const baselineMarker = host.querySelector<HTMLElement>(".baseline-probe")
      if (!probeSpan || !favicon || !baselineMarker)
        throw new Error(`fixture failed for ${probe.key}`)
      const faviconStyle = getComputedStyle(favicon)
      const probeStyle = getComputedStyle(probeSpan)
      const marginPx = parseFloat(faviconStyle.marginLeft)
      const fontSizePx = parseFloat(probeStyle.fontSize)

      // An empty inline-block sits on the baseline, so its bottom edge is the
      // baseline the glyph is drawn from.
      const baselineY = baselineMarker.getBoundingClientRect().bottom
      const iconRect = favicon.getBoundingClientRect()
      const bandTopEm = (baselineY - iconRect.top) / fontSizePx
      const bandBottomEm = (baselineY - iconRect.bottom) / fontSizePx

      const bearingEm = bearingInBand(probeStyle, probe.char, bandTopEm, bandBottomEm)
      results.push({
        key: probe.key,
        marginPx,
        fontSizePx,
        gapPx: bearingEm === null ? null : marginPx + bearingEm * fontSizePx,
        fromFallbackFace: isFallbackGlyph(probeStyle, probe.char),
        fromUnsupportedSmallCaps: smallCapsUnsupported(probeStyle, probe.char),
        bandTopEm,
        bandBottomEm,
      })
    }
    host.remove()
    return results
  }, probes)
}

interface ContextWrapper {
  name: string
  open: string
  close: string
  bolded: boolean
}

// Every rule that applies the faux-bold text-shadow, plus the .right reset
// that removes it.
const FAUX_BOLD_WRAPPERS: readonly ContextWrapper[] = [
  { name: "strong", open: "<strong>", close: "</strong>", bolded: true },
  { name: "title-cell", open: '<div class="title-cell">', close: "</div>", bolded: true },
  {
    name: "admonition-title",
    open: '<span class="admonition-title-inner">',
    close: "</span>",
    bolded: true,
  },
  {
    name: "right-reset",
    open: '<div class="right"><strong>',
    close: "</strong></div>",
    bolded: false,
  },
]

interface BoldMargins {
  plain: number
  boosted: number
  byContext: { name: string; marginPx: number }[]
}

// Slack just above one LayoutUnit (1/64 px in Chromium/WebKit, 1/60 px in
// Firefox) absorbs the double quantization of the derived expectation.
const MARGIN_QUANTUM_PX = 0.02

/** Names the contexts whose favicon margin misses its faux-bold expectation. */
function collectBoldFailures(margins: BoldMargins, wrappers: readonly ContextWrapper[]): string[] {
  return margins.byContext
    .map((measured, index) => {
      const expected = wrappers[index].bolded ? margins.boosted : margins.plain
      const off = Math.abs(measured.marginPx - expected) >= MARGIN_QUANTUM_PX
      return off ? `${measured.name}: margin ${measured.marginPx}px != ${expected}px` : ""
    })
    .filter(Boolean)
}

// Glyphs that plausibly end link text. A face missing one of them renders it
// from a platform substitute whose metrics vary per OS; measureProbes marks
// those and the sweep reports them rather than judging them.
const MEMBERSHIP_CHARS: readonly string[] = [
  ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  ..."()[]{}\\/®™©°%&*+=<>|!?;:’”†‡",
]

// The gap the model is trying to hold constant, in em: the median across all
// four faces, which agree to within 0.02em (serif 0.102, italic 0.082,
// smallCaps 0.100, code 0.095). Only the extremes disagree, which is the point
// of the sweep.
const TARGET_GAP_EM = 0.095

// Ink must never reach the icon. `f` sets this in both proportional faces —
// italic `f` clears by 0.004em, a tenth of a pixel at body size — so the floor
// is the strongest statement that holds today, not a comfortable margin.
const OVERLAP_FLOOR_EM = 0

// A ratchet on how far each face's gaps spread, in em. The model claims one
// constant gap, so the ideal is 0; these are today's measured spreads rounded
// up by ~0.005em of rasterizer slack. Two-directional by construction: making
// any glyph tighter *or* looser than its face's others widens the spread and
// fails. Phases 2–3 shrink these toward a single global window; they must only
// ever be lowered.
const MAX_SPREAD_EM: Readonly<Record<ContextSpec["name"], number>> = {
  serif: 0.21,
  italic: 0.18,
  smallCaps: 0.2,
  code: 0.345,
}

interface GapSample {
  key: string
  gapEm: number
}

/** Measured visual gaps per context, dropping probes that can't be judged. */
function gapsByContext(
  measurements: readonly Measurement[],
): ReadonlyMap<ContextSpec["name"], GapSample[]> {
  const byContext = new Map<ContextSpec["name"], GapSample[]>()
  for (const measured of measurements) {
    // No ink in band means the glyph cannot crowd; a substituted face and an
    // unsupported small-caps probe would both measure differently per OS.
    if (measured.gapPx === null || measured.fromFallbackFace || measured.fromUnsupportedSmallCaps) {
      continue
    }
    const context = measured.key.split("|")[0] as ContextSpec["name"]
    const samples = byContext.get(context) ?? []
    samples.push({ key: measured.key, gapEm: measured.gapPx / measured.fontSizePx })
    byContext.set(context, samples)
  }
  return byContext
}

/**
 * Names every way the rendered gap departs from the one constant the model
 * claims to hold: ink that reaches the icon, and a face whose gaps spread
 * further than its ratchet allows. Reports every violation in one run rather
 * than stopping at the first, so a change's full blast radius is visible.
 */
function collectSweepViolations(
  byContext: ReadonlyMap<ContextSpec["name"], readonly GapSample[]>,
): string[] {
  const violations: string[] = []
  for (const [context, samples] of byContext) {
    if (samples.length === 0) {
      violations.push(`${context}: no judgeable probes`)
      continue
    }
    const sorted = [...samples].sort((a, b) => a.gapEm - b.gapEm)
    const tightest = sorted[0]
    const loosest = sorted[sorted.length - 1]

    if (tightest.gapEm <= OVERLAP_FLOOR_EM) {
      violations.push(`${tightest.key}: gap ${tightest.gapEm.toFixed(3)}em reaches the icon`)
    }
    const spread = loosest.gapEm - tightest.gapEm
    if (spread > MAX_SPREAD_EM[context]) {
      violations.push(
        `${context}: gaps spread ${spread.toFixed(3)}em > ${MAX_SPREAD_EM[context]}em ` +
          `(tightest ${tightest.key}=${tightest.gapEm.toFixed(3)}, ` +
          `loosest ${loosest.key}=${loosest.gapEm.toFixed(3)}, target ${TARGET_GAP_EM})`,
      )
    }
  }
  return violations
}

test.describe("favicon ink gap", () => {
  test("margins resolve exactly and ink gaps stay inside the band", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const probes = [
      ...buildProbes(
        CONTEXTS.filter((ctx) => ctx.name !== "code"),
        PROBE_CHARS,
      ),
      ...buildProbes(
        CONTEXTS.filter((ctx) => ctx.name === "code"),
        CODE_PROBE_CHARS,
      ),
    ]
    const measurements = await measureProbes(page, probes)
    const failures = collectFailures(probes, measurements)
    expect(failures, failures.join("\n")).toEqual([])
  })

  // Faux-bold contexts paint glyph ink $faux-bold-offset further right via
  // text-shadow; the faux-bold mixin (_faux-bold.scss) sets
  // --favicon-bold-nudge alongside the shadow so the favicon's visual gap
  // stays constant. Every set-site must widen the margin by exactly the
  // shadow offset, and the .right reset must return it to the plain value.
  // The boosted expectation is derived in-page from a probe whose
  // margin-left is the same calc the engine evaluates, so the assertion
  // inherits the engine's own LayoutUnit quantization.
  test("faux-bold contexts widen the favicon margin by the shadow offset", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const margins: BoldMargins = await page.evaluate(
      ({ wrappers, offset }) => {
        const host = document.createElement("div")
        const article = document.querySelector("article") ?? document.body
        article.appendChild(host)
        const faviconHtml = '<svg class="favicon" aria-hidden="true"></svg>'
        const measure = (html: string): number => {
          host.innerHTML = html
          const favicon = host.querySelector("svg.favicon")
          if (!favicon) throw new Error(`fixture failed for ${html}`)
          return parseFloat(getComputedStyle(favicon).marginLeft)
        }
        const plain = measure(`<span>o${faviconHtml}</span>`)
        const boosted = measure(
          `<span><svg class="favicon" aria-hidden="true" style="margin-left: calc(${plain}px + ${offset})"></svg></span>`,
        )
        const byContext = wrappers.map((wrapper) => ({
          name: wrapper.name,
          marginPx: measure(`${wrapper.open}o${faviconHtml}${wrapper.close}`),
        }))
        host.remove()
        return { plain, boosted, byContext }
      },
      { wrappers: FAUX_BOLD_WRAPPERS, offset: fauxBoldOffset },
    )

    const failures = collectBoldFailures(margins, FAUX_BOLD_WRAPPERS)
    expect(failures, failures.join("\n")).toEqual([])
  })

  // Two-directional sweep: measure every plausible link-ending glyph in every
  // shipped face and hold the *rendered gap* to the single constant the model
  // claims. The membership sets this replaced could only be too small — it
  // demanded a nudge where ink qualified for one and said nothing about a
  // glyph nudged too far, which is how serif "R" reached 0.263em (2.8x the
  // target) without ever failing. Face-wide spread catches both directions and
  // needs no per-face threshold table to stay in sync with the sets.
  test("rendered gaps hold one constant across every face and glyph", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const measurements = await measureProbes(page, buildProbes(CONTEXTS, MEMBERSHIP_CHARS))
    const byContext = gapsByContext(measurements)

    const skipped = measurements
      .filter((m) => m.fromFallbackFace || m.fromUnsupportedSmallCaps)
      .map((m) => m.key)
    console.info(`Probes skipped (substitute face or no smcp support): ${skipped}`)
    for (const [context, samples] of byContext) {
      const sample = measurements.find((m) => m.key.startsWith(`${context}|`))
      const sorted = [...samples].sort((a, b) => a.gapEm - b.gapEm)
      const at = (index: number) => `${sorted[index].key}=${sorted[index].gapEm.toFixed(3)}`
      console.info(
        `${context}: band ${sample?.bandBottomEm.toFixed(3)}–${sample?.bandTopEm.toFixed(3)}em ` +
          `(font ${sample?.fontSizePx}px); n=${sorted.length} ` +
          `tightest ${at(0)} median ${at(Math.floor(sorted.length / 2))} loosest ${at(sorted.length - 1)}`,
      )
    }

    const violations = collectSweepViolations(byContext)
    expect(violations, violations.join("\n")).toEqual([])
  })
})
