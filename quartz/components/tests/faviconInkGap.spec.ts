import type { Page } from "@playwright/test"

import {
  charsToSpace,
  charsToSpaceItalic,
  charsToSpaceMost,
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

// margin-left = 0.125·base + nudge − inset·size, with a domainless icon
// (inset 0). $base-margin is rem-denominated, so the absolute pixel value
// varies with the viewport's root font size; the invariant is the RATIO to
// the classless serif margin (the "unit"): close-text doubles it,
// closer-text triples it, and inside code a uniform −0.125·base nudge
// cancels it to zero.
const MARGIN_UNIT_MULTIPLIER: Readonly<Record<string, number>> = {
  null: 1,
  "close-text": 2,
  "closer-text": 3,
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
}

interface Probe {
  key: string
  contextName: ContextSpec["name"]
  char: string
  wrapperHtml: [string, string]
  nudgeClass: ReturnType<typeof nudgeClassFor>
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
    const expectedMargin =
      probe.contextName === "code"
        ? 0
        : MARGIN_UNIT_MULTIPLIER[probe.nudgeClass ?? "null"] * unit.marginPx
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
 */
async function measureProbes(page: Page, probes: readonly Probe[]): Promise<Measurement[]> {
  return await page.evaluate(async (probeList) => {
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
    // Small-cap forms reuse the capital outlines, and canvas-level
    // font-variant support differs per engine, so a small-caps probe
    // measures the capital glyph directly.
    const bearingInBand = (style: CSSStyleDeclaration, char: string): number | null => {
      const glyph = style.fontVariantCaps === "small-caps" ? char.toUpperCase() : char
      const baseline = 700
      ctx2d.clearRect(0, 0, canvas.width, canvas.height)
      ctx2d.font = `${style.fontStyle} ${CANVAS_FONT_PX}px ${style.fontFamily}`
      ctx2d.textBaseline = "alphabetic"
      ctx2d.fillText(glyph, 400, baseline)
      const advance = ctx2d.measureText(glyph).width
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

    // True when the requested family has no outline for `char`, so the
    // canvas drew whichever face the platform substitutes. Such a glyph
    // measures differently per OS. Detected by advance width: a substituted
    // glyph matches what a nonexistent family produces, since both resolve
    // through the same fallback chain.
    const isFallbackGlyph = (style: CSSStyleDeclaration, char: string): boolean => {
      const glyph = style.fontVariantCaps === "small-caps" ? char.toUpperCase() : char
      ctx2d.font = `${style.fontStyle} ${CANVAS_FONT_PX}px ${style.fontFamily}`
      const requested = ctx2d.measureText(glyph).width
      ctx2d.font = `${style.fontStyle} ${CANVAS_FONT_PX}px "__no_such_family__"`
      const substituted = ctx2d.measureText(glyph).width
      return Math.abs(requested - substituted) < 0.01
    }

    await document.fonts.ready
    const results: {
      key: string
      marginPx: number
      fontSizePx: number
      gapPx: number | null
      fromFallbackFace: boolean
    }[] = []
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
        fontSizePx,
        gapPx: bearingEm === null ? null : marginPx + bearingEm * fontSizePx,
        fromFallbackFace: isFallbackGlyph(probeStyle, probe.char),
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

// Thresholds in em of the probe's font, slackened from the bars that produced
// the sets so that no glyph sits near a bar: the closest non-qualifying glyph
// clears its threshold by more than 0.01em, well beyond what antialiasing
// differences between rasterizers can shift a detected ink edge. Serif
// measures shortfall against a round letter's clearance (the kerning audit's
// unit); italic measures the bearing itself, since its glyphs lean past their
// advance edge.
const SERIF_CLOSE_SHORTFALL_EM = 0.05
const SERIF_MOST_SHORTFALL_EM = 0.12
const ITALIC_CLOSE_BEARING_EM = -0.04
const ITALIC_MOST_BEARING_EM = -0.11

/**
 * Names every glyph whose measured ink qualifies it for a nudge class it
 * doesn't have. One-directional on purpose: the sets may hold extra
 * perceptual members (serif "R", "r") whose crowding lives outside the
 * measured band, and glyphs like italic "~" that overhang past what any nudge
 * corrects. Glyphs with no ink in the band are skipped — they cannot crowd.
 */
function collectMembershipViolations(
  bearings: ReadonlyMap<string, number>,
  serifRef: number,
): string[] {
  const violations: string[] = []
  const flag = (face: string, char: string, amount: number, needs: string) =>
    violations.push(`${face} ${char}: ${amount.toFixed(3)}em needs ${needs}`)

  for (const char of MEMBERSHIP_CHARS) {
    // A glyph with no ink in band scores as maximally clear, so it never flags.
    const serifBearing = bearings.get(`serif|${char}`) ?? serifRef
    const shortfall = serifRef - serifBearing
    const hasSerifNudge = charsToSpace.includes(char) || charsToSpaceMost.includes(char)
    if (shortfall > SERIF_MOST_SHORTFALL_EM && !charsToSpaceMost.includes(char)) {
      flag("serif", char, shortfall, "closer-text")
    } else if (shortfall > SERIF_CLOSE_SHORTFALL_EM && !hasSerifNudge) {
      flag("serif", char, shortfall, "close-text")
    }

    const italicBearing = bearings.get(`italic|${char}`) ?? 0
    const hasItalicNudge =
      charsToSpaceItalic.includes(char) || charsToSpaceMostItalic.includes(char)
    if (italicBearing <= ITALIC_MOST_BEARING_EM && !charsToSpaceMostItalic.includes(char)) {
      flag("italic", char, italicBearing, "closer-text")
    } else if (italicBearing <= ITALIC_CLOSE_BEARING_EM && !hasItalicNudge) {
      flag("italic", char, italicBearing, "close-text")
    }
  }
  return violations
}

/**
 * Right side bearings in em, keyed by probe. Probes with no ink in the band
 * and probes the face rendered from a platform substitute are omitted: the
 * former cannot crowd, the latter would measure differently per OS.
 */
function bearingsByKey(measurements: readonly Measurement[]): ReadonlyMap<string, number> {
  const bearings = new Map<string, number>()
  for (const measured of measurements) {
    if (measured.gapPx !== null && !measured.fromFallbackFace) {
      bearings.set(measured.key, (measured.gapPx - measured.marginPx) / measured.fontSizePx)
    }
  }
  return bearings
}

test.describe("favicon ink gap", () => {
  test("margins resolve exactly and ink gaps stay inside the band", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const probes = buildProbes(CONTEXTS, PROBE_CHARS)
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

  // Membership ratchet: measure every plausible link-ending glyph in the
  // shipped faces and demand a nudge class wherever the ink qualifies for
  // one. This keeps the sets honest against future font updates, which shift
  // bearings without touching any code the other tests cover.
  test("glyphs that measure as crowding carry a nudge class", async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/test-page")

    const contexts = CONTEXTS.filter((ctx) => ctx.name === "serif" || ctx.name === "italic")
    const measurements = await measureProbes(page, buildProbes(contexts, MEMBERSHIP_CHARS))
    const bearings = bearingsByKey(measurements)

    const substituted = measurements.filter((m) => m.fromFallbackFace).map((m) => m.key)
    console.info(`Glyphs judged: ${bearings.size}; rendered by a substitute face: ${substituted}`)

    const serifRef = bearings.get("serif|o")
    expect(serifRef, "round-letter reference probe has no ink in band").toBeDefined()

    const violations = collectMembershipViolations(bearings, serifRef ?? 0)
    expect(violations, violations.join("\n")).toEqual([])
  })
})
