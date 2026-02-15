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
  data: [number, number][]
}

export interface ChartSpec {
  type: "line"
  title?: string
  x: AxisSpec
  y: AxisSpec
  series: SeriesSpec[]
  annotations?: Annotation[]
}
