import { FilePath, joinSegments, slugifyFilePath } from "../../util/path"
import DepGraph from "../../depgraph"

import { QuartzEmitterPlugin } from "../types"
import { QuartzConfig } from "../../cfg"
import path from "path"
import fs from "fs"
import { glob } from "../../util/glob"
import { Argv } from "../../util/ctx"

const filesToCopy = async (argv: Argv, cfg: QuartzConfig) => {
  // glob all non MD files in content folder and copy it over
  return await glob("**", argv.directory, [
    "**/*.md",
    "**/*.md~",
    ...cfg.configuration.ignorePatterns,
  ])
}

const assetExtensions = ["webm", "mp4", "png", "jpg", "jpeg", "svg"]
export const Assets: QuartzEmitterPlugin = () => {
  return {
    name: "Assets",
    getQuartzComponents() {
      return []
    },
    async getDependencyGraph(ctx) {
      const { argv, cfg } = ctx
      const graph = new DepGraph<FilePath>()
      const fps = await filesToCopy(argv, cfg)
      for (const fp of fps) {
        const ext = path.extname(fp)
        const src = joinSegments(argv.directory, fp) as FilePath
        const name = (slugifyFilePath(fp as FilePath, true) + ext) as FilePath
        const dest = joinSegments(argv.output, name) as FilePath
        graph.addEdge(src, dest)
      }
      return graph
    },

    async emit({ argv, cfg }): Promise<FilePath[]> {
      const assetsPath = argv.output
      const fps = await filesToCopy(argv, cfg)
      const res: FilePath[] = []
      for (const fp of fps) {
        const ext = path.extname(fp).toLowerCase()
        const src = joinSegments(argv.directory, fp) as FilePath
        if (assetExtensions.includes(ext)) {
          console.warn("There's an asset file in contents:", src)
        }

        const name = (slugifyFilePath(fp as FilePath, true) + ext) as FilePath
        const dest = joinSegments(assetsPath, name) as FilePath
        const dir = path.dirname(dest) as FilePath
        await fs.promises.mkdir(dir, { recursive: true })
        await fs.promises.copyFile(src, dest)
        res.push(dest)
      }

      return res
    },
  }
}
