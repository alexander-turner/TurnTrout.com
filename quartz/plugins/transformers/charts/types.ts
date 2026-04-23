export interface AxisSpec {
  label: string
  scale?: "linear" | "log"
  min?: number
}

export interface Annotation {
  type: "horizontal-line"
  value: number
  label?: string
  style?: "solid" | "dashed"
}

export interface SeriesSpec {
  name: string
  color?: string
  // Data is inline when `ChartSpec.dataSource` is absent; otherwise it's
  // populated from the CSV by the Charts transformer before rendering.
  data: [number, number][]
}

export interface ChartSpec {
  type: "line"
  title?: string
  x: AxisSpec
  y: AxisSpec
  series: SeriesSpec[]
  annotations?: Annotation[]
  // CSV path (relative to the Markdown file). When set, per-series `data`
  // arrays start empty and the transformer fills them by matching rows where
  // the CSV's `series` column equals the series name.
  dataSource?: string
}
