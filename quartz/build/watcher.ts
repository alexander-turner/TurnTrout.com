import type { Mutex } from "async-mutex"

import { watch } from "chokidar"
import { isGitIgnored } from "globby"

import type { ProcessedContent } from "../plugins/vfile"
import type { BuildCtx } from "../util/ctx"
import type { FilePath } from "../util/path"
import type { BuildData, Dependencies } from "./types"

import { partialRebuildFromEntrypoint, rebuildFromEntrypoint } from "./incremental"
import { getFilePath } from "./utils"

/**
 * Starts a web server and sets up a file watcher for rebuilds.
 * @param ctx - The build context.
 * @param mut - A mutex to ensure only one build is running at a time.
 * @param initialContent - The initial content of the site.
 * @param clientRefresh - A function to refresh the client.
 * @param dependencies - The dependency graph for the site.
 * @returns A function to close the file watcher.
 */
export async function startServing(
  ctx: BuildCtx,
  mut: Mutex,
  initialContent: ProcessedContent[],
  clientRefresh: () => void,
  dependencies: Dependencies, // emitter name: dep graph
) {
  const { argv } = ctx

  const contentMap = new Map<FilePath, ProcessedContent>()
  for (const content of initialContent) {
    const [, vfile] = content
    contentMap.set(getFilePath(vfile), content)
  }

  const buildData: BuildData = {
    ctx,
    mut,
    dependencies,
    contentMap,
    ignored: await isGitIgnored(),
    initialSlugs: ctx.allSlugs,
    toRebuild: new Set<FilePath>(),
    toRemove: new Set<FilePath>(),
    trackedAssets: new Set<FilePath>(),
    lastBuildMs: 0,
  }

  const watcher = watch(".", {
    persistent: true,
    cwd: argv.directory,
    ignoreInitial: true,
  })

  const buildFromEntry = argv.fastRebuild ? partialRebuildFromEntrypoint : rebuildFromEntrypoint
  watcher
    .on("add", (fp) => buildFromEntry(fp, "add", clientRefresh, buildData))
    .on("change", (fp) => buildFromEntry(fp, "change", clientRefresh, buildData))
    .on("unlink", (fp) => buildFromEntry(fp, "delete", clientRefresh, buildData))

  return async () => {
    await watcher.close()
  }
}
