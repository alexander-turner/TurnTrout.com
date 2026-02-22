import fs from "fs"

import type { QuartzEmitterPlugin } from "../types"

import { localTroutFaviconBasenameDefault, simpleConstants } from "../../components/constants"
import DepGraph from "../../depgraph"
import { glob } from "../../util/glob"
import { type FilePath, QUARTZ, joinSegments } from "../../util/path"

export function isLocalFavicon(fp: FilePath): boolean {
  return fp.startsWith(`${localTroutFaviconBasenameDefault}.`)
}

// Files that should be copied to root instead of /static/
export const ROOT_FILES = ["robots.txt", "_headers", "_redirects"]

export function shouldCopyToRoot(fp: FilePath): boolean {
  return ROOT_FILES.includes(fp) || isLocalFavicon(fp)
}

/**
 * Build esbuild `define` map that injects constants from constants.json
 * into static scripts at build time. This eliminates the need for static
 * scripts to hardcode values that also appear in constants.json.
 *
 * Identifiers in scripts (e.g., `SAVED_THEME_KEY`) get replaced with the
 * actual string/array values at build time.
 */
export function buildStaticScriptDefines(): Record<string, string> {
  return {
    SAVED_THEME_KEY: JSON.stringify(simpleConstants.savedThemeKey),
    AUTOPLAY_STORAGE_KEY: JSON.stringify(simpleConstants.autoplayStorageKey),
    INSTANT_SCROLL_RESTORE_KEY: JSON.stringify(simpleConstants.instantScrollRestoreKey),
    DROPCAP_COLORS: JSON.stringify(simpleConstants.dropcapColors),
    COLOR_DROPCAP_PROBABILITY: JSON.stringify(simpleConstants.colorDropcapProbability),
  }
}

/**
 * Process a static script through esbuild, replacing build-time constant
 * identifiers with their actual values from constants.json.
 */
async function processStaticScript(source: string): Promise<string> {
  // Dynamic import avoids esbuild's Buffer invariant check at module load
  // time, which fails in Jest's test environment.
  const { transform } = await import("esbuild")
  const result = await transform(source, {
    define: buildStaticScriptDefines(),
    // Don't minify — these scripts must remain readable for debugging
  })
  return result.code
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
      if (shouldCopyToRoot(fp)) {
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

    // Copy root files (_headers, _redirects, robots.txt) to output root
    for (const rootFile of ROOT_FILES) {
      const sourcePath = joinSegments(staticPath, rootFile)
      if (fs.existsSync(sourcePath)) {
        await fs.promises.copyFile(sourcePath, joinSegments(argv.output, rootFile))
        emittedFiles.push(joinSegments(argv.output, rootFile) as FilePath)
      }
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

    // Copy everything else to /static/, excluding test files
    await fs.promises.cp(staticPath, joinSegments(argv.output, "static"), {
      recursive: true,
      dereference: true,
      filter: (source: string) => !source.endsWith(".test.ts") && !source.endsWith(".test.js"),
    })

    // Process static scripts: inject build-time constants via esbuild define
    const scriptDir = joinSegments(argv.output, "static", "scripts")
    const scriptFiles = fps.filter((fp) => fp.startsWith("scripts/") && fp.endsWith(".js"))
    for (const scriptFile of scriptFiles) {
      const outputPath = joinSegments(scriptDir, scriptFile.slice("scripts/".length))
      const source = await fs.promises.readFile(outputPath, "utf-8")
      const processed = await processStaticScript(source)
      await fs.promises.writeFile(outputPath, processed)
    }

    // Add all other files to emitted files list
    emittedFiles.push(
      ...(fps
        .filter((fp) => !shouldCopyToRoot(fp))
        .map((fp) => joinSegments(argv.output, "static", fp)) as FilePath[]),
    )

    return emittedFiles
  },
})
