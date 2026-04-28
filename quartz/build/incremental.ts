import chalk from "chalk"
const beep = await import("beepbeep")
import path from "path"
import { rimraf } from "rimraf"

import type { ProcessedContent } from "../plugins/vfile"
import type { FilePath } from "../util/path"
import type { BuildData, FileEvent } from "./types"

import { getStaticResourcesFromPlugins } from "../plugins"
import { emitContent } from "../processors/emit"
import { filterContent } from "../processors/filter"
import { parseMarkdown } from "../processors/parse"
import { toPosixPath } from "../util/glob"
import { joinSegments, slugifyFilePath } from "../util/path"
import { PerfTimer } from "../util/perf"
import { getFilePath } from "./utils"

/**
 * Performs a partial rebuild of the site when a file is changed, added, or deleted.
 * @param filepath - The path to the file that was changed.
 * @param action - The type of file change.
 * @param clientRefresh - A function to refresh the client.
 * @param buildData - The build data.
 */
export async function partialRebuildFromEntrypoint(
  filepath: string,
  action: FileEvent,
  clientRefresh: () => void,
  buildData: BuildData, // note: this function mutates buildData
) {
  const { ctx, ignored, dependencies, contentMap, mut, toRemove } = buildData
  const { argv, cfg } = ctx

  if (ignored(filepath)) {
    return
  }

  const buildStart = new Date().getTime()
  const release = await mut.acquire()
  if (buildData.lastBuildMs > buildStart) {
    release()
    return
  }
  buildData.lastBuildMs = buildStart

  const perf = new PerfTimer()
  console.log(chalk.yellow("Detected change, rebuilding..."))

  try {
    const fp = joinSegments(argv.directory, toPosixPath(filepath)) as FilePath

    const staticResources = getStaticResourcesFromPlugins(ctx)
    let processedFiles: ProcessedContent[] = []

    switch (action) {
      case "add":
        processedFiles = await parseMarkdown(ctx, [fp])
        processedFiles.forEach(([tree, vfile]) => contentMap.set(getFilePath(vfile), [tree, vfile]))

        for (const emitter of cfg.plugins.emitters) {
          const emitterGraph =
            (await emitter.getDependencyGraph?.(ctx, processedFiles, staticResources)) ?? null

          if (emitterGraph) {
            const existingGraph = dependencies[emitter.name]
            if (existingGraph !== null) {
              existingGraph.mergeGraph(emitterGraph)
            } else {
              // might be the first time we're adding a markdown file
              dependencies[emitter.name] = emitterGraph
            }
          }
        }
        break
      case "change":
        processedFiles = await parseMarkdown(ctx, [fp])
        processedFiles.forEach(([tree, vfile]) => contentMap.set(getFilePath(vfile), [tree, vfile]))

        // only content files can have added/removed dependencies because of transclusions
        if (path.extname(fp) === ".md") {
          for (const emitter of cfg.plugins.emitters) {
            const emitterGraph =
              (await emitter.getDependencyGraph?.(ctx, processedFiles, staticResources)) ?? null

            // only update the graph if the emitter plugin uses the changed file
            if (emitterGraph?.hasNode(fp)) {
              dependencies[emitter.name]?.updateIncomingEdgesForNode(emitterGraph, fp)
            }
          }
        }
        break
      case "delete":
        toRemove.add(fp)
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    if (argv.verbose) {
      console.log(`Updated dependency graphs in ${perf.timeSince()}`)
    }

    perf.addEvent("rebuild")
    let emittedFiles = 0
    const emittedPaths: FilePath[] = []

    for (const emitter of cfg.plugins.emitters) {
      const depGraph = dependencies[emitter.name]

      // emitter hasn't defined a dependency graph. call it with all processed files
      if (depGraph === null) {
        if (argv.verbose) {
          console.log(
            `Emitter ${emitter.name} doesn't define a dependency graph. Calling it with all files...`,
          )
        }

        const files = [...contentMap.values()].filter(
          ([, vfile]) => vfile.data.filePath && !toRemove.has(vfile.data.filePath),
        )

        const emittedFps = await emitter.emit(ctx, files, staticResources)

        if (ctx.argv.verbose) {
          for (const file of emittedFps) {
            console.log(`[emit:${emitter.name}] ${file}`)
          }
        }

        emittedFiles += emittedFps.length
        emittedPaths.push(...emittedFps)
        continue
      }

      if (depGraph.hasNode(fp)) {
        // re-emit using all files that are needed for the downstream of this file
        // eg. for ContentIndex, the dep graph could be:
        // a.md --> contentIndex.json
        // b.md ------^
        //
        // if a.md changes, we need to re-emit contentIndex.json,
        // and supply [a.md, b.md] to the emitter
        const upstreams = [...depGraph.getLeafNodeAncestors(fp)] as FilePath[]

        const upstreamContent = upstreams
          .filter((file) => contentMap.has(file))
          .filter((file) => !toRemove.has(file))
          .map((file) => contentMap.get(file) || [])
          .filter((content) => content.length > 0)

        const emittedFps = await emitter.emit(
          ctx,
          upstreamContent as ProcessedContent[],
          staticResources,
        )

        if (ctx.argv.verbose) {
          for (const file of emittedFps) {
            console.log(`[emit:${emitter.name}] ${file}`)
          }
        }

        emittedFiles += emittedFps.length
        emittedPaths.push(...emittedFps)
      }
    }

    console.log(
      `Emitted ${emittedFiles} files to \`${argv.output}\` in ${perf.timeSince("rebuild")}`,
    )

    const destinationsToDelete = new Set<FilePath>()
    for (const file of toRemove) {
      contentMap.delete(file)
      Object.values(dependencies).forEach((depGraph) => {
        depGraph?.removeNode(file)
        const orphanNodes = depGraph?.removeOrphanNodes()
        orphanNodes?.forEach((node) => {
          if (node.startsWith(argv.output)) {
            destinationsToDelete.add(node)
          }
        })
      })
    }
    await rimraf([...destinationsToDelete])

    console.log(chalk.green(`Done rebuilding in ${perf.timeSince()} 🔔`))
    beep.default(1)

    toRemove.clear()
  } finally {
    release()
  }
  clientRefresh()
}

/**
 * Performs a full rebuild of the site when a file is changed, added, or deleted.
 * @param fp - The path to the file that was changed.
 * @param action - The type of file change.
 * @param clientRefresh - A function to refresh the client.
 * @param buildData - The build data.
 */
export async function rebuildFromEntrypoint(
  fp: string,
  action: FileEvent,
  clientRefresh: () => void,
  buildData: BuildData, // note: this function mutates buildData
) {
  const { ctx, ignored, mut, initialSlugs, contentMap, toRebuild, toRemove, trackedAssets } =
    buildData

  const { argv } = ctx

  if (ignored(fp)) {
    return
  }

  // dont bother rebuilding for non-content files, just track and refresh
  fp = toPosixPath(fp)
  const filePath = joinSegments(argv.directory, fp) as FilePath
  if (path.extname(fp) !== ".md") {
    if (action === "add" || action === "change") {
      trackedAssets.add(filePath)
    } else if (action === "delete") {
      trackedAssets.delete(filePath)
    }
    clientRefresh()
    return
  }

  if (action === "add" || action === "change") {
    toRebuild.add(filePath)
  } else if (action === "delete") {
    toRemove.add(filePath)
  }

  const buildStart = new Date().getTime()
  buildData.lastBuildMs = buildStart
  const release = await mut.acquire()

  // there's another build after us, release and let them do it
  if (buildData.lastBuildMs > buildStart) {
    release()
    return
  }

  const perf = new PerfTimer()
  console.log(chalk.yellow("Detected change, rebuilding..."))
  try {
    const filesToRebuild = [...toRebuild].filter((fp) => !toRemove.has(fp))

    const trackedSlugs = [...new Set([...contentMap.keys(), ...toRebuild, ...trackedAssets])]
      .filter((fp) => !toRemove.has(fp))
      .map((fp) => slugifyFilePath(path.posix.relative(argv.directory, fp) as FilePath))

    ctx.allSlugs = [...new Set([...initialSlugs, ...trackedSlugs])]
    const parsedContent = await parseMarkdown(ctx, filesToRebuild)
    for (const content of parsedContent) {
      const [, vfile] = content
      contentMap.set(getFilePath(vfile), content)
    }

    for (const fp of toRemove) {
      contentMap.delete(fp)
    }

    const parsedFiles = [...contentMap.values()]
    const filteredContent = filterContent(ctx, parsedFiles)

    await rimraf(path.join(argv.output, ".*"), { glob: true })
    await emitContent(ctx, filteredContent)
    console.log(chalk.green(`Done rebuilding in ${perf.timeSince()}`))
  } catch (err) {
    console.log(chalk.yellow("Rebuild failed. Waiting on a change to fix the error..."))
    if (err instanceof Error) {
      console.log(chalk.red(err.message))
      if (argv.verbose && err.stack) {
        console.log(chalk.red(err.stack))
      }
    } else if (argv.verbose) {
      console.log(chalk.red(err))
    }
  }

  release()
  clientRefresh()
  toRebuild.clear()
  toRemove.clear()
}
