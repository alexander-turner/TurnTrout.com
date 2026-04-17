/**
 * Regenerates config/font_stats.md — a markdown table comparing full (source)
 * woff2 sizes against the per-variant subsets produced by `subfont`.
 *
 * Must run after a build so public/subfont/ exists. Pre-subset source fonts
 * (e.g. DejaVuSerifCondensed-Bold-subset.woff2, EBGaramond08-Regular-original.woff2)
 * are intentionally excluded: their "full" baselines are misleading.
 *
 * Usage: npx tsx scripts/gen_font_stats.ts
 */
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

interface FontEntry {
  /** Human-readable name used in the output table. */
  display: string
  /** CSS font-family name (matches subfont output filename prefix). */
  family: string
  /** Source woff2 path under quartz/static/styles/fonts/. */
  source: string
}

// Derived from quartz/styles/fonts.scss. Excludes fonts whose repo source is
// already a hand-subset (would compare unfairly against subfont output):
//  - DejaVuSerifCondensed-Bold (literal "-subset" in filename)
//  - EBGaramondOriginal        (curated ~3KB custom subset)
const FONTS: readonly FontEntry[] = [
  {
    display: "EB Garamond",
    family: "EBGaramond",
    source: "EBGaramond/EBGaramond08-Regular.woff2",
  },
  {
    display: "EB Garamond 12pt",
    family: "EBGaramond12",
    source: "EBGaramond/EBGaramond12-Regular.woff2",
  },
  {
    display: "EB Garamond Italic",
    family: "EBGaramondItalic",
    source: "EBGaramond/EBGaramond08-Italic-parens.woff2",
  },
  {
    display: "EB Garamond 12pt Italic",
    family: "EBGaramond12Italic",
    source: "EBGaramond/EBGaramond12-Italic-parens.woff2",
  },
  {
    display: "EB Garamond Old Italic",
    family: "EBGaramondItalicOld",
    source: "EBGaramond/EBGaramond08-Italic.woff2",
  },
  {
    display: "EB Garamond 12pt Old Italic",
    family: "EBGaramond12ItalicOld",
    source: "EBGaramond/EBGaramond12-Italic.woff2",
  },
  {
    display: "EB Garamond Initials F1",
    family: "EBGaramondInitialsF1",
    source: "EBGaramond/EBGaramond-InitialsF1.woff2",
  },
  {
    display: "EB Garamond Initials F2",
    family: "EBGaramondInitialsF2",
    source: "EBGaramond/EBGaramond-InitialsF2.woff2",
  },
  {
    display: "Fira Code",
    family: "FiraCode",
    source: "firacode-vf.woff2",
  },
  {
    display: "Bad Handwriting",
    family: "BadHandwriting",
    source: "badhandwriting-webfont.woff2",
  },
  {
    display: "Scary",
    family: "Scary",
    source: "DarkmodeRegular.woff2",
  },
  {
    display: "Elvish",
    family: "Elvish",
    source: "tengwar_artano/TengwarArtano.woff2",
  },
] as const

const ROOT = process.cwd()
const SOURCE_DIR = join(ROOT, "quartz/static/styles/fonts")
const SUBFONT_DIR = join(ROOT, "public/subfont")
const OUTPUT = join(ROOT, "config/font_stats.md")

function formatKB(bytes: number): string {
  // Non-breaking space keeps the unit on the same line as the number;
  // tagSmallcaps' REGEX_ABBREVIATION permits `\u00A0?` between them so the
  // "KB" still renders as smallcaps.
  return `${(bytes / 1024).toFixed(1)}&nbsp;KB`
}

function savingsPct(full: number, subset: number): number {
  return Math.round((1 - subset / full) * 100)
}

// Match subfont output for a given CSS family. Subfont emits files like
// `<family>-<weight><style>-<hash>.woff2`; the dash-followed-by-non-letter
// prevents `EBGaramond-` from matching `EBGaramondItalic-…` etc.
function findSubsetSize(family: string, dir: string = SUBFONT_DIR): number | null {
  if (!existsSync(dir)) return null
  const anchor = new RegExp(`^${family}-[^A-Za-z]`)
  const files = readdirSync(dir).filter((f) => anchor.test(f) && f.endsWith(".woff2"))
  if (files.length === 0) return null
  return files.reduce((acc, f) => acc + statSync(join(dir, f)).size, 0)
}

interface FontRow {
  display: string
  full: number
  subset: number | null
}

function collectRows(
  entries: readonly FontEntry[] = FONTS,
  sourceDir: string = SOURCE_DIR,
  subfontDir: string = SUBFONT_DIR,
): FontRow[] {
  const rows: FontRow[] = []
  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.source)
    if (!existsSync(sourcePath)) {
      throw new Error(`Source font missing: ${sourcePath}`)
    }
    rows.push({
      display: entry.display,
      full: statSync(sourcePath).size,
      subset: findSubsetSize(entry.family, subfontDir),
    })
  }
  return rows
}

function renderTable(rows: readonly FontRow[]): string {
  // lint-staged hands the file directly to markdownlint, which disregards
  // the ignores config, so suppress MD041 (first-line H1) inline. The
  // comment is a valid HTML comment and is stripped before user-facing HTML.
  const header = [
    "<!-- markdownlint-disable MD041 -->",
    "| Font | Full | Subset | Saved |",
    "| :--- | ---: | ---: | ---: |",
  ].join("\n")
  const body: string[] = []
  let totalFull = 0
  let totalSubset = 0
  let subsetsMissing = false

  for (const row of rows) {
    totalFull += row.full
    const subsetCell = row.subset === null ? "—" : formatKB(row.subset)
    const savedCell = row.subset === null ? "—" : `${savingsPct(row.full, row.subset)}%`
    if (row.subset === null) {
      subsetsMissing = true
    } else {
      totalSubset += row.subset
    }
    body.push(`| ${row.display} | ${formatKB(row.full)} | ${subsetCell} | ${savedCell} |`)
  }

  // Saved % is only meaningful when every row has a subset; otherwise the
  // ratio would mix full sizes of missing rows against a smaller subset sum.
  const totalSubsetCell = subsetsMissing ? "**—**" : `**${formatKB(totalSubset)}**`
  const totalSavedCell = subsetsMissing ? "**—**" : `**${savingsPct(totalFull, totalSubset)}%**`
  body.push(`| **Total** | **${formatKB(totalFull)}** | ${totalSubsetCell} | ${totalSavedCell} |`)

  return `${[header, ...body].join("\n")}\n`
}

function generate(
  entries: readonly FontEntry[] = FONTS,
  sourceDir: string = SOURCE_DIR,
  subfontDir: string = SUBFONT_DIR,
): string {
  return renderTable(collectRows(entries, sourceDir, subfontDir))
}

// istanbul ignore next - CLI entrypoint
function main(): void {
  const table = generate()
  writeFileSync(OUTPUT, table, "utf-8")

  console.log(`Wrote ${resolve(OUTPUT)}`)
}

// istanbul ignore next - CLI entrypoint
if (process.argv[1]?.endsWith("gen_font_stats.ts")) {
  main()
}

export { FONTS, collectRows, findSubsetSize, formatKB, generate, renderTable, savingsPct }
export type { FontEntry, FontRow }
