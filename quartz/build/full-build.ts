import { Mutex } from "async-mutex"

const beep = await import("beepbeep")

import chalk from "chalk"
import path from "path"
import { rimraf } from "rimraf"

import type { ProcessedContent } from "../plugins/vfile"
import type { Argv, BuildCtx } from "../util/ctx"
import type { FilePath } from "../util/path"
import type { Dependencies } from "./types"

import cfg from "../../config/quartz/quartz.config"
import { getStaticResourcesFromPlugins } from "../plugins"
import { countAllFavicons } from "../plugins/transformers/countFavicons"
import { emitContent } from "../processors/emit"
import { filterContent } from "../processors/filter"
import { parseMarkdown } from "../processors/parse"
import { glob } from "../util/glob"
import { setLogLevelFromArgv } from "../util/log"
import { joinSegments, slugifyFilePath } from "../util/path"
import { PerfTimer } from "../util/perf"
import { startServing } from "./watcher"

/**
 * Builds the Quartz site.
 * @param argv - The command-line arguments.
 * @param mut - A mutex to ensure only one build is running at a time.
 * @param clientRefresh - A function to refresh the client.
 * @returns A function to clean up the build, or an empty function if not serving.
 */
export default async function buildQuartz(argv: Argv, mut: Mutex, clientRefresh: () => void) {
  setLogLevelFromArgv(argv)

  const ctx: BuildCtx = {
    argv,
    cfg,
    allSlugs: [],
  }

  const perf = new PerfTimer()
  const output = argv.output

  const pluginCount = Object.values(cfg.plugins).flat().length
  const pluginNames = (key: "transformers" | "filters" | "emitters") =>
    cfg.plugins[key].map((plugin) => plugin.name)
  if (argv.verbose) {
    console.log(`Loaded ${pluginCount} plugins`)
    console.log(`  Transformers: ${pluginNames("transformers").join(", ")}`)
    console.log(`  Filters: ${pluginNames("filters").join(", ")}`)
    console.log(`  Emitters: ${pluginNames("emitters").join(", ")}`)
  }

  let parsedFiles: ProcessedContent[]
  const dependencies: Dependencies = {}

  const release = await mut.acquire()
  try {
    perf.addEvent("clean")
    await rimraf(path.join(output, "*"), { glob: true })
    console.log(`Cleaned output directory \`${output}\` in ${perf.timeSince("clean")}`)

    perf.addEvent("glob")
    const allFiles = await glob("**/*.*", argv.directory, cfg.configuration.ignorePatterns)
    const fps = allFiles.filter((fp) => fp.endsWith(".md")).sort()
    console.log(
      `Found ${fps.length} input files from \`${argv.directory}\` in ${perf.timeSince("glob")}`,
    )

    const filePaths = fps.map((fp) => joinSegments(argv.directory, fp) as FilePath)
    ctx.allSlugs = allFiles.map((fp) => slugifyFilePath(fp as FilePath))

    if (!argv.offline) {
      perf.addEvent("count-links")
      await countAllFavicons(ctx, filePaths)
      console.log(`Counted links in ${perf.timeSince("count-links")}`)
    } else {
      console.log(chalk.yellow("Skipping link counting (offline mode)"))
    }

    parsedFiles = await parseMarkdown(ctx, filePaths)
    const filteredContent = filterContent(ctx, parsedFiles)

    if (argv.fastRebuild) {
      const staticResources = getStaticResourcesFromPlugins(ctx)
      for (const emitter of cfg.plugins.emitters) {
        dependencies[emitter.name] =
          (await emitter.getDependencyGraph?.(ctx, filteredContent, staticResources)) ?? null
      }
    }

    await emitContent(ctx, filteredContent)
    console.log(chalk.green(`Done processing ${fps.length} files in ${perf.timeSince()} 🔔`))
    beep.default(1)
  } finally {
    release()
  }

  if (argv.serve) {
    return startServing(ctx, mut, parsedFiles, clientRefresh, dependencies)
  }
  return () => {
    // No cleanup needed in build-only mode (no resources to clean up)
  }
}
