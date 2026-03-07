import type { ProcessedContent } from "../plugins/vfile"
import type { BuildCtx } from "../util/ctx"

import { PerfTimer } from "../util/perf"

export function filterContent(ctx: BuildCtx, content: ProcessedContent[]): ProcessedContent[] {
  const { cfg, argv } = ctx
  const perf = new PerfTimer()
  const initialLength = content.length
  for (const plugin of cfg.plugins.filters) {
    const updatedContent = content.filter((item) => plugin.shouldPublish(ctx, item))

    if (argv.verbose) {
      const updatedSet = new Set(updatedContent)
      const diff = content.filter((x) => !updatedSet.has(x))
      for (const file of diff) {
        console.log(`[filter:${plugin.name}] ${file[1].data.slug}`)
      }
    }

    content = updatedContent
  }

  console.log(`Filtered out ${initialLength - content.length} files in ${perf.timeSince()}`)
  return content
}
