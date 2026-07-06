/**
 * Measure ink-to-ink clearance for every favicon bigram, plus per-icon ink
 * insets. Run from the repo root with a static server on public/ (see
 * README.md).
 *
 * Per bigram cell (text painted red, favicon blue):
 *  - hgapCss: horizontal gap between the rightmost text ink column and the
 *    leftmost icon ink column (CSS px; negative = horizontal overlap)
 *  - min2dCss: minimum Euclidean distance between text ink and icon ink
 * Per icon: left/right/top/bottom ink insets within its box.
 */
import { chromium } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import process from "node:process"
import sharp from "sharp"

const BASE = process.env.HARNESS_URL ?? "http://localhost:8917/bigram-harness/"
const OUT = "/tmp/favicon_kerning_audit"
const SCALE = 4

/** Scan raw RGBA for red (text) and blue (icon) ink. */
function scanInk(data, info) {
  const { width: W, height: H, channels: C } = info
  const textMaxX = new Array(H).fill(-1)
  const iconMinX = new Array(H).fill(-1)
  const icon = { minX: Infinity, maxX: -1, minY: Infinity, maxY: -1, count: 0 }
  let textRight = -1
  let textCount = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C
      const r = data[i]
      const b = data[i + 2]
      if (r - b > 60 && r > 100) {
        textCount++
        if (x > textMaxX[y]) textMaxX[y] = x
        if (x > textRight) textRight = x
      } else if (b - r > 60 && b > 100) {
        icon.count++
        if (iconMinX[y] === -1 || x < iconMinX[y]) iconMinX[y] = x
        if (x < icon.minX) icon.minX = x
        if (x > icon.maxX) icon.maxX = x
        if (y < icon.minY) icon.minY = y
        if (y > icon.maxY) icon.maxY = y
      }
    }
  }
  return { textMaxX, iconMinX, textRight, textCount, icon, W, H }
}

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1400, height: 1000 },
  deviceScaleFactor: SCALE,
})

// --- bigram cells ---
mkdirSync(`${OUT}/cells`, { recursive: true })
await page.goto(BASE, { waitUntil: "networkidle" })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(300)

const cells = await page.$$(".bigram-cell")
console.log(`${cells.length} cells`)

const results = []
for (const cell of cells) {
  const meta = await cell.evaluate((el) => ({
    id: el.id,
    char: el.dataset.char,
    domain: el.dataset.domain,
    close: el.dataset.close === "1",
  }))
  const buf = await cell.screenshot()
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true })
  const { textMaxX, iconMinX, textRight, textCount, icon, H } = scanInk(data, info)

  let min2d = Infinity
  for (let ty = 0; ty < H; ty++) {
    if (textMaxX[ty] < 0) continue
    for (let iy = 0; iy < H; iy++) {
      if (iconMinX[iy] < 0) continue
      const dx = iconMinX[iy] - textMaxX[ty]
      const dy = iy - ty
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < min2d) min2d = d
    }
  }

  const measurable = textCount > 0 && icon.count > 0
  results.push({
    ...meta,
    hgapCss: measurable ? (icon.minX - textRight - 1) / SCALE : null,
    min2dCss: measurable ? min2d / SCALE : null,
  })
  writeFileSync(`${OUT}/cells/${meta.id}.png`, buf)
}
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1))
console.log(`wrote ${results.length} results`)

// --- per-icon insets ---
await page.goto(`${BASE}icons.html`, { waitUntil: "networkidle" })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(300)

const insets = {}
for (const probe of await page.$$(".icon-probe")) {
  const domain = await probe.getAttribute("data-domain")
  const box = await probe.boundingBox()
  const buf = await probe.screenshot()
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true })
  const { icon, W, H } = scanInk(data, info)
  insets[domain] =
    icon.count === 0
      ? null
      : {
          boxCssW: box.width,
          leftInset: icon.minX / SCALE,
          rightInset: (W - 1 - icon.maxX) / SCALE,
          topInset: icon.minY / SCALE,
          bottomInset: (H - 1 - icon.maxY) / SCALE,
        }
}
writeFileSync(`${OUT}/icon_insets.json`, JSON.stringify(insets, null, 1))
console.log(`wrote insets for ${Object.keys(insets).length} icons`)
await browser.close()
