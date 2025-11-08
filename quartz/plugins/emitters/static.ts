import fs from "fs"

import type { QuartzEmitterPlugin } from "../types"

import { localTroutFaviconBasenameDefault } from "../../components/constants"
import DepGraph from "../../depgraph"
import { glob } from "../../util/glob"
import { type FilePath, QUARTZ, joinSegments } from "../../util/path"

function isLocalFavicon(fp: FilePath): boolean {
  return fp.startsWith(`${localTroutFaviconBasenameDefault}.`)
}

export const Static: QuartzEmitterPlugin = () => ({
  name: "Static",
  getQuartzComponents() {
    return []
  },
  async getDependencyGraph({ argv, cfg }) {
    const graph = new DepGraph<FilePath>()

    const staticPath = joinSegments(QUARTZ, "static")
    const fps = await glob("**", staticPath, cfg.configuration.ignorePatterns)
    for (const fp of fps) {
      if (fp === "robots.txt" || isLocalFavicon(fp)) {
        graph.addEdge(
          joinSegments("static", fp) as FilePath,
          joinSegments(argv.output, fp) as FilePath,
        )
      } else {
        graph.addEdge(
          joinSegments("static", fp) as FilePath,
          joinSegments(argv.output, "static", fp) as FilePath,
        )
      }
    }

    return graph
  },
  async emit({ argv, cfg }): Promise<FilePath[]> {
    const staticPath = joinSegments(QUARTZ, "static")
    const fps = await glob("**", staticPath, cfg.configuration.ignorePatterns)
    const emittedFiles: FilePath[] = []

    // Copy robots.txt to root
    const robotsTxtPath = joinSegments(staticPath, "robots.txt")
    if (fs.existsSync(robotsTxtPath)) {
      await fs.promises.copyFile(robotsTxtPath, joinSegments(argv.output, "robots.txt"))
      emittedFiles.push(joinSegments(argv.output, "robots.txt") as FilePath)
    }

    // Copy all favicon files to root
    const faviconFiles = fps.filter(isLocalFavicon)
    for (const faviconFile of faviconFiles) {
      const sourcePath = joinSegments(staticPath, faviconFile)
      const destPath = joinSegments(argv.output, faviconFile)
      if (fs.existsSync(sourcePath)) {
        await fs.promises.copyFile(sourcePath, destPath)
        emittedFiles.push(destPath as FilePath)
      }
    }

    // Copy everything else to /static/
    await fs.promises.cp(staticPath, joinSegments(argv.output, "static"), {
      recursive: true,
      dereference: true,
    })

    // Add all other files to emitted files list
    emittedFiles.push(
      ...(fps
        .filter((fp) => fp !== "robots.txt" && !isLocalFavicon(fp))
        .map((fp) => joinSegments(argv.output, "static", fp)) as FilePath[]),
    )

    return emittedFiles
  },
})
