/**
 * Minimal long-format CSV parser for chart data sidecars.
 *
 * Expected shape: header line `x,y,series`, then rows of `<number>,<number>,<name>`.
 * Anything fancier (quoted fields with commas, multi-line strings) would be
 * over-engineering for this use case — chart CSVs are machine-produced.
 */

export type CsvSeriesMap = Map<string, [number, number][]>

export function parseLongCsv(text: string): CsvSeriesMap {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) {
    throw new Error("CSV is empty")
  }
  // Reject RFC 4180 quoted fields rather than implement a full parser. Fine
  // for our shape (machine-produced CSVs, no embedded commas in names); a
  // loud error beats silently truncating fields at an unexpected comma.
  if (text.includes('"')) {
    throw new Error('quoted CSV fields are not supported — rename series to avoid `,` `"` `\\n`')
  }
  const header = lines[0]
    .trim()
    .split(",")
    .map((s) => s.trim())
  if (header.length !== 3 || header[0] !== "x" || header[1] !== "y" || header[2] !== "series") {
    throw new Error(`CSV header must be "x,y,series"; got "${lines[0]}"`)
  }

  const result: CsvSeriesMap = new Map()
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",")
    if (parts.length !== 3) {
      throw new Error(`CSV row ${i}: expected 3 columns, got ${parts.length}`)
    }
    const x = Number(parts[0])
    const y = Number(parts[1])
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`CSV row ${i}: x and y must be finite numbers`)
    }
    const seriesName = parts[2].trim()
    const existing = result.get(seriesName)
    if (existing) {
      existing.push([x, y])
    } else {
      result.set(seriesName, [[x, y]])
    }
  }
  return result
}
