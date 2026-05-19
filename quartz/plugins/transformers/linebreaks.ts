import remarkBreaks from "remark-breaks"

import type { QuartzTransformerPlugin } from "../types"

/** Quartz transformer that converts single newlines into `<br>` via remark-breaks. */
export const HardLineBreaks: QuartzTransformerPlugin = () => {
  return {
    name: "HardLineBreaks",
    markdownPlugins() {
      return [remarkBreaks]
    },
  }
}
