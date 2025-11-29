import type { ProcessedContent } from "../plugins/vfile"
import type { BuildCtx } from "../util/ctx"

import { injectCriticalCSSIntoHTMLFiles } from "../cli/handlers"
import { getStaticResourcesFromPlugins } from "../plugins"
import { QuartzLogger } from "../util/log"
import { PerfTimer } from "../util/perf"
import { trace } from "../util/trace"

export async function emitContent(ctx: BuildCtx, content: ProcessedContent[]) {
  const { argv, cfg } = ctx
  const perf = new PerfTimer()
  const log = new QuartzLogger()

  log.start("Emitting output files")

  let emittedFiles = 0
  const emittedPaths: string[] = []
  const staticResources = getStaticResourcesFromPlugins(ctx)

  for (const emitter of cfg.plugins.emitters) {
    try {
      const emitted = await emitter.emit(ctx, content, staticResources)
      emittedFiles += emitted.length
      emittedPaths.push(...emitted)

      if (ctx.argv.verbose) {
        for (const file of emitted) {
          console.log(`[emit:${emitter.name}] ${file}`)
        }
      }
    } catch (err) {
      trace(`Failed to emit from plugin \`${emitter.name}\``, err as Error)
    }
  }

  const htmlFiles = emittedPaths.filter((fp) => fp.endsWith(".html"))
  if (htmlFiles.length > 0 && !argv.skipCriticalCSS) {
    log.start("Generating critical CSS")
    await injectCriticalCSSIntoHTMLFiles(htmlFiles, argv.output)
    log.end(`Injected critical CSS into ${htmlFiles.length} files`)
  }

  log.end(`Emitted ${emittedFiles} files to \`${argv.output}\` in ${perf.timeSince()}`)
  return emittedFiles
}
