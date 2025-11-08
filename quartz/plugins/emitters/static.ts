import fs from "fs"

import type { QuartzEmitterPlugin } from "../types"

import { localTroutFaviconBasename } from "../../components/constants"
import DepGraph from "../../depgraph"
import { glob } from "../../util/glob"
import { type FilePath, QUARTZ, joinSegments } from "../../util/path"

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
      if (fp === "robots.txt" || fp === localTroutFaviconBasename) {
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

    // Copy favicon.svg to root
    const faviconPath = joinSegments(staticPath, "favicon.svg")
    if (fs.existsSync(faviconPath)) {
      await fs.promises.copyFile(faviconPath, joinSegments(argv.output, "favicon.svg"))
      emittedFiles.push(joinSegments(argv.output, "favicon.svg") as FilePath)
    }

    // Copy everything else to /static/
    await fs.promises.cp(staticPath, joinSegments(argv.output, "static"), {
      recursive: true,
      dereference: true,
    })

    // Add all other files to emitted files list
    emittedFiles.push(
      ...(fps
        .filter((fp) => !(fp === "robots.txt" || fp === "favicon.svg"))
        .map((fp) => joinSegments(argv.output, "static", fp)) as FilePath[]),
    )

    return emittedFiles
  },
})
