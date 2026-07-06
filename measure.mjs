/**
 * Measure ink-to-ink clearance for every favicon bigram.
 *
 * Loads the harness page (text painted red, favicons blue), screenshots each
 * cell at 4x, and computes:
 *  - hgap: horizontal gap between the rightmost text ink column and the
 *    leftmost icon ink column (CSS px; negative = horizontal overlap)
 *  - min2d: minimum Euclidean distance between text ink and icon ink (CSS px)
 * Writes results.json plus per-cell PNGs.
 */
import { chromium } from "@playwright/test"
import sharp from "sharp"
import { mkdirSync, writeFileSync } from "node:fs"

const BASE = process.env.HARNESS_URL ?? "http://localhost:8917/bigram-harness/"
const OUT = "/tmp/favicon_bigrams/report"
const SCALE = 4

mkdirSync(`${OUT}/cells`, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1400, height: 1000 },
  deviceScaleFactor: SCALE,
})
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
  const { width: W, height: H, channels: C } = info

  // Per-row ink boundaries.
  const textMaxX = new Array(H).fill(-1)
  const iconMinX = new Array(H).fill(-1)
  let textRight = -1
  let iconLeft = Infinity
  let textPx = 0
  let iconPx = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C
      const r = data[i]
      const b = data[i + 2]
      if (r - b > 60 && r > 100) {
        textPx++
        if (x > textMaxX[y]) textMaxX[y] = x
        if (x > textRight) textRight = x
      } else if (b - r > 60 && b > 100) {
        iconPx++
        if (iconMinX[y] === -1 || x < iconMinX[y]) iconMinX[y] = x
        if (x < iconLeft) iconLeft = x
      }
    }
  }

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

  const result = {
    ...meta,
    textPx,
    iconPx,
    hgapCss: textPx && iconPx ? (iconLeft - textRight - 1) / SCALE : null,
    min2dCss: textPx && iconPx ? min2d / SCALE : null,
  }
  results.push(result)
  writeFileSync(`${OUT}/cells/${meta.id}.png`, buf)
}

writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1))
console.log(`wrote ${results.length} results`)
await browser.close()
