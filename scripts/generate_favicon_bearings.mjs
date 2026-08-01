import { chromium } from "@playwright/test"
/**
 * Regenerates quartz/plugins/transformers/faviconGlyphBearings.ts: the right
 * side bearing every link-ending glyph carries inside the favicon's vertical
 * band, per face, in em of that face.
 *
 * Measured in a browser against the built site rather than read out of the font
 * binaries, because the number that matters is the one the reader sees. The
 * browser resolves `--font-italic` to the "-parens" italic and applies the real
 * `smcp` forms in a small-caps run; a script pointed at font files has to
 * re-derive both by hand, and an earlier audit got the italic face wrong doing
 * exactly that.
 *
 * Usage (see .claude/dev-notes.md):
 *   pnpm build && npx serve public -l 8080
 *   node scripts/generate_favicon_bearings.mjs
 */
import { writeFileSync } from "node:fs"

const URL = "http://localhost:8080/test-page"
const OUT = "quartz/plugins/transformers/faviconGlyphBearings.ts"

// Every glyph that can end a link's text: the alphanumerics, the marks
// `charsToMoveIntoLinkFromRight` pulls inside a link, and the symbols that show
// up at the end of link text on the site.
const CHARS = [
  ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  ..."()[]{}\\/®™©°%&*+=<>|!?;:’”†‡",
  ...".,'\"-–—…′″→×^~_#$@`⁇",
]

const CONTEXTS = [
  { name: "serif", wrapper: ["", ""] },
  { name: "italic", wrapper: ["<em>", "</em>"] },
  { name: "smallCaps", wrapper: ['<abbr class="small-caps">', "</abbr>"] },
  { name: "code", wrapper: ["<code>", "</code>"] },
]

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(URL, { waitUntil: "domcontentloaded" })
await page.waitForTimeout(2000)

const table = await page.evaluate(
  async ({ contexts, chars }) => {
    const host = document.createElement("div")
    ;(document.querySelector("article") ?? document.body).appendChild(host)

    const canvas = document.createElement("canvas")
    const CANVAS_FONT_PX = 400
    const PEN_X = 400
    canvas.width = 1600
    canvas.height = 900
    const ctx2d = canvas.getContext("2d")
    if (!ctx2d) throw new Error("no canvas context")

    const applyFont = (style, family) => {
      ctx2d.font = `${style.fontStyle} ${CANVAS_FONT_PX}px ${family ?? style.fontFamily}`
      ctx2d.fontVariantCaps = style.fontVariantCaps === "small-caps" ? "small-caps" : "normal"
    }

    const bearingInBand = (style, char, topEm, bottomEm) => {
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
    const inkSignature = (style, char, family) => {
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

    // A glyph the requested family has no outline for is drawn by whatever the
    // platform substitutes, so its metrics describe a face the page never uses
    // and vary per OS and engine. A nonexistent family resolves through the
    // same fallback chain, so an identical fingerprint means the requested
    // family never contributed. Kept in step with the same predicate in
    // quartz/components/tests/faviconInkGap.spec.ts, which skips exactly the
    // glyphs this excludes.
    const isFallback = (style, char) =>
      inkSignature(style, char) === inkSignature(style, char, '"__no_such_family__"')

    await document.fonts.ready
    const out = {}
    for (const context of contexts) {
      const row = {}
      for (const char of chars) {
        host.innerHTML =
          `<p>${context.wrapper[0]}<span class="ink-probe">${char}</span>` +
          '<svg class="favicon" aria-hidden="true"></svg>' +
          '<span class="baseline-probe" style="display:inline-block;width:0;height:0"></span>' +
          `${context.wrapper[1]}</p>`
        const probeSpan = host.querySelector(".ink-probe")
        const favicon = host.querySelector("svg.favicon")
        const marker = host.querySelector(".baseline-probe")
        if (!probeSpan || !favicon || !marker) throw new Error(`fixture failed for ${char}`)
        const style = getComputedStyle(probeSpan)
        const fontSizePx = parseFloat(style.fontSize)
        const baselineY = marker.getBoundingClientRect().bottom
        const iconRect = favicon.getBoundingClientRect()
        const bearing = bearingInBand(
          style,
          char,
          (baselineY - iconRect.top) / fontSizePx,
          (baselineY - iconRect.bottom) / fontSizePx,
        )
        // A glyph with no ink in the band cannot crowd the icon, and a
        // substituted face describes a glyph the reader never sees. Both are
        // recorded as absent so the consumer falls back to no correction.
        if (bearing !== null && !isFallback(style, char)) row[char] = Number(bearing.toFixed(4))
      }
      out[context.name] = row
    }
    host.remove()
    return out
  },
  { contexts: CONTEXTS, chars: CHARS },
)

const banner =
  "// Generated by scripts/generate_favicon_bearings.mjs -- do not edit by hand.\n" +
  "// Right side bearing inside the favicon's vertical band, in em of each face.\n"
writeFileSync(
  OUT,
  `${banner}export const faviconGlyphBearings = ${JSON.stringify(table, null, 2)} as const\n`,
)
for (const [face, row] of Object.entries(table)) {
  const values = Object.values(row).sort((a, b) => a - b)
  console.info(
    `${face}: n=${values.length} min=${values[0]?.toFixed(3)} ` +
      `median=${values[Math.floor(values.length / 2)]?.toFixed(3)} ` +
      `max=${values[values.length - 1]?.toFixed(3)}`,
  )
}
await browser.close()
