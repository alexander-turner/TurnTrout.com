import type { Element, Root } from "hast"

import { describe, expect, it } from "@jest/globals"
import { h } from "hastscript"

import type { BuildCtx } from "../../../util/ctx"

import { QuartzConfig } from "../../../util/ctx"
import { isMarkerRow, processTableBody, TableDivider } from "../tableDivider"

const mockBuildCtx: BuildCtx = {
  argv: {
    directory: ".",
    verbose: false,
    output: "public",
    serve: false,
    fastRebuild: false,
    port: 8080,
    wsPort: 3001,
  },
  cfg: {} as QuartzConfig,
  allSlugs: [],
}

function runTransformer(root: Root): void {
  const plugin = TableDivider()
  if (!plugin.htmlPlugins) throw new Error("Plugin htmlPlugins is undefined")
  ;(plugin.htmlPlugins(mockBuildCtx)[0] as () => (tree: Root) => void)()(root)
}

function classes(el: Element): string[] {
  const cls = el.properties?.className
  return Array.isArray(cls) ? cls.map(String) : []
}

const MARKER = h("td", "===")
const tr = (...cells: Element[]) => h("tr", cells)

describe("isMarkerRow", () => {
  it.each<[string, Element, boolean]>([
    ["all ===", tr(h("td", "==="), h("td", "===")), true],
    ["whitespace around ===", tr(h("td", " === "), h("td", "===\n")), true],
    ["inline element wraps ===", tr(h("td", [h("strong", "===")]), h("td", "===")), true],
    ["mixed content", tr(h("td", "==="), h("td", "data")), false],
    ["empty cells", tr(h("td", ""), h("td", "")), false],
    ["th cells", tr(h("th", "==="), h("th", "===")), false],
    ["no cells", h("tr", []), false],
    ["only two equals", tr(h("td", "=="), h("td", "==")), false],
    ["four equals", tr(h("td", "===="), h("td", "====")), false],
    ["non-tr element", h("div", [h("td", "===")]), false],
  ])("%s", (_d, row, expected) => expect(isMarkerRow(row)).toBe(expected))
})

describe("processTableBody", () => {
  // Each row of test data: [description, body rows, indices (after marker
  // removal) of the rows that should end up with the boundary class].
  it.each<[string, Element[], number[]]>([
    [
      "marker between rows tags the preceding row",
      [tr(h("td", "a")), tr(MARKER, MARKER), tr(h("td", "b"))],
      [0],
    ],
    [
      "trailing marker tags the last row (CSS will hide via :last-child)",
      [tr(h("td", "a")), tr(MARKER)],
      [0],
    ],
    ["leading marker is silently dropped", [tr(MARKER), tr(h("td", "a"))], []],
    [
      "multiple markers each tag the row that precedes them",
      [tr(h("td", "a")), tr(MARKER), tr(h("td", "b")), tr(MARKER), tr(h("td", "c"))],
      [0, 1],
    ],
    ["table without markers is untouched", [tr(h("td", "a")), tr(h("td", "b"))], []],
  ])("%s", (_d, rows, taggedIndices) => {
    const tbody = h("tbody", rows)
    processTableBody(tbody)
    const expectedRowCount = rows.length - rows.filter((r) => isMarkerRow(r)).length
    expect(tbody.children).toHaveLength(expectedRowCount)
    ;(tbody.children as Element[]).forEach((row, i) => {
      expect(classes(row)).toEqual(taggedIndices.includes(i) ? ["group-boundary"] : [])
    })
  })

  it("does not set prevRow for non-tr elements in tbody", () => {
    const orphan = h("td", "orphaned cell")
    const tbody = h("tbody", [orphan, tr(MARKER)])
    processTableBody(tbody)
    // The orphan td is kept but prevRow was never set, so no boundary class is added
    expect(tbody.children).toHaveLength(1)
    expect(classes(tbody.children[0] as Element)).toEqual([])
  })

  it("preserves existing classes on the tagged row", () => {
    const tbody = h("tbody", [
      h("tr", { className: ["existing"] }, [h("td", "a")]),
      tr(MARKER),
      tr(h("td", "b")),
    ])
    processTableBody(tbody)
    expect(classes(tbody.children[0] as Element)).toEqual(["existing", "group-boundary"])
  })
})

describe("TableDivider integration", () => {
  it("transforms a real <table>", () => {
    const table = h("table", [
      h("thead", [h("tr", [h("th", "Model"), h("th", "Value")])]),
      h("tbody", [
        tr(h("td", "GLM-5"), h("td", "18.9")),
        tr(MARKER, MARKER),
        tr(h("td", "GLM-5.1"), h("td", "8.9")),
      ]),
    ])
    runTransformer({ type: "root", children: [table] })
    const tbody = (table.children as Element[]).find((c) => c.tagName === "tbody") as Element
    expect(tbody.children).toHaveLength(2)
    expect(classes(tbody.children[0] as Element)).toEqual(["group-boundary"])
  })

  it.each<[string, Root]>([
    [
      "marker-like row outside any table",
      {
        type: "root",
        children: [h("p", "hi"), h("div", [tr(MARKER, MARKER)])],
      },
    ],
    [
      "rows directly under <table> (no tbody)",
      { type: "root", children: [h("table", [tr(h("td", "a")), tr(MARKER), tr(h("td", "b"))])] },
    ],
  ])("ignores %s", (_d, root) => {
    const before = JSON.stringify(root)
    runTransformer(root)
    expect(JSON.stringify(root)).toBe(before)
  })
})
