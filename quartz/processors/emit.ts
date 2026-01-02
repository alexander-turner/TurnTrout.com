import type { ProcessedContent } from "../plugins/vfile"
import type { BuildCtx } from "../util/ctx"

import { injectCriticalCSSIntoHTMLFiles } from "../cli/handlers"
import { getStaticResourcesFromPlugins } from "../plugins"
import { createWinstonLogger } from "../util/log"
import { PerfTimer } from "../util/perf"
import { trace } from "../util/trace"

export async function emitContent(ctx: BuildCtx, content: ProcessedContent[]) {
  const { argv, cfg } = ctx
  const perf = new PerfTimer()
  const log = createWinstonLogger("emit")

  log.info("Emitting output files")

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
    log.info("Generating critical CSS")
    await injectCriticalCSSIntoHTMLFiles(htmlFiles, argv.output)
    log.info(`Injected critical CSS into ${htmlFiles.length} files`)
  }

  log.info(`Emitted ${emittedFiles} files to \`${argv.output}\` in ${perf.timeSince()}`)
  return emittedFiles
}
