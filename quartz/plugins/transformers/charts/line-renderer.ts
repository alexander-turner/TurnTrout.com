import type { ScaleContinuousNumeric, ScaleLinear } from "d3-scale"
import type { Element, ElementContent } from "hast"

import { max, min } from "d3-array"
import { format } from "d3-format"
import { scaleLinear, scaleLog } from "d3-scale"
import { line } from "d3-shape"

import type { ChartSpec, SeriesSpec } from "./types"

const CHART_WIDTH = 600
const CHART_HEIGHT = 370
const MARGIN = { top: 30, right: 20, bottom: 70, left: 60 }
const INNER_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right
const INNER_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom
const POINT_RADIUS = 3.5
const DEFAULT_COLOR = "var(--foreground)"

function createScale(
  domain: [number, number],
  range: [number, number],
  scaleType: "linear" | "log",
): ScaleContinuousNumeric<number, number> {
  if (scaleType === "log") {
    return scaleLog().domain(domain).range(range)
  }
  return scaleLinear().domain(domain).range(range)
}

function computeDomain(
  series: SeriesSpec[],
  accessor: (d: [number, number]) => number,
): [number, number] {
  const allValues = series.flatMap((s) => s.data.map(accessor))
  // istanbul ignore next -- parser validates non-empty data
  return [min(allValues) ?? 0, max(allValues) ?? 1]
}

function formatTick(value: number): string {
  if (Number.isInteger(value)) return format(",")(value)
  return format(",.2~f")(value)
}

function generateTicks(scale: ScaleContinuousNumeric<number, number>, count: number): number[] {
  // D3 scales have a .ticks() method
  return (scale as ScaleLinear<number, number>).ticks(count)
}

function createSvgElement(
  tagName: string,
  properties: Record<string, string | number | boolean>,
  children: ElementContent[] = [],
): Element {
  return {
    type: "element",
    tagName,
    properties: { ...properties },
    children,
  }
}

function createTextElement(
  x: number,
  y: number,
  text: string,
  extraProps: Record<string, string | number>,
): Element {
  return createSvgElement("text", { x, y, fill: "var(--foreground)", ...extraProps }, [
    { type: "text" as const, value: text },
  ])
}

const TOOLTIP_LINE_HEIGHT = 14

/** Build a single <text> tooltip with <tspan> children for multi-line support.
 *  Background is handled via CSS paint-order + drop-shadow. */
function createTooltipElement(x: number, y: number, lines: string[]): Element {
  const tspans: ElementContent[] = lines.map((text, i) =>
    createSvgElement("tspan", { x, dy: i === 0 ? 0 : TOOLTIP_LINE_HEIGHT }, [
      { type: "text" as const, value: text },
    ]),
  )

  return createSvgElement(
    "text",
    {
      x,
      y,
      "text-anchor": "middle",
      "font-size": "11px",
      "font-family": "var(--font-main)",
      "pointer-events": "none",
      class: "smart-chart-tooltip",
    },
    tspans,
  )
}

function renderXAxis(xScale: ScaleContinuousNumeric<number, number>, label: string): Element {
  const ticks = generateTicks(xScale, 8)
  const tickElements: Element[] = ticks.map((t) => {
    const xPos = xScale(t)
    return createSvgElement("g", { transform: `translate(${xPos},0)` }, [
      createSvgElement("line", {
        y2: 6,
        stroke: "var(--midground-faint)",
      }),
      createTextElement(0, 22, formatTick(t), {
        "text-anchor": "middle",
        "font-size": "12px",
        "font-family": "var(--font-main)",
      }),
    ])
  })

  // Axis line
  const axisLine = createSvgElement("line", {
    x1: 0,
    x2: INNER_WIDTH,
    stroke: "var(--midground-faint)",
  })

  // Label
  const axisLabel = createTextElement(INNER_WIDTH / 2, 44, label, {
    "text-anchor": "middle",
    "font-size": "13px",
    "font-family": "var(--font-main)",
  })

  return createSvgElement(
    "g",
    {
      transform: `translate(0,${INNER_HEIGHT})`,
      class: "smart-chart-axis smart-chart-x-axis",
    },
    [axisLine, ...tickElements, axisLabel],
  )
}

function renderYAxis(yScale: ScaleContinuousNumeric<number, number>, label: string): Element {
  const ticks = generateTicks(yScale, 6)
  const tickElements: Element[] = ticks.map((t) => {
    const yPos = yScale(t)
    return createSvgElement("g", { transform: `translate(0,${yPos})` }, [
      createSvgElement("line", {
        x2: -6,
        stroke: "var(--midground-faint)",
      }),
      // Grid line
      createSvgElement("line", {
        x2: INNER_WIDTH,
        stroke: "var(--midground-faint)",
        "stroke-opacity": "0.2",
      }),
      createTextElement(-10, 4, formatTick(t), {
        "text-anchor": "end",
        "font-size": "12px",
        "font-family": "var(--font-main)",
      }),
    ])
  })

  // Axis line
  const axisLine = createSvgElement("line", {
    y1: 0,
    y2: INNER_HEIGHT,
    stroke: "var(--midground-faint)",
  })

  // Label (rotated)
  const axisLabel = createTextElement(0, 0, label, {
    transform: `translate(-25,${INNER_HEIGHT / 2}) rotate(-90)`,
    "text-anchor": "middle",
    "font-size": "13px",
    "font-family": "var(--font-main)",
  })

  return createSvgElement("g", { class: "smart-chart-axis smart-chart-y-axis" }, [
    axisLine,
    ...tickElements,
    axisLabel,
  ])
}

function renderSeries(
  series: SeriesSpec,
  xScale: ScaleContinuousNumeric<number, number>,
  yScale: ScaleContinuousNumeric<number, number>,
  seriesIndex: number,
  axisLabels: { x: string; y: string },
): Element {
  const color = series.color ?? DEFAULT_COLOR
  const sortedData = [...series.data].sort((a, b) => a[0] - b[0])

  // Line path
  const lineGenerator = line<[number, number]>()
    .x((d) => xScale(d[0]))
    .y((d) => yScale(d[1]))
  // istanbul ignore next -- lineGenerator returns null only for empty data (parser validates non-empty)
  const pathD = lineGenerator(sortedData) ?? ""

  const linePath = createSvgElement("path", {
    d: pathD,
    fill: "none",
    stroke: color,
    "stroke-width": "2",
    class: "smart-chart-line",
  })

  // Data points with instant CSS tooltips (native <title> has ~500ms browser delay)
  const points: Element[] = sortedData.map((d) => {
    const cx = xScale(d[0])
    const cy = yScale(d[1])
    const tooltipLines = [
      `${axisLabels.x}: ${formatTick(d[0])}`,
      `${axisLabels.y}: ${formatTick(d[1])}`,
    ]

    return createSvgElement("g", { class: "smart-chart-point-group" }, [
      createSvgElement("circle", {
        cx,
        cy,
        r: POINT_RADIUS,
        fill: color,
        class: "smart-chart-point",
        "data-x": d[0],
        "data-y": d[1],
        "data-series": series.name,
      }),
      createTooltipElement(cx, cy - TOOLTIP_LINE_HEIGHT - 10, tooltipLines),
    ])
  })

  return createSvgElement(
    "g",
    {
      class: `smart-chart-series`,
      "data-series-index": seriesIndex,
      "data-series-name": series.name,
    },
    [linePath, ...points],
  )
}

const TOOLTIP_CHAR_WIDTH = 5.5
const TOOLTIP_BG_PAD_X = 8
const TOOLTIP_BG_PAD_Y = 4

function createTooltipBackground(x: number, y: number, text: string): Element {
  const textWidth = text.length * TOOLTIP_CHAR_WIDTH
  const bgWidth = textWidth + 2 * TOOLTIP_BG_PAD_X
  const bgHeight = TOOLTIP_LINE_HEIGHT + 2 * TOOLTIP_BG_PAD_Y
  return createSvgElement("rect", {
    x: x - bgWidth / 2,
    y: y - TOOLTIP_LINE_HEIGHT + TOOLTIP_BG_PAD_Y / 2,
    width: bgWidth,
    height: bgHeight,
    rx: 3,
    fill: "var(--background)",
    class: "smart-chart-tooltip-bg",
    "pointer-events": "none",
  })
}

function renderAnnotations(
  spec: ChartSpec,
  xScale: ScaleContinuousNumeric<number, number>,
  yScale: ScaleContinuousNumeric<number, number>,
): Element[] {
  if (!spec.annotations) return []

  return spec.annotations.map((ann) => {
    const yPos = yScale(ann.value)
    const tooltipLabel = `${ann.label ?? "Annotation"}: ${formatTick(ann.value)}`
    const tooltipX = INNER_WIDTH / 2
    const tooltipY = yPos - 8
    const children: Element[] = [
      createSvgElement("line", {
        x1: 0,
        x2: INNER_WIDTH,
        y1: yPos,
        y2: yPos,
        stroke: "var(--midground-faint)",
        "stroke-width": "1.5",
        "stroke-dasharray": ann.style === "dashed" ? "6,4" : "none",
        "pointer-events": "stroke",
      }),
      createTooltipBackground(tooltipX, tooltipY, tooltipLabel),
      createTooltipElement(tooltipX, tooltipY, [tooltipLabel]),
    ]

    if (ann.label) {
      children.push(
        createTextElement(5, yPos - 6, ann.label, {
          "font-size": "11px",
          "font-family": "var(--font-main)",
          fill: "var(--midground)",
        }),
      )
    }

    return createSvgElement("g", { class: "smart-chart-annotation" }, children)
  })
}

function renderTitle(title: string): Element {
  return createTextElement(CHART_WIDTH / 2, 18, title, {
    "text-anchor": "middle",
    "font-size": "14px",
    "text-decoration": "none",
    "font-family": "var(--font-main)",
  })
}

/** Build a screen-reader description summarising the chart data. */
function buildAccessibleDescription(spec: ChartSpec): string {
  const parts: string[] = []

  parts.push(
    `${spec.x.label}: ${formatTick(computeDomain(spec.series, (d) => d[0])[0])} to ${formatTick(computeDomain(spec.series, (d) => d[0])[1])}.`,
  )
  parts.push(
    `${spec.y.label}: ${formatTick(computeDomain(spec.series, (d) => d[1])[0])} to ${formatTick(computeDomain(spec.series, (d) => d[1])[1])}.`,
  )

  for (const s of spec.series) {
    const sorted = [...s.data].sort((a, b) => a[0] - b[0])
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    parts.push(
      `${s.name}: ${sorted.length} points, from (${formatTick(first[0])}, ${formatTick(first[1])}) to (${formatTick(last[0])}, ${formatTick(last[1])}).`,
    )
  }

  if (spec.annotations) {
    for (const ann of spec.annotations) {
      const label = ann.label ?? "Annotation"
      parts.push(`${label} at y = ${formatTick(ann.value)}.`)
    }
  }

  return parts.join(" ")
}

export function renderLineChart(spec: ChartSpec): Element {
  // Compute domains
  const xDomain = computeDomain(spec.series, (d) => d[0])
  const yDomain = computeDomain(spec.series, (d) => d[1])

  // Apply explicit axis min overrides
  if (spec.x.min !== undefined) xDomain[0] = spec.x.min
  if (spec.y.min !== undefined) yDomain[0] = spec.y.min

  // Extend y domain to include annotations
  if (spec.annotations) {
    for (const ann of spec.annotations) {
      yDomain[0] = Math.min(yDomain[0], ann.value)
      yDomain[1] = Math.max(yDomain[1], ann.value)
    }
  }

  // Create scales
  const xScale = createScale(xDomain, [0, INNER_WIDTH], spec.x.scale ?? "linear")
  const yScale = createScale(yDomain, [INNER_HEIGHT, 0], spec.y.scale ?? "linear")

  // Build chart elements
  const chartChildren: Element[] = []

  // Accessible <desc> (no native tooltip, unlike <title>)
  const descId = `chart-desc-${spec.series.map((s) => s.name).join("-")}`.replace(/\s+/g, "-")
  chartChildren.push(
    createSvgElement("desc", { id: descId }, [
      { type: "text" as const, value: buildAccessibleDescription(spec) },
    ]),
  )

  // Visible title (outside the inner group)
  if (spec.title) {
    chartChildren.push(renderTitle(spec.title))
  }

  // Inner group with margin offset
  const innerChildren: Element[] = [
    renderXAxis(xScale, spec.x.label),
    renderYAxis(yScale, spec.y.label),
    ...renderAnnotations(spec, xScale, yScale),
    ...spec.series.map((s, i) =>
      renderSeries(s, xScale, yScale, i, { x: spec.x.label, y: spec.y.label }),
    ),
  ]

  chartChildren.push(
    createSvgElement("g", { transform: `translate(${MARGIN.left},${MARGIN.top})` }, innerChildren),
  )

  // Root SVG element
  return createSvgElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`,
      width: "100%",
      class: "smart-chart",
      role: "img",
      "aria-label": spec.title ?? "Line chart",
      "aria-describedby": descId,
    },
    chartChildren,
  )
}
