import type { Mutex } from "async-mutex"
import type { GlobbyFilterFunction } from "globby"

import type DepGraph from "../depgraph"
import type { ProcessedContent } from "../plugins/vfile"
import type { BuildCtx } from "../util/ctx"
import type { FilePath, FullSlug } from "../util/path"

export type Dependencies = Record<string, DepGraph<FilePath> | null>

export type FileEvent = "add" | "change" | "delete"

export type BuildData = {
  ctx: BuildCtx
  ignored: GlobbyFilterFunction
  mut: Mutex
  initialSlugs: FullSlug[]
  contentMap: Map<FilePath, ProcessedContent>
  trackedAssets: Set<FilePath>
  toRebuild: Set<FilePath>
  toRemove: Set<FilePath>
  lastBuildMs: number
  dependencies: Dependencies
}
