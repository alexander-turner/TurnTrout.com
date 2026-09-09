import type { Page } from "@playwright/test"

import { faviconGlyphBearings as bearings } from "../../plugins/transformers/faviconGlyphBearings"
import {
  EMPTY_GLYPH_CONTEXT,
  faviconGapEm,
  TARGET_GAP_EM,
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
// The band is derived per probe from the rendered icon rather than assumed, so
// the sweep keeps measuring the ink the icon actually sits beside even if the
// box model moves. Every favicon length is em, so that band is the same slice
// of the glyph in every context — which is what the size-invariance test below
// asserts directly.
//
// The gap the transformer computes is pinned arithmetically by faviconGapEm
// unit tests in favicons.test.ts; this spec renders it and checks that the
// glyph the reader sees really does end up TARGET_GAP_EM from the icon.
const PROBE_CHARS: readonly string[] = [
  ...new Set([...Object.keys(bearings.serif), ...Object.keys(bearings.italic)]),
]
const CODE_PROBE_CHARS: readonly string[] = [...Object.keys(bearings.code)]

// The four shipped faces, each with its own metrics, plus the size contexts
// that render the serif face at a different font size. Faces get per-face
// thresholds; sizes are judged only against each other.
type FaceName = "serif" | "italic" | "smallCaps" | "code"
type ContextName = FaceName | "h1" | "subtitle" | "tableCell"

interface ContextSpec {
  name: ContextName
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

// margin-left = --glyph-gap − inset·size, with a domainless icon (inset 0), so
// the computed margin should reproduce the transformer's number exactly.
/** `--font-size-code-scale`: inline code's size as a fraction of its prose. */
const CODE_FACE_SCALE = 0.81

// Crowding floors per class (deep overhangers accept tighter clearance, as in
// the serif audit) and drift ceilings per context, in em of the probe's font
// so they scale with the viewport's root font size like the glyphs do.
// Ink-in-band understates the perceptual audit for glyphs whose flat edges
// read closer than round ones (serif "R"), thin monospace glyphs ("l", "[")
// center in FiraCode's fixed advance with legitimately wide bearings, and a
// capital "L"'s arm sits below the band leaving only its stem, so every
// ceiling is generous — the exact margin-ratio layer above is the regression
// ratchet, not the band.
// How far a rendered gap may sit from the target it was computed for. The
// correction is derived from the same in-band measurement this spec re-takes,
// so agreement should be near-exact; the slack absorbs rasterisation, not
// modelling. A glyph whose correction hit a clamp cannot reach the target by
// construction, so it is judged against the clamp instead.
const GAP_TOLERANCE_EM = 0.012

interface Measurement {
  key: string
  marginPx: number
  fontSizePx: number
  gapPx: number | null
  fromFallbackFace: boolean
  fromUnsupportedSmallCaps: boolean
  bandTopEm: number
  bandBottomEm: number
  iconFontSizePx: number
}

/** A per-face threshold, refusing to silently pass a context that has none. */
function thresholdFor(table: Readonly<Record<FaceName, number>>, context: ContextName): number {
  const threshold = table[context as FaceName]
  if (threshold === undefined) throw new Error(`no threshold for context ${context}`)
  return threshold
}

/** The bearing table each context's glyphs were measured in. */
const FACE_OF_CONTEXT: Readonly<Record<string, string>> = {
  serif: "serif",
  italic: "italic",
  smallCaps: "smallCaps",
  code: "code",
  h1: "serif",
  subtitle: "serif",
  tableCell: "serif",
}

interface Probe {
  key: string
  contextName: ContextName
  char: string
  wrapperHtml: [string, string]
  gapEm: number
}

/**
 * The bearing the table holds for a glyph in a context, or undefined where it
 * holds none.
 *
 * A missing entry is the generator's verdict that the glyph cannot be measured
 * in that face — no ink in the icon's band, or no shipped font covering it. The
 * transformer answers with the flat fallback gap, so such a glyph has no target
 * to be held to and no engine may judge its rendered gap. Only the exclusion
 * travels between engines; the reason for it was decided once, where the table
 * was generated.
 */
function bearingOf(contextName: ContextName, char: string): number | undefined {
  const face = contextName === "code" ? "code" : (FACE_OF_CONTEXT[contextName] ?? "serif")
  return (bearings as Record<string, Record<string, number>>)[face]?.[char]
}

/**
 * The gap the glyph should end up showing, in em of the text beside it: the
 * margin the transformer asked for plus whatever the glyph's own bearing
 * contributes. Equal to the target for every glyph whose correction did not hit
 * a clamp, which is what the sweep's spread ratchet then holds them to.
 *
 * The transformer's margin is denominated in the icon's own em, which inside
 * code is the surrounding prose's rather than the code face's, so it is
 * converted back to the glyph's em first.
 */
function expectedGapEm(probe: Probe): number {
  const inCode = probe.contextName === "code"
  const bearing = bearingOf(probe.contextName, probe.char) ?? 0
  return (inCode ? probe.gapEm / CODE_FACE_SCALE : probe.gapEm) + bearing
}

function collectFailures(probes: readonly Probe[], measurements: readonly Measurement[]): string[] {
  const failures: string[] = []
  for (const probe of probes) {
    const measured = measurements.find((m) => m.key === probe.key)
    if (!measured) {
      failures.push(`${probe.key}: no measurement`)
      continue
    }
    const expectedMargin = probe.gapEm * measured.iconFontSizePx
    if (Math.abs(measured.marginPx - expectedMargin) > 0.1) {
      failures.push(
        `${probe.key}: margin ${measured.marginPx.toFixed(2)}px != ${expectedMargin.toFixed(2)}px`,
      )
    }
    // The margin is pure CSS and holds everywhere, but the gap depends on the
    // canvas rendering the same glyph the page does. A substituted face, or an
    // engine without canvas `font-variant-caps` (WebKit draws the lowercase
    // form instead of the small cap), measures a glyph the reader never sees.
    if (
      measured.gapPx !== null &&
      bearingOf(probe.contextName, probe.char) !== undefined &&
      !measured.fromFallbackFace &&
      !measured.fromUnsupportedSmallCaps
    ) {
      const gapEm = measured.gapPx / measured.fontSizePx
      if (Math.abs(gapEm - expectedGapEm(probe)) > GAP_TOLERANCE_EM) {
        failures.push(
          `${probe.key}: gap ${gapEm.toFixed(3)}em != ` +
            `${expectedGapEm(probe).toFixed(3)}em (target ${TARGET_GAP_EM})`,
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
      gapEm: faviconGapEm(char, ctx.context),
    })),
  )
}

/**
 * Renders each probe (glyph + favicon inside its context wrapper) on the page
 * and measures the favicon's computed margin plus the glyph's right side
 * bearing inside the favicon's vertical band, using the site's real fonts.
 *
 * The band is read off the rendered icon rather than assumed, so a change to
 * the box model moves the measurement with it instead of quietly measuring the
 * wrong ink. A zero-sized inline-block marker in the same line box supplies the
 * baseline the band is measured from.
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

    // Advance width, opaque-pixel count and ink bounding box of `char` in
    // `family`. Two faces that differ anywhere in the outline differ here,
    // where an advance width alone collides whenever a substitute happens to
    // be set on the same body.
    const inkSignature = (style: CSSStyleDeclaration, char: string, family?: string): string => {
      const baseline = 700
      ctx2d.clearRect(0, 0, canvas.width, canvas.height)
      applyFont(style, family)
      ctx2d.textBaseline = "alphabetic"
      ctx2d.fillText(char, PEN_X, baseline)
      const advance = ctx2d.measureText(char).width
      const left = PEN_X - CANVAS_FONT_PX / 2
      const top = baseline - CANVAS_FONT_PX * 1.25
      const width = Math.ceil(advance) + CANVAS_FONT_PX
      const height = CANVAS_FONT_PX * 1.75
      const { data } = ctx2d.getImageData(left, top, width, height)
      let count = 0
      let minX = width
      let maxX = -1
      let minY = height
      let maxY = -1
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (data[(y * width + x) * 4 + 3] <= 40) continue
          count += 1
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y)
        }
      }
      return `${advance.toFixed(2)}|${count}|${minX},${maxX},${minY},${maxY}`
    }

    // The families the site ships as @font-face, which render identically on
    // every OS. Everything else in a font-family list — a system face like
    // "Courier New", or a generic keyword — is whatever the platform installs.
    const shippedFamilies = new Set(
      [...(document.fonts as unknown as Iterable<FontFace>)].map((face) =>
        face.family.replace(/^["']|["']$/g, ""),
      ),
    )

    // The tail of `family` that no shipped font covers: the same list with
    // every @font-face family removed.
    const platformChainOf = (family: string): string =>
      family
        .split(",")
        .map((name) => name.trim())
        .filter((name) => !shippedFamilies.has(name.replace(/^["']|["']$/g, "")))
        .join(", ") || '"__no_such_family__"'

    // True when no font the site ships has an outline for `char`, so the canvas
    // drew whichever face the platform substitutes. Such a glyph measures
    // differently per OS and engine — FiraCode has no U+2032, so a prime inside
    // `code` renders from DejaVu on Linux and Courier on macOS — and the sweep
    // cannot judge it. Resolving `char` through the chain's platform tail alone
    // yields the same fingerprint exactly when no shipped font contributed.
    // Kept in step with scripts/generate_favicon_bearings.mjs, which must
    // exclude exactly the same glyphs from the table this sweep checks.
    const isFallbackGlyph = (style: CSSStyleDeclaration, char: string): boolean =>
      inkSignature(style, char) === inkSignature(style, char, platformChainOf(style.fontFamily))

    // True when the canvas painted no pixels anywhere for `char`.
    const drawsNoInk = (style: CSSStyleDeclaration, char: string): boolean =>
      inkSignature(style, char).split("|")[1] === "0"

    // Canvas-level `font-variant-caps` support differs per engine. Where it is
    // missing, a lowercase probe silently measures the lowercase glyph, which
    // is exactly the blind spot this sweep exists to close — so detect it and
    // report those probes rather than judging them. A face with real `smcp`
    // gives the small-cap form a different advance from the lowercase one.
    const smallCapsUnsupported = (style: CSSStyleDeclaration, char: string): boolean => {
      if (style.fontVariantCaps !== "small-caps") return false
      // Some engines draw nothing at all for a glyph in a small-caps run,
      // reporting a full-em advance over blank pixels. The page still shows
      // the glyph, so the canvas is describing a rendering no reader gets.
      if (drawsNoInk(style, char)) return true
      if (!/[a-z]/.test(char)) return false
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
      iconFontSizePx: number
    }[] = []
    for (const probe of probeList) {
      host.innerHTML =
        `<p>${probe.wrapperHtml[0]}<span class="ink-probe">${probe.char}</span>` +
        `<svg class="favicon" style="--glyph-gap: ${probe.gapEm}em" aria-hidden="true"></svg>` +
        '<span class="baseline-probe" style="display:inline-block;width:0;height:0"></span>' +
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
        iconFontSizePx: parseFloat(faviconStyle.fontSize),
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
//
// `charsToMoveIntoLinkFromRight` pulls a trailing mark inside the link, so
// every mark in that set ends link text constantly and belongs here — a period
// and a comma most of all. Their ink sits below the icon's band in the
// proportional faces, so they cannot crowd it and the sweep skips them; in the
// monospace face they carry a wide bearing and are judged like any other glyph.
const MEMBERSHIP_CHARS: readonly string[] = [
  ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  ..."()[]{}\\/®™©°%&*+=<>|!?;:’”†‡",
  ...".,'\"",
]

// Ink must never reach the icon. `f` sets this in both proportional faces —
// italic `f` clears by 0.004em, a tenth of a pixel at body size — so the floor
// is the strongest statement that holds today, not a comfortable margin.
const OVERLAP_FLOOR_EM = 0

// A ratchet on how far each face's gaps spread, in em. The model computes one
// constant gap per glyph, so the ideal is 0 and what remains is the two glyphs
// per face whose correction hit a clamp plus the serif override. These must
// only ever be lowered.
const MAX_SPREAD_EM: Readonly<Record<FaceName, number>> = {
  serif: 0.07,
  italic: 0.06,
  smallCaps: 0.07,
  code: 0.01,
}

interface GapSample {
  key: string
  gapEm: number
}

/** Measured visual gaps per context, dropping probes that can't be judged. */
function gapsByContext(
  measurements: readonly Measurement[],
): ReadonlyMap<ContextName, GapSample[]> {
  const byContext = new Map<ContextName, GapSample[]>()
  for (const measured of measurements) {
    // No ink in band means the glyph cannot crowd; a substituted face and an
    // unsupported small-caps probe would both measure differently per OS.
    if (measured.gapPx === null || measured.fromFallbackFace || measured.fromUnsupportedSmallCaps) {
      continue
    }
    const context = measured.key.split("|")[0] as ContextName
    // The table carries no bearing for this glyph, so the transformer gave it
    // the flat fallback gap and it belongs to no face's distribution.
    if (bearingOf(context, measured.key.slice(context.length + 1)) === undefined) continue
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
  byContext: ReadonlyMap<ContextName, readonly GapSample[]>,
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
    const limit = thresholdFor(MAX_SPREAD_EM, context)
    if (spread > limit) {
      violations.push(
        `${context}: gaps spread ${spread.toFixed(3)}em > ${limit}em ` +
          `(tightest ${tightest.key}=${tightest.gapEm.toFixed(3)}, ` +
          `loosest ${loosest.key}=${loosest.gapEm.toFixed(3)}, target ${TARGET_GAP_EM})`,
      )
    }
  }
  return violations
}

// The size contexts to compare, and the glyphs to compare them with: a round
// reference, the widest and tightest serif overhangers, and a bracket and a
// digit, which sit differently in the band.
const SIZE_CONTEXTS: readonly ContextSpec[] = [
  { name: "serif", wrapperHtml: ["", ""], context: EMPTY_GLYPH_CONTEXT },
  { name: "h1", wrapperHtml: ["<h1>", "</h1>"], context: EMPTY_GLYPH_CONTEXT },
  {
    name: "subtitle",
    wrapperHtml: ['<div class="subtitle">', "</div>"],
    context: EMPTY_GLYPH_CONTEXT,
  },
  {
    name: "tableCell",
    wrapperHtml: ["<table><tr><td>", "</td></tr></table>"],
    context: EMPTY_GLYPH_CONTEXT,
  },
]
const SIZE_CHARS: readonly string[] = [..."oRxTfY(4"]

// Two contexts render the same glyph at different sizes, so em-denominated
// geometry must put the icon on the same slice of it. A tolerance this tight
// leaves no room for a size term to hide in.
const SIZE_TOLERANCE_EM = 0.005

/** Names every size context whose gap or band departs from the first one's. */
function collectSizeFailures(measurements: readonly Measurement[]): string[] {
  const gapEm = (m: Measurement) => (m.gapPx as number) / m.fontSizePx
  const byChar = new Map<string, Measurement[]>()
  for (const measured of measurements) {
    const char = measured.key.split("|")[1]
    byChar.set(char, [...(byChar.get(char) ?? []), measured])
  }

  return [...byChar].flatMap(([char, group]) => {
    const reference = group[0]
    return group.slice(1).flatMap((measured) => {
      // A glyph whose ink leaves the band in one context but not another is
      // itself a size-invariance failure, so a null gap is a mismatch.
      const lostInk = measured.gapPx === null || reference.gapPx === null
      if (lostInk) return [`${measured.key}: ink left the band (${reference.key} kept it)`]

      const gapOff = Math.abs(gapEm(measured) - gapEm(reference)) > SIZE_TOLERANCE_EM
      const bandOff = Math.abs(measured.bandTopEm - reference.bandTopEm) > SIZE_TOLERANCE_EM
      return [
        ...(gapOff
          ? [
              `${measured.key}: gap ${gapEm(measured).toFixed(3)}em != ` +
                `${gapEm(reference).toFixed(3)}em at ${reference.key} (char "${char}")`,
            ]
          : []),
        ...(bandOff
          ? [
              `${measured.key}: band top ${measured.bandTopEm.toFixed(3)}em != ` +
                `${reference.bandTopEm.toFixed(3)}em at ${reference.key}`,
            ]
          : []),
      ]
    })
  })
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
    const untabled = measurements
      .filter((m) => {
        const context = m.key.split("|")[0] as ContextName
        return bearingOf(context, m.key.slice(context.length + 1)) === undefined
      })
      .map((m) => m.key)
    console.info(`Probes skipped (no bearing in the table): ${untabled}`)
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

  // The payoff of em-denominating the box: one per-glyph nudge is correct at
  // every size because the icon covers the same slice of the glyph everywhere.
  // A heading, a subtitle and a table cell render the same face at different
  // sizes, so their gaps must agree to the em — not approximately, exactly.
  // This is the assertion a rem-denominated model cannot pass, and the reason
  // the `.subtitle` size override and the heading `vertical-align` override
  // could be deleted rather than merely retuned.
  test("the gap is the same fraction of the text at every size", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const measurements = await measureProbes(page, buildProbes(SIZE_CONTEXTS, SIZE_CHARS))

    const sizes = [...new Set(measurements.map((m) => m.fontSizePx))]
    expect(sizes.length, `contexts must span distinct sizes, saw ${sizes}`).toBeGreaterThan(2)

    const failures = collectSizeFailures(measurements)
    expect(failures, failures.join("\n")).toEqual([])
  })
})
