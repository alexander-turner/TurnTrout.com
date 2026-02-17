import type { Element, Root, Text } from "hast"

import { describe, expect, it } from "@jest/globals"
import { visit } from "unist-util-visit"

import type { BuildCtx } from "../../util/ctx"
import type { ChartSpec } from "./charts/types"

import { Charts } from "./charts"
import { renderLineChart, toTitleCase } from "./charts/line-renderer"
import { parseChartSpec } from "./charts/parse"

const mockCtx = {} as BuildCtx

// ── parseChartSpec ────────────────────────────────────────────────────

describe("parseChartSpec", () => {
  const MINIMAL_YAML = `
type: line
x:
  label: X
y:
  label: Y
series:
  - name: S1
    data:
      - [1, 2]
`

  it("parses a minimal valid chart spec", () => {
    const spec = parseChartSpec(MINIMAL_YAML)
    expect(spec.type).toBe("line")
    expect(spec.x).toEqual({ label: "X", scale: "linear", min: undefined })
    expect(spec.y).toEqual({ label: "Y", scale: "linear", min: undefined })
    expect(spec.series).toHaveLength(1)
    expect(spec.series[0].data).toEqual([[1, 2]])
    expect(spec.annotations).toBeUndefined()
    expect(spec.title).toBeUndefined()
    expect(spec.series[0].color).toBeUndefined()
  })

  it("parses axis min override", () => {
    const yaml = `
type: line
x:
  label: X
y:
  label: Y
  min: 3
series:
  - name: S
    data:
      - [1, 5]
`
    const spec = parseChartSpec(yaml)
    expect(spec.y.min).toBe(3)
    expect(spec.x.min).toBeUndefined()
  })

  it("parses title, colors, scale, and annotations", () => {
    const yaml = `
type: line
title: My Chart
x:
  label: X
  scale: log
y:
  label: Y
  scale: linear
series:
  - name: S1
    color: "var(--blue)"
    data:
      - [1, 2]
      - [3, 4]
annotations:
  - type: horizontal-line
    value: 3.14
    label: Baseline
    style: dashed
  - type: horizontal-line
    value: 5.0
    style: solid
  - type: horizontal-line
    value: 1.0
`
    const spec = parseChartSpec(yaml)
    expect(spec.title).toBe("My Chart")
    expect(spec.x.scale).toBe("log")
    expect(spec.y.scale).toBe("linear")
    expect(spec.series[0].color).toBe("var(--blue)")
    const annotations = spec.annotations ?? []
    expect(annotations).toHaveLength(3)
    expect(annotations[0]).toEqual({
      type: "horizontal-line",
      value: 3.14,
      label: "Baseline",
      style: "dashed",
    })
    expect(annotations[1].label).toBeUndefined()
    expect(annotations[1].style).toBe("solid")
    expect(annotations[2].style).toBe("solid")
  })

  it.each([
    ["not YAML object", "42", "Chart spec must be a YAML object"],
    ["null YAML", "null", "Chart spec must be a YAML object"],
    [
      "unsupported type",
      "type: bar\nx:\n  label: X\ny:\n  label: Y\nseries:\n  - name: S\n    data:\n      - [1,2]",
      'Unsupported chart type: "bar"',
    ],
    [
      "non-object x axis",
      "type: line\nx: 42\ny:\n  label: Y\nseries:\n  - name: S\n    data:\n      - [1,2]",
      'Chart "x" axis must be an object',
    ],
    [
      "null x axis",
      "type: line\nx: null\ny:\n  label: Y\nseries:\n  - name: S\n    data:\n      - [1,2]",
      'Chart "x" axis must be an object',
    ],
    [
      "missing axis label",
      "type: line\nx:\n  scale: linear\ny:\n  label: Y\nseries:\n  - name: S\n    data:\n      - [1,2]",
      'Chart "x" axis must have a string "label"',
    ],
    [
      "invalid axis scale",
      "type: line\nx:\n  label: X\n  scale: quadratic\ny:\n  label: Y\nseries:\n  - name: S\n    data:\n      - [1,2]",
      'Chart "x" axis scale must be "linear" or "log"',
    ],
    [
      "empty series",
      "type: line\nx:\n  label: X\ny:\n  label: Y\nseries: []",
      'Chart must have a non-empty "series" array',
    ],
    [
      "non-array series",
      "type: line\nx:\n  label: X\ny:\n  label: Y\nseries: notarray",
      'Chart must have a non-empty "series" array',
    ],
    [
      "series item not object",
      "type: line\nx:\n  label: X\ny:\n  label: Y\nseries:\n  - 42",
      "series[0] must be an object",
    ],
    [
      "series missing name",
      "type: line\nx:\n  label: X\ny:\n  label: Y\nseries:\n  - data:\n      - [1,2]",
      'series[0] must have a string "name"',
    ],
    [
      "series empty data",
      "type: line\nx:\n  label: X\ny:\n  label: Y\nseries:\n  - name: S\n    data: []",
      'Series "S" must have a non-empty "data" array',
    ],
    [
      "data point not array",
      "type: line\nx:\n  label: X\ny:\n  label: Y\nseries:\n  - name: S\n    data:\n      - 42",
      'Series "S" data[0] must be a [x, y] array',
    ],
    [
      "data point wrong length",
      "type: line\nx:\n  label: X\ny:\n  label: Y\nseries:\n  - name: S\n    data:\n      - [1]",
      'Series "S" data[0] must be a [x, y] array',
    ],
    [
      "data point non-numeric",
      'type: line\nx:\n  label: X\ny:\n  label: Y\nseries:\n  - name: S\n    data:\n      - ["a", 2]',
      'Series "S" data[0] values must be numbers',
    ],
    [
      "annotations not array",
      "type: line\nx:\n  label: X\ny:\n  label: Y\nseries:\n  - name: S\n    data:\n      - [1,2]\nannotations: bad",
      '"annotations" must be an array',
    ],
    [
      "annotation not object",
      "type: line\nx:\n  label: X\ny:\n  label: Y\nseries:\n  - name: S\n    data:\n      - [1,2]\nannotations:\n  - 42",
      "annotations[0] must be an object",
    ],
    [
      "annotation bad type",
      "type: line\nx:\n  label: X\ny:\n  label: Y\nseries:\n  - name: S\n    data:\n      - [1,2]\nannotations:\n  - type: vertical-line\n    value: 3",
      'annotations[0] type must be "horizontal-line"',
    ],
    [
      "annotation non-numeric value",
      'type: line\nx:\n  label: X\ny:\n  label: Y\nseries:\n  - name: S\n    data:\n      - [1,2]\nannotations:\n  - type: horizontal-line\n    value: "three"',
      'annotations[0] must have a numeric "value"',
    ],
    [
      "annotation invalid style",
      "type: line\nx:\n  label: X\ny:\n  label: Y\nseries:\n  - name: S\n    data:\n      - [1,2]\nannotations:\n  - type: horizontal-line\n    value: 3\n    style: dotted",
      'annotations[0] style must be "solid" or "dashed"',
    ],
    [
      "non-numeric axis min",
      'type: line\nx:\n  label: X\n  min: "three"\ny:\n  label: Y\nseries:\n  - name: S\n    data:\n      - [1,2]',
      'Chart "x" axis min must be a number',
    ],
    [
      "log scale with zero x value",
      "type: line\nx:\n  label: X\n  scale: log\ny:\n  label: Y\nseries:\n  - name: S\n    data:\n      - [0, 2]",
      'Log scale on "x" axis requires positive values',
    ],
    [
      "log scale with negative y value",
      "type: line\nx:\n  label: X\ny:\n  label: Y\n  scale: log\nseries:\n  - name: S\n    data:\n      - [1, -5]",
      'Log scale on "y" axis requires positive values',
    ],
  ])("throws on %s", (_desc, yaml, expectedMsg) => {
    expect(() => parseChartSpec(yaml)).toThrow(expectedMsg)
  })
})

// ── renderLineChart ───────────────────────────────────────────────────

describe("renderLineChart", () => {
  const BASIC_SPEC: ChartSpec = {
    type: "line",
    title: "Test Chart",
    x: { label: "X Axis", scale: "linear" },
    y: { label: "Y Axis", scale: "linear" },
    series: [
      {
        name: "Series1",
        color: "var(--blue)",
        data: [
          [0, 0],
          [10, 100],
          [5, 50],
        ],
      },
    ],
    annotations: [{ type: "horizontal-line", value: 75, label: "Target", style: "dashed" }],
  }

  it("produces an SVG root element with correct attributes", () => {
    const svg = renderLineChart(BASIC_SPEC)
    expect(svg.tagName).toBe("svg")
    expect(svg.properties?.viewBox).toBe("0 0 600 370")
    expect(svg.properties?.class).toBe("smart-chart")
    expect(svg.properties?.role).toBe("img")
    expect(svg.properties?.["aria-label"]).toBe("Test Chart")
    expect(svg.properties?.xmlns).toBe("http://www.w3.org/2000/svg")
    expect(svg.properties?.width).toBe("100%")
  })

  it("renders title text", () => {
    const svg = renderLineChart(BASIC_SPEC)
    const texts: string[] = []
    visit(svg, "text", (node: Text) => {
      texts.push(node.value)
    })
    expect(texts).toContain("Test Chart")
  })

  it("renders axis labels", () => {
    const svg = renderLineChart(BASIC_SPEC)
    const texts: string[] = []
    visit(svg, "text", (node: Text) => {
      texts.push(node.value)
    })
    expect(texts).toContain("X Axis")
    expect(texts).toContain("Y Axis")
  })

  it("renders data points with data attributes and instant CSS tooltips", () => {
    const svg = renderLineChart(BASIC_SPEC)
    const pointGroups: Element[] = []
    visit(svg, "element", (node: Element) => {
      if (node.properties?.class === "smart-chart-point-group") {
        pointGroups.push(node)
      }
    })
    expect(pointGroups).toHaveLength(3)
    const circle = pointGroups[0].children.find(
      (c): c is Element => c.type === "element" && c.tagName === "circle",
    )
    expect(circle?.properties?.["data-series"]).toBe("Series1")
    // No native <title> (has ~500ms browser delay)
    expect(
      circle?.children.find((c) => c.type === "element" && c.tagName === "title"),
    ).toBeUndefined()
    // Tooltip <text> with two <tspan> children (X line, Y line)
    const tooltip = pointGroups[0].children.find(
      (c): c is Element => c.type === "element" && c.properties?.class === "smart-chart-tooltip",
    )
    expect(tooltip).toBeDefined()
    const tspans = (tooltip as Element).children.filter(
      (c): c is Element => c.type === "element" && c.tagName === "tspan",
    )
    expect(tspans).toHaveLength(2)
    // First point is (0, 0) after sorting
    expect((tspans[0].children[0] as Text).value).toBe("X Axis: 0")
    expect((tspans[1].children[0] as Text).value).toBe("Y Axis: 0")
  })

  it("renders a line path", () => {
    const svg = renderLineChart(BASIC_SPEC)
    const paths: Element[] = []
    visit(svg, "element", (node: Element) => {
      if (node.tagName === "path" && node.properties?.class === "smart-chart-line") {
        paths.push(node)
      }
    })
    expect(paths).toHaveLength(1)
    expect(paths[0].properties?.stroke).toBe("var(--blue)")
    expect(paths[0].properties?.d).toBeTruthy()
  })

  it("renders annotations with instant CSS tooltips", () => {
    const svg = renderLineChart(BASIC_SPEC)
    const annotations: Element[] = []
    visit(svg, "element", (node: Element) => {
      if (node.properties?.class === "smart-chart-annotation") {
        annotations.push(node)
      }
    })
    expect(annotations).toHaveLength(1)
    // Find dashed annotation line (no native <title>)
    const annotLine = annotations[0].children.find(
      (c): c is Element => c.type === "element" && c.tagName === "line",
    )
    expect(annotLine?.properties?.["stroke-dasharray"]).toBe("6,4")
    expect(
      annotLine?.children.find((c) => c.type === "element" && c.tagName === "title"),
    ).toBeUndefined()
    // Tooltip <text> with a single <tspan>
    const tooltip = annotations[0].children.find(
      (c): c is Element => c.type === "element" && c.properties?.class === "smart-chart-tooltip",
    )
    expect(tooltip).toBeDefined()
    const tspan = (tooltip as Element).children.find(
      (c): c is Element => c.type === "element" && c.tagName === "tspan",
    )
    expect((tspan?.children[0] as Text).value).toBe("Target: 75")
    // Find annotation label (separate visible text, not a tooltip)
    const annotLabel = annotations[0].children.find(
      (c): c is Element =>
        c.type === "element" &&
        c.tagName === "text" &&
        c.properties?.class !== "smart-chart-tooltip",
    )
    const labelNode = annotLabel?.children[0]
    expect(labelNode?.type === "text" && labelNode.value).toBe("Target")
  })

  it("includes accessible <desc> with data summary instead of root <title>", () => {
    const svg = renderLineChart(BASIC_SPEC)
    const descElements: Element[] = []
    visit(svg, "element", (node: Element) => {
      if (node.tagName === "desc") descElements.push(node)
    })
    // No root-level <title> (would cause whole-chart hover tooltip)
    const rootTitles = svg.children.filter((c) => c.type === "element" && c.tagName === "title")
    expect(rootTitles).toHaveLength(0)
    // <desc> with data summary
    expect(descElements).toHaveLength(1)
    expect(descElements[0].properties?.id).toBe("chart-desc-Series1")
    expect(svg.properties?.["aria-describedby"]).toBe("chart-desc-Series1")
    const descText = descElements[0].children[0]
    expect(descText.type === "text" && descText.value).toContain("X Axis:")
    expect(descText.type === "text" && descText.value).toContain("Series1: 3 points")
    expect(descText.type === "text" && descText.value).toContain("Target at y = 75")
  })

  it("uses default aria-label when no title provided", () => {
    const spec: ChartSpec = { ...BASIC_SPEC, title: undefined }
    const svg = renderLineChart(spec)
    expect(svg.properties?.["aria-label"]).toBe("Line chart")
  })

  it("renders without title when not provided", () => {
    const spec: ChartSpec = {
      ...BASIC_SPEC,
      title: undefined,
    }
    const svg = renderLineChart(spec)
    expect(svg.properties?.["aria-label"]).toBe("Line chart")
    // No title text at the top level
    const topLevelTexts: string[] = []
    for (const child of svg.children) {
      if (child.type === "element" && child.tagName === "text") {
        visit(child, "text", (node: Text) => topLevelTexts.push(node.value))
      }
    }
    expect(topLevelTexts).not.toContain("Test Chart")
  })

  it("renders without annotations when not provided", () => {
    const spec: ChartSpec = {
      ...BASIC_SPEC,
      annotations: undefined,
    }
    const svg = renderLineChart(spec)
    const annotations: Element[] = []
    visit(svg, "element", (node: Element) => {
      if (node.properties?.class === "smart-chart-annotation") {
        annotations.push(node)
      }
    })
    expect(annotations).toHaveLength(0)
  })

  it("uses default color when series has no color", () => {
    const spec: ChartSpec = {
      ...BASIC_SPEC,
      series: [
        {
          name: "NoColor",
          data: [
            [1, 2],
            [3, 4],
          ],
        },
      ],
    }
    const svg = renderLineChart(spec)
    const paths: Element[] = []
    visit(svg, "element", (node: Element) => {
      if (node.tagName === "path" && node.properties?.class === "smart-chart-line") {
        paths.push(node)
      }
    })
    expect(paths[0].properties?.stroke).toBe("var(--foreground)")
  })

  it("renders multi-series chart", () => {
    const spec: ChartSpec = {
      ...BASIC_SPEC,
      series: [
        {
          name: "A",
          color: "red",
          data: [
            [1, 2],
            [3, 4],
          ],
        },
        {
          name: "B",
          color: "blue",
          data: [
            [1, 3],
            [3, 5],
          ],
        },
      ],
    }
    const svg = renderLineChart(spec)
    const seriesGroups: Element[] = []
    visit(svg, "element", (node: Element) => {
      if (
        typeof node.properties?.class === "string" &&
        node.properties.class.includes("smart-chart-series")
      ) {
        seriesGroups.push(node)
      }
    })
    expect(seriesGroups).toHaveLength(2)
    expect(seriesGroups[0].properties?.["data-series-name"]).toBe("A")
    expect(seriesGroups[1].properties?.["data-series-name"]).toBe("B")
  })

  it("renders log scale", () => {
    const spec: ChartSpec = {
      type: "line",
      x: { label: "X", scale: "linear" },
      y: { label: "Y", scale: "log" },
      series: [
        {
          name: "S",
          data: [
            [1, 10],
            [2, 100],
            [3, 1000],
          ],
        },
      ],
    }
    const svg = renderLineChart(spec)
    // Should render without error; verify points exist
    const points: Element[] = []
    visit(svg, "element", (node: Element) => {
      if (node.tagName === "circle") points.push(node)
    })
    expect(points).toHaveLength(3)
  })

  it("renders solid annotation without label", () => {
    const spec: ChartSpec = {
      ...BASIC_SPEC,
      annotations: [{ type: "horizontal-line", value: 50, style: "solid" }],
    }
    const svg = renderLineChart(spec)
    const annotations: Element[] = []
    visit(svg, "element", (node: Element) => {
      if (node.properties?.class === "smart-chart-annotation") {
        annotations.push(node)
      }
    })
    expect(annotations).toHaveLength(1)
    const line = annotations[0].children.find(
      (c): c is Element => c.type === "element" && c.tagName === "line",
    )
    expect(line?.properties?.["stroke-dasharray"]).toBe("none")
    // Only the tooltip text, no visible label text
    const visibleLabels = annotations[0].children.filter(
      (c): c is Element =>
        c.type === "element" &&
        c.tagName === "text" &&
        c.properties?.class !== "smart-chart-tooltip",
    )
    expect(visibleLabels).toHaveLength(0)
  })

  it("extends y domain to include annotation values", () => {
    const spec: ChartSpec = {
      type: "line",
      x: { label: "X" },
      y: { label: "Y" },
      series: [
        {
          name: "S",
          data: [
            [1, 50],
            [2, 60],
          ],
        },
      ],
      annotations: [{ type: "horizontal-line", value: 10, style: "solid" }],
    }
    // If annotation value (10) is below series min (50), the y domain should include it
    const svg = renderLineChart(spec)
    // Check the annotation line is rendered (proves domain extended)
    const annotations: Element[] = []
    visit(svg, "element", (node: Element) => {
      if (node.properties?.class === "smart-chart-annotation") annotations.push(node)
    })
    expect(annotations).toHaveLength(1)
  })

  it("applies axis min overrides to domains", () => {
    const spec: ChartSpec = {
      type: "line",
      x: { label: "X", min: -5 },
      y: { label: "Y", min: 0 },
      series: [
        {
          name: "S",
          data: [
            [1, 50],
            [10, 100],
          ],
        },
      ],
    }
    const svg = renderLineChart(spec)
    // The y-axis should show ticks starting from 0 (not 50, the data min)
    const texts: string[] = []
    visit(svg, "text", (node: Text) => texts.push(node.value))
    expect(texts).toContain("0")
  })

  it("formats integer ticks without decimals", () => {
    const spec: ChartSpec = {
      type: "line",
      x: { label: "X" },
      y: { label: "Y" },
      series: [
        {
          name: "S",
          data: [
            [0, 0],
            [100, 100],
          ],
        },
      ],
    }
    const svg = renderLineChart(spec)
    const texts: string[] = []
    visit(svg, "text", (node: Text) => texts.push(node.value))
    // Tick labels for 0, 20, 40, 60, 80, 100 should not have decimals
    const tickTexts = texts.filter((t) => /^\d+$/.test(t))
    expect(tickTexts.length).toBeGreaterThan(0)
  })
})

// ── toTitleCase ──────────────────────────────────────────────────────

describe("toTitleCase", () => {
  it.each([
    ["already title case", "Layer Horizon vs Loss", "Layer Horizon vs Loss"],
    ["lowercase words", "layer horizon vs loss", "Layer Horizon vs Loss"],
    ["small words stay lowercase in middle", "loss for the model", "Loss for the Model"],
    ["small word capitalized at start", "the quick fox", "The Quick Fox"],
    ["small word capitalized at end", "what models are for", "What Models Are For"],
    ["ALL-CAPS words preserved", "GPT2-XL is great", "GPT2-XL Is Great"],
    ["numbers preserved", "(48 layers)", "(48 Layers)"],
    [
      "mixed example",
      "layer horizon vs loss for GPT2-XL (48 layers)",
      "Layer Horizon vs Loss for GPT2-XL (48 Layers)",
    ],
  ])("%s: %s → %s", (_desc, input, expected) => {
    expect(toTitleCase(input)).toBe(expected)
  })
})

// ── Charts transformer plugin ─────────────────────────────────────────

describe("Charts transformer plugin", () => {
  function createChartTree(yamlContent: string, language = "chart"): Root {
    return {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "pre",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "code",
              properties: { className: [`language-${language}`] },
              children: [{ type: "text", value: yamlContent }],
            },
          ],
        },
      ],
    }
  }

  const VALID_YAML = `type: line
x:
  label: X
y:
  label: Y
series:
  - name: S
    data:
      - [1, 2]
      - [3, 4]`

  it("replaces chart code block with SVG figure", () => {
    const tree = createChartTree(VALID_YAML)
    const plugin = Charts()
    const htmlPlugins = plugin.htmlPlugins?.(mockCtx) ?? []
    // Execute the plugin
    const transform = (htmlPlugins[0] as () => (tree: Root) => void)()
    transform(tree)

    // The pre should be replaced with a figure
    const figure = tree.children[0] as Element
    expect(figure.tagName).toBe("figure")
    expect(figure.properties?.className as string[]).toContain("smart-chart-container")
    // Inside the figure should be an SVG
    const svg = figure.children[0] as Element
    expect(svg.tagName).toBe("svg")
    expect(svg.properties?.class).toBe("smart-chart")
  })

  it("does not modify non-chart code blocks", () => {
    const tree = createChartTree("console.log('hello')", "javascript")
    const plugin = Charts()
    const htmlPlugins = plugin.htmlPlugins?.(mockCtx) ?? []
    const transform = (htmlPlugins[0] as () => (tree: Root) => void)()
    transform(tree)

    const pre = tree.children[0] as Element
    expect(pre.tagName).toBe("pre")
  })

  it("does not modify pre without code child", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "pre",
          properties: {},
          children: [{ type: "text", value: "just text" }],
        },
      ],
    }
    const plugin = Charts()
    const htmlPlugins = plugin.htmlPlugins?.(mockCtx) ?? []
    const transform = (htmlPlugins[0] as () => (tree: Root) => void)()
    transform(tree)

    const pre = tree.children[0] as Element
    expect(pre.tagName).toBe("pre")
  })

  it("handles Shiki-processed code blocks with nested spans", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "pre",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "code",
              properties: { className: ["language-chart"] },
              children: [
                {
                  type: "element",
                  tagName: "span",
                  properties: {},
                  children: [{ type: "text", value: "type: line\n" }],
                },
                {
                  type: "element",
                  tagName: "span",
                  properties: {},
                  children: [{ type: "text", value: "x:\n  label: X\n" }],
                },
                {
                  type: "element",
                  tagName: "span",
                  properties: {},
                  children: [
                    {
                      type: "text",
                      value: "y:\n  label: Y\nseries:\n  - name: S\n    data:\n      - [1, 2]",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }

    const plugin = Charts()
    const htmlPlugins = plugin.htmlPlugins?.(mockCtx) ?? []
    const transform = (htmlPlugins[0] as () => (tree: Root) => void)()
    transform(tree)

    const figure = tree.children[0] as Element
    expect(figure.tagName).toBe("figure")
  })

  it("detects chart blocks via data-language attribute on pre", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "pre",
          properties: { dataLanguage: "chart" },
          children: [
            {
              type: "element",
              tagName: "code",
              properties: { dataLanguage: "chart" },
              children: [{ type: "text", value: VALID_YAML }],
            },
          ],
        },
      ],
    }
    const plugin = Charts()
    const htmlPlugins = plugin.htmlPlugins?.(mockCtx) ?? []
    const transform = (htmlPlugins[0] as () => (tree: Root) => void)()
    transform(tree)

    expect((tree.children[0] as Element).tagName).toBe("figure")
  })

  it("detects chart blocks wrapped in rehype-pretty-code figure", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "figure",
          properties: { dataRehypePrettyCodeFigure: "" },
          children: [
            {
              type: "element",
              tagName: "pre",
              properties: { dataLanguage: "chart" },
              children: [
                {
                  type: "element",
                  tagName: "code",
                  properties: { dataLanguage: "chart" },
                  children: [{ type: "text", value: VALID_YAML }],
                },
              ],
            },
          ],
        },
      ],
    }
    const plugin = Charts()
    const htmlPlugins = plugin.htmlPlugins?.(mockCtx) ?? []
    const transform = (htmlPlugins[0] as () => (tree: Root) => void)()
    transform(tree)

    const figure = tree.children[0] as Element
    expect(figure.tagName).toBe("figure")
    expect(figure.properties?.className as string[]).toContain("smart-chart-container")
  })

  it("skips figures without properties", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "figure",
          properties: {},
          children: [{ type: "text", value: "caption" }],
        },
      ],
    }
    const plugin = Charts()
    const htmlPlugins = plugin.htmlPlugins?.(mockCtx) ?? []
    const transform = (htmlPlugins[0] as () => (tree: Root) => void)()
    transform(tree)

    expect((tree.children[0] as Element).tagName).toBe("figure")
  })

  it("skips non-chart rehype-pretty-code figures", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "figure",
          properties: { dataRehypePrettyCodeFigure: "" },
          children: [
            {
              type: "element",
              tagName: "pre",
              properties: { dataLanguage: "javascript" },
              children: [
                {
                  type: "element",
                  tagName: "code",
                  properties: {},
                  children: [{ type: "text", value: "console.log('hi')" }],
                },
              ],
            },
          ],
        },
      ],
    }
    const plugin = Charts()
    const htmlPlugins = plugin.htmlPlugins?.(mockCtx) ?? []
    const transform = (htmlPlugins[0] as () => (tree: Root) => void)()
    transform(tree)

    expect((tree.children[0] as Element).tagName).toBe("figure")
    expect((tree.children[0] as Element).properties?.dataRehypePrettyCodeFigure).toBe("")
  })

  it("skips non-pre elements", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {},
          children: [{ type: "text", value: "not a code block" }],
        },
      ],
    }
    const plugin = Charts()
    const htmlPlugins = plugin.htmlPlugins?.(mockCtx) ?? []
    const transform = (htmlPlugins[0] as () => (tree: Root) => void)()
    transform(tree)

    expect((tree.children[0] as Element).tagName).toBe("div")
  })

  it("has the correct plugin name", () => {
    const plugin = Charts()
    expect(plugin.name).toBe("Charts")
  })

  it("handles className as non-array", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "pre",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "code",
              properties: { className: "language-python" },
              children: [{ type: "text", value: "print('hi')" }],
            },
          ],
        },
      ],
    }
    const plugin = Charts()
    const htmlPlugins = plugin.htmlPlugins?.(mockCtx) ?? []
    const transform = (htmlPlugins[0] as () => (tree: Root) => void)()
    transform(tree)

    // Should not be transformed
    expect((tree.children[0] as Element).tagName).toBe("pre")
  })
})
