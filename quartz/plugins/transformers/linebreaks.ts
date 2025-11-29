import remarkBreaks from "remark-breaks"

import type { QuartzTransformerPlugin } from "../types"

// skipcq: JS-D1001
export const HardLineBreaks: QuartzTransformerPlugin = () => {
  return {
    name: "HardLineBreaks",
    markdownPlugins() {
      return [remarkBreaks]
    },
  }
}
