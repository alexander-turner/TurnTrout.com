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
  // Accessible description of the chart. Every rendered chart must supply one so
  // screen readers, RSS consumers, and no-image contexts convey the meaning.
  alt: string
  // Optional URL (or local path) of the source image the chart was extracted
  // from. Preserved for future reference and rendered as a <noscript> fallback
  // alongside the SVG.
  fallback?: string
  x: AxisSpec
  y: AxisSpec
  series: SeriesSpec[]
  annotations?: Annotation[]
}
