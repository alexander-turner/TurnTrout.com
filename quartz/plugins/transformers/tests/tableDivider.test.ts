import type { Element, Root } from "hast"

import { describe, expect, it } from "@jest/globals"
import { h } from "hastscript"

import type { BuildCtx } from "../../../util/ctx"

import { QuartzConfig } from "../../../util/ctx"
import { TableDivider, isMarkerRow, addClass, processTableSection } from "../tableDivider"

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

function getTransformer(plugin: ReturnType<typeof TableDivider>) {
  if (!plugin.htmlPlugins) {
    throw new Error("Plugin htmlPlugins is undefined")
  }
  const htmlPlugins = plugin.htmlPlugins(mockBuildCtx)
  const transformerFactory = htmlPlugins[0] as () => (tree: Root) => void
  return transformerFactory()
}

function makeTable(bodyRows: Element[]): Element {
  return h("table", [
    h("thead", [h("tr", [h("th", "Model"), h("th", "Value")])]),
    h("tbody", bodyRows),
  ])
}

function getBody(table: Element): Element {
  return table.children.find(
    (c): c is Element => c.type === "element" && c.tagName === "tbody",
  ) as Element
}

function rowClassList(row: Element): string[] {
  const cls = row.properties?.className
  if (Array.isArray(cls)) return cls.map(String)
  if (typeof cls === "string") return cls.split(/\s+/).filter(Boolean)
  return []
}

describe("isMarkerRow", () => {
  it.each<[string, Element, boolean]>([
    ["row with === in every cell", h("tr", [h("td", "==="), h("td", "===")]), true],
    [
      "row with === and surrounding whitespace",
      h("tr", [h("td", " === "), h("td", "===\n")]),
      true,
    ],
    ["row with one non-marker cell", h("tr", [h("td", "==="), h("td", "data")]), false],
    ["row with empty cells", h("tr", [h("td", ""), h("td", "")]), false],
    ["row with === in <th> cells", h("tr", [h("th", "==="), h("th", "===")]), true],
    ["non-tr element", h("div", [h("td", "===")]), false],
    ["row with no cells", h("tr", []), false],
    [
      "row with marker spanning inline elements",
      h("tr", [h("td", [h("strong", "===")]), h("td", "===")]),
      true,
    ],
    [
      "row whose cells are not td/th (e.g. spans)",
      h("tr", [h("span", "==="), h("span", "===")]),
      false,
    ],
    ["row with == (only two equals)", h("tr", [h("td", "=="), h("td", "==")]), false],
    [
      "row with ==== (four equals) — only exactly === counts",
      h("tr", [h("td", "===="), h("td", "====")]),
      false,
    ],
  ])("returns %s correctly", (_desc, row, expected) => {
    expect(isMarkerRow(row)).toBe(expected)
  })
})

describe("addClass", () => {
  it("adds a class to an element with no existing properties", () => {
    const el = h("tr")
    addClass(el, "group-boundary")
    expect(rowClassList(el)).toEqual(["group-boundary"])
  })

  it("adds a class to an element whose properties is undefined", () => {
    const el = h("tr")
    ;(el as { properties: unknown }).properties = undefined
    addClass(el, "group-boundary")
    expect(rowClassList(el)).toEqual(["group-boundary"])
  })

  it("appends to an existing array className", () => {
    const el = h("tr", { className: ["existing"] })
    addClass(el, "group-boundary")
    expect(rowClassList(el)).toEqual(["existing", "group-boundary"])
  })

  it("appends to an existing string className", () => {
    const el = h("tr")
    el.properties = { className: "a b" }
    addClass(el, "group-boundary")
    expect(rowClassList(el)).toEqual(["a", "b", "group-boundary"])
  })

  it("is idempotent — does not duplicate an existing class", () => {
    const el = h("tr", { className: ["group-boundary"] })
    addClass(el, "group-boundary")
    expect(rowClassList(el)).toEqual(["group-boundary"])
  })
})

describe("processTableSection", () => {
  it("removes the marker row and tags the following row", () => {
    const section = h("tbody", [
      h("tr", [h("td", "a"), h("td", "1")]),
      h("tr", [h("td", "==="), h("td", "===")]),
      h("tr", [h("td", "b"), h("td", "2")]),
    ])
    processTableSection(section)
    expect(section.children).toHaveLength(2)
    const [first, second] = section.children as Element[]
    expect(rowClassList(first)).toEqual([])
    expect(rowClassList(second)).toEqual(["group-boundary"])
  })

  it("handles a marker row with no following row by dropping the marker silently", () => {
    const section = h("tbody", [h("tr", [h("td", "a")]), h("tr", [h("td", "===")])])
    processTableSection(section)
    expect(section.children).toHaveLength(1)
    expect((section.children[0] as Element).tagName).toBe("tr")
  })

  it("handles multiple markers", () => {
    const section = h("tbody", [
      h("tr", [h("td", "a")]),
      h("tr", [h("td", "===")]),
      h("tr", [h("td", "b")]),
      h("tr", [h("td", "===")]),
      h("tr", [h("td", "c")]),
    ])
    processTableSection(section)
    expect(section.children).toHaveLength(3)
    const [a, b, c] = section.children as Element[]
    expect(rowClassList(a)).toEqual([])
    expect(rowClassList(b)).toEqual(["group-boundary"])
    expect(rowClassList(c)).toEqual(["group-boundary"])
  })

  it("leaves a section without any marker rows unchanged", () => {
    const section = h("tbody", [h("tr", [h("td", "a")]), h("tr", [h("td", "b")])])
    processTableSection(section)
    expect(section.children).toHaveLength(2)
    for (const row of section.children as Element[]) {
      expect(rowClassList(row)).toEqual([])
    }
  })
})

describe("TableDivider transformer integration", () => {
  it("has correct name and htmlPlugins shape", () => {
    const plugin = TableDivider()
    expect(plugin.name).toBe("TableDivider")
    expect(plugin.htmlPlugins).toBeDefined()
  })

  it("transforms a table with a marker row in tbody", () => {
    const table = makeTable([
      h("tr", [h("td", "GLM-5"), h("td", "18.9")]),
      h("tr", [h("td", "GLM-5"), h("td", "1.2")]),
      h("tr", [h("td", "==="), h("td", "===")]),
      h("tr", [h("td", "GLM-5.1"), h("td", "8.9")]),
    ])
    const root: Root = { type: "root", children: [table] }
    getTransformer(TableDivider())(root)

    const body = getBody(root.children[0] as Element)
    expect(body.children).toHaveLength(3)
    expect(rowClassList(body.children[2] as Element)).toEqual(["group-boundary"])
  })

  it("does not modify tables without marker rows", () => {
    const table = makeTable([
      h("tr", [h("td", "a"), h("td", "1")]),
      h("tr", [h("td", "b"), h("td", "2")]),
    ])
    const root: Root = { type: "root", children: [table] }
    getTransformer(TableDivider())(root)

    const body = getBody(root.children[0] as Element)
    expect(body.children).toHaveLength(2)
    for (const row of body.children as Element[]) {
      expect(rowClassList(row)).toEqual([])
    }
  })

  it("ignores marker-like rows outside a table", () => {
    const root: Root = {
      type: "root",
      children: [h("div", [h("tr", [h("td", "==="), h("td", "===")])])],
    }
    getTransformer(TableDivider())(root)

    const wrapper = root.children[0] as Element
    expect(wrapper.children).toHaveLength(1)
  })

  it("handles tables with thead/tfoot sections", () => {
    const table = h("table", [
      h("thead", [h("tr", [h("th", "h1"), h("th", "h2")])]),
      h("tbody", [
        h("tr", [h("td", "a"), h("td", "1")]),
        h("tr", [h("td", "==="), h("td", "===")]),
        h("tr", [h("td", "b"), h("td", "2")]),
      ]),
      h("tfoot", [h("tr", [h("td", "total"), h("td", "3")])]),
    ])
    const root: Root = { type: "root", children: [table] }
    getTransformer(TableDivider())(root)

    const body = (table.children as Element[]).find((c) => c.tagName === "tbody") as Element
    expect(body.children).toHaveLength(2)
    expect(rowClassList(body.children[1] as Element)).toEqual(["group-boundary"])
  })

  it("ignores rows directly under <table> (non-section parents)", () => {
    const table = h("table", [
      h("tr", [h("td", "a"), h("td", "1")]),
      h("tr", [h("td", "==="), h("td", "===")]),
      h("tr", [h("td", "b"), h("td", "2")]),
    ])
    const root: Root = { type: "root", children: [table] }
    getTransformer(TableDivider())(root)

    expect(table.children).toHaveLength(3)
  })
})
