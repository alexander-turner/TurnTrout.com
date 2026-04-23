import { afterEach, describe, expect, it } from "@jest/globals"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { NBSP } from "../../quartz/components/constants"
import {
  FONTS,
  collectRows,
  findSubsetSize,
  formatKB,
  generate,
  renderTable,
  savingsPct,
  type FontEntry,
} from "../gen_font_stats"

const KB = `${NBSP}KB`

const tmpRoots: string[] = []

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "gen-font-stats-"))
  tmpRoots.push(dir)
  return dir
}

afterEach(() => {
  while (tmpRoots.length > 0) {
    const dir = tmpRoots.pop()
    if (dir) rmSync(dir, { force: true, recursive: true })
  }
})

describe("formatKB", () => {
  it.each([
    [0, `0.0${KB}`],
    [1024, `1.0${KB}`],
    [1536, `1.5${KB}`],
    [104044, `101.6${KB}`],
  ])("renders %i bytes as %s", (bytes, expected) => {
    expect(formatKB(bytes)).toBe(expected)
  })
})

describe("savingsPct", () => {
  it.each([
    [100, 50, 50],
    [100, 25, 75],
    [100, 100, 0],
    [104044, 44204, 58],
  ])("savingsPct(%i, %i) = %i", (full, subset, expected) => {
    expect(savingsPct(full, subset)).toBe(expected)
  })
})

describe("findSubsetSize", () => {
  it("returns null when the subfont dir is missing", () => {
    const dir = makeTempDir()
    expect(findSubsetSize("EBGaramond", join(dir, "nope"))).toBeNull()
  })

  it("returns null when no files match the family anchor", () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, "Unrelated-400-a.woff2"), "x")
    expect(findSubsetSize("EBGaramond", dir)).toBeNull()
  })

  it("sums every matching woff2", () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, "EBGaramond-400-aaa.woff2"), Buffer.alloc(100))
    writeFileSync(join(dir, "EBGaramond-700-bbb.woff2"), Buffer.alloc(250))
    expect(findSubsetSize("EBGaramond", dir)).toBe(350)
  })

  it("anchors so related families don't leak into the sum", () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, "EBGaramond-400-a.woff2"), Buffer.alloc(100))
    writeFileSync(join(dir, "EBGaramondItalic-400i-b.woff2"), Buffer.alloc(999))
    writeFileSync(join(dir, "EBGaramond12-400-c.woff2"), Buffer.alloc(999))
    expect(findSubsetSize("EBGaramond", dir)).toBe(100)
  })

  it("ignores non-woff2 files even when the prefix matches", () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, "EBGaramond-400-a.woff"), Buffer.alloc(500))
    writeFileSync(join(dir, "EBGaramond-400-a.ttf"), Buffer.alloc(500))
    expect(findSubsetSize("EBGaramond", dir)).toBeNull()
  })
})

describe("collectRows", () => {
  function seedSource(root: string, entries: readonly FontEntry[]): void {
    for (const entry of entries) {
      const full = join(root, entry.source)
      mkdirSync(join(full, ".."), { recursive: true })
      writeFileSync(full, Buffer.alloc(1024))
    }
  }

  it("throws when a source font is missing", () => {
    const sources = makeTempDir()
    expect(() => collectRows([FONTS[0]], sources, makeTempDir())).toThrow(/Source font missing/)
  })

  it("reads full sizes and leaves subset as null when subfont dir is absent", () => {
    const sources = makeTempDir()
    seedSource(sources, FONTS.slice(0, 2))
    const rows = collectRows(FONTS.slice(0, 2), sources, join(sources, "nope"))
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.full === 1024 && r.subset === null)).toBe(true)
  })

  it("pairs each source with matching subsets", () => {
    const sources = makeTempDir()
    const subfont = makeTempDir()
    seedSource(sources, FONTS.slice(0, 2))
    writeFileSync(join(subfont, `${FONTS[0].family}-400-a.woff2`), Buffer.alloc(256))
    const rows = collectRows(FONTS.slice(0, 2), sources, subfont)
    expect(rows[0].subset).toBe(256)
    expect(rows[1].subset).toBeNull()
  })
})

describe("renderTable", () => {
  it("renders an all-missing-subset table with em-dashes and a '—' total", () => {
    const md = renderTable([
      { display: "Foo", full: 2048, subset: null },
      { display: "Bar", full: 1024, subset: null },
    ])
    expect(md).toContain("| Font | Full | Subset | Saved |")
    expect(md).toContain(`| Foo | 2.0${KB} | — | — |`)
    expect(md).toContain(`| **Total** | **3.0${KB}** | **—** | **—** |`)
  })

  it("leaves Total Subset/Saved as '—' when any row is missing a subset", () => {
    const md = renderTable([
      { display: "Foo", full: 2048, subset: 512 },
      { display: "Bar", full: 1024, subset: null },
    ])
    expect(md).toContain(`| Foo | 2.0${KB} | 0.5${KB} | 75% |`)
    expect(md).toContain(`| Bar | 1.0${KB} | — | — |`)
    // Mixing missing subsets into the ratio would lie, so totals stay blank.
    expect(md).toContain(`| **Total** | **3.0${KB}** | **—** | **—** |`)
    expect(md.endsWith("\n")).toBe(true)
  })

  it("computes a full Total row when every subset is present", () => {
    const md = renderTable([
      { display: "Foo", full: 2048, subset: 512 },
      { display: "Bar", full: 1024, subset: 256 },
    ])
    expect(md).toContain(`| **Total** | **3.0${KB}** | **0.8${KB}** | **75%** |`)
  })
})

describe("FONTS", () => {
  it("excludes pre-subset sources", () => {
    const sources = FONTS.map((f) => f.source)
    expect(sources).not.toContain("DejaVuSerifCondensed-Bold-subset.woff2")
    expect(sources).not.toContain("EBGaramond/EBGaramond08-Regular-original.woff2")
  })

  it("has unique family names so subfont matching never double-counts", () => {
    const families = FONTS.map((f) => f.family)
    expect(new Set(families).size).toBe(families.length)
  })
})

describe("generate", () => {
  it("wires collectRows → renderTable when given explicit directories", () => {
    const sources = makeTempDir()
    const subfont = makeTempDir()
    const entries = FONTS.slice(0, 1)
    // Seed source
    const full = join(sources, entries[0].source)
    mkdirSync(join(full, ".."), { recursive: true })
    writeFileSync(full, Buffer.alloc(2048))
    writeFileSync(join(subfont, `${entries[0].family}-400-a.woff2`), Buffer.alloc(1024))

    const out = generate(entries, sources, subfont)
    expect(out).toContain(`| ${entries[0].display} | 2.0${KB} | 1.0${KB} | 50% |`)
    expect(out).toContain(`| **Total** | **2.0${KB}** | **1.0${KB}** | **50%** |`)
  })

  it("falls back to defaults (reads real fonts; no subfont dir expected)", () => {
    // Exercises the default-parameter branches without asserting specific
    // byte counts, since the fonts under version control may change.
    const out = generate()
    expect(out.startsWith("<!-- markdownlint-disable MD041 -->\n")).toBe(true)
    expect(out).toContain("| Font | Full | Subset | Saved |")
    expect(out).toContain("| **Total**")
  })
})

describe("default-parameter branches", () => {
  it("findSubsetSize defaults to the repo's public/subfont dir", () => {
    // No subfont built locally, so the default dir is absent → null.
    expect(findSubsetSize("EBGaramond")).toBeNull()
  })

  it("collectRows defaults exercise FONTS / SOURCE_DIR / SUBFONT_DIR", () => {
    const rows = collectRows()
    expect(rows).toHaveLength(FONTS.length)
    expect(rows.every((r) => r.full > 0)).toBe(true)
  })
})
