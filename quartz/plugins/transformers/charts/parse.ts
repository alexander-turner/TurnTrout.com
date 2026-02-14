import yaml from "js-yaml"

import type { Annotation, AxisSpec, ChartSpec, SeriesSpec } from "./types"

function parseAxisSpec(raw: unknown, name: string): AxisSpec {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`Chart "${name}" axis must be an object`)
  }
  const obj = raw as Record<string, unknown>
  if (typeof obj.label !== "string") {
    throw new Error(`Chart "${name}" axis must have a string "label"`)
  }
  const scale = obj.scale as string | undefined
  if (scale !== undefined && scale !== "linear" && scale !== "log") {
    throw new Error(`Chart "${name}" axis scale must be "linear" or "log"`)
  }
  return { label: obj.label, scale: scale ?? "linear" }
}

function parseDataPoint(raw: unknown, seriesName: string, index: number): [number, number] {
  if (!Array.isArray(raw) || raw.length !== 2) {
    throw new Error(`Series "${seriesName}" data[${index}] must be a [x, y] array`)
  }
  const [x, y] = raw
  if (typeof x !== "number" || typeof y !== "number") {
    throw new Error(`Series "${seriesName}" data[${index}] values must be numbers`)
  }
  return [x, y]
}

function parseSeries(raw: unknown): SeriesSpec[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Chart must have a non-empty "series" array')
  }
  return raw.map((s: unknown, i: number) => {
    if (typeof s !== "object" || s === null) {
      throw new Error(`series[${i}] must be an object`)
    }
    const obj = s as Record<string, unknown>
    if (typeof obj.name !== "string") {
      throw new Error(`series[${i}] must have a string "name"`)
    }
    if (!Array.isArray(obj.data) || obj.data.length === 0) {
      throw new Error(`Series "${obj.name}" must have a non-empty "data" array`)
    }
    const data = obj.data.map((d: unknown, j: number) => parseDataPoint(d, obj.name as string, j))
    return {
      name: obj.name,
      color: typeof obj.color === "string" ? obj.color : undefined,
      data,
    } as SeriesSpec
  })
}

function parseAnnotations(raw: unknown): Annotation[] {
  if (!Array.isArray(raw)) {
    throw new Error('"annotations" must be an array')
  }
  return raw.map((a: unknown, i: number) => {
    if (typeof a !== "object" || a === null) {
      throw new Error(`annotations[${i}] must be an object`)
    }
    const obj = a as Record<string, unknown>
    if (obj.type !== "horizontal-line") {
      throw new Error(`annotations[${i}] type must be "horizontal-line"`)
    }
    if (typeof obj.value !== "number") {
      throw new Error(`annotations[${i}] must have a numeric "value"`)
    }
    const style = obj.style as string | undefined
    if (style !== undefined && style !== "solid" && style !== "dashed") {
      throw new Error(`annotations[${i}] style must be "solid" or "dashed"`)
    }
    return {
      type: obj.type,
      value: obj.value,
      label: typeof obj.label === "string" ? obj.label : undefined,
      style: style ?? "solid",
    } as Annotation
  })
}

export function parseChartSpec(yamlString: string): ChartSpec {
  const raw = yaml.load(yamlString)
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Chart spec must be a YAML object")
  }
  const obj = raw as Record<string, unknown>

  if (obj.type !== "line") {
    throw new Error(`Unsupported chart type: "${obj.type}". Only "line" is supported.`)
  }

  return {
    type: "line",
    title: typeof obj.title === "string" ? obj.title : undefined,
    x: parseAxisSpec(obj.x, "x"),
    y: parseAxisSpec(obj.y, "y"),
    series: parseSeries(obj.series),
    annotations: obj.annotations ? parseAnnotations(obj.annotations) : undefined,
  }
}
