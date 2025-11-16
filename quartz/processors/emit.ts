import type { ProcessedContent } from "../plugins/vfile"
import type { BuildCtx } from "../util/ctx"

import { injectCriticalCSSIntoHTMLFiles } from "../cli/handlers"
import { getStaticResourcesFromPlugins, PopulateContainers } from "../plugins"
import { QuartzLogger } from "../util/log"
import { PerfTimer } from "../util/perf"
import { trace } from "../util/trace"

const POPULATE_CONTAINERS_NAME = PopulateContainers.name

export async function emitContent(ctx: BuildCtx, content: ProcessedContent[]) {
  const { argv, cfg } = ctx
  const perf = new PerfTimer()
  const log = new QuartzLogger()

  log.start("Emitting output files")

  let emittedFiles = 0
  const emittedPaths: string[] = []
  const staticResources = getStaticResourcesFromPlugins(ctx)

  // First pass: emit all content (except post-processors that need to run after)
  for (const emitter of cfg.plugins.emitters) {
    // Skip PopulateContainers in first pass - it runs in third pass after all files are written
    if (emitter.name === POPULATE_CONTAINERS_NAME) {
      continue
    }

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

  // Second pass: generate critical CSS for all HTML files
  const htmlFiles = emittedPaths.filter((fp) => fp.endsWith(".html"))
  if (htmlFiles.length > 0 && !argv.skipCriticalCSS) {
    log.start("Generating critical CSS")
    await injectCriticalCSSIntoHTMLFiles(htmlFiles, argv.output)
    log.end(`Injected critical CSS into ${htmlFiles.length} files`)
  }

  // Third pass: post-process specific HTML files (e.g., populate containers)
  // This must run after all emitters complete to ensure files are fully written
  const populateContainersEmitter = cfg.plugins.emitters.find(
    (e) => e.name === POPULATE_CONTAINERS_NAME,
  )
  if (populateContainersEmitter) {
    try {
      const populated = await populateContainersEmitter.emit(ctx, content, staticResources)
      emittedFiles += populated.length
      if (populated.length > 0 && argv.verbose) {
        console.log(`[emit:${POPULATE_CONTAINERS_NAME}] ${populated.length} file(s)`)
      }
    } catch (err) {
      trace(`[emit:${POPULATE_CONTAINERS_NAME}] Failed to post-process`, err as Error)
    }
  }

  log.end(`Emitted ${emittedFiles} files to \`${argv.output}\` in ${perf.timeSince()}`)
  return emittedFiles
}
