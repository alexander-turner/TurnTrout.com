import type { CheerioAPI } from "cheerio"
import type { Element as CheerioElement } from "domhandler"

import { Mutex } from "async-mutex"
import chalk from "chalk"
import { load as cheerioLoad } from "cheerio"
import { watch } from "chokidar"
// @ts-expect-error no critical types
import { generate } from "critical"
import { randomUUID } from "crypto"
import { context, build as esBuild, analyzeMetafile } from "esbuild"
import { sassPlugin } from "esbuild-sass-plugin"
import fs, { promises as fsPromises } from "fs"
import http from "http"
import { type Context } from "node:vm"
import path from "path"
import prettyBytes from "pretty-bytes"
import serveHandler from "serve-handler"
import { WebSocketServer, type WebSocket } from "ws"

// Import the generate function
import { generateScss } from "../styles/generate-variables"
import {
  version,
  fp,
  cacheFile, // @ts-expect-error Importing from a JS file, no types
} from "./constants.js"

interface BuildArguments {
  serve?: boolean
  bundleInfo?: boolean
  output: string
  baseDir: string
  port: number
  wsPort: number
}
let cachedCriticalCSS = ""

/**
 * Handles `npx quartz build`
 * @param argv - Arguments for the build command
 */
export async function handleBuild(argv: BuildArguments): Promise<void> {
  console.log(chalk.bgGreen.black(`\n turntrout.com v${version} \n`))

  // Generate SCSS variables before building
  console.log(chalk.blue("Generating SCSS variables..."))
  generateScss()
  console.log(chalk.green("SCSS variables generated successfully!"))

  const ctx: Context = await context({
    entryPoints: [fp],
    outfile: cacheFile,
    bundle: true,
    keepNames: true,
    minifyWhitespace: true,
    minifySyntax: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    jsxImportSource: "preact",
    packages: "external",
    metafile: true,
    sourcemap: true,
    sourcesContent: false,
    plugins: [
      sassPlugin({
        type: "css-text",
        cssImports: true,
      }),
      {
        name: "inline-script-loader",
        setup(build) {
          build.onLoad({ filter: /\.inline\.(ts|js)$/ }, async (args) => {
            let pathText: string = await fsPromises.readFile(args.path, "utf8")

            // Remove default exports that we manually inserted
            pathText = pathText.replace("export default", "")
            pathText = pathText.replace("export", "")

            const sourcefile: string = path.relative(path.resolve("."), args.path)
            const resolveDir: string = path.dirname(sourcefile)
            const transpiled = await esBuild({
              stdin: {
                contents: pathText,
                loader: "ts",
                resolveDir,
                sourcefile,
              },
              write: false,
              bundle: true,
              minify: true,
              platform: "browser",
              format: "esm",
            })
            const rawMod: string = transpiled.outputFiles[0].text
            return {
              contents: rawMod,
              loader: "text",
            }
          })
        },
      },
    ],
  })

  const buildMutex = new Mutex()
  let lastBuildMs = 0
  let cleanupBuild: (() => Promise<void>) | null = null

  const build = async (clientRefresh: () => void): Promise<void> => {
    const buildStart = Date.now()
    lastBuildMs = buildStart
    const release = await buildMutex.acquire()
    if (lastBuildMs > buildStart) {
      release()
      return
    }

    if (cleanupBuild) {
      await cleanupBuild()
      console.log(chalk.yellow("Detected a source code change, doing a hard rebuild..."))
    }

    const result = await ctx.rebuild().catch((err: Error) => {
      throw new Error(`Couldn't parse turntrout.com configuration: ${fp}\nReason: ${err}`)
    })
    release()

    if (argv.bundleInfo) {
      const outputFileName = "quartz/.quartz-cache/transpiled-build.mjs"
      const meta = result.metafile.outputs[outputFileName]
      console.log(
        `Successfully transpiled ${Object.keys(meta.inputs).length} files (${prettyBytes(
          meta.bytes,
        )})`,
      )
      console.log(await analyzeMetafile(result.metafile, { color: true }))
    }

    // Construct the module path dynamically
    const modulePath = `../../${cacheFile}?update=${randomUUID()}`

    // Use the dynamically constructed path in the import statement
    const { default: buildQuartz } = await import(modulePath)

    cleanupBuild = await buildQuartz(argv, buildMutex, clientRefresh)

    clientRefresh()
  }

  if (!argv.serve) {
    await build(() => {
      // Callback placeholder
    })
    await ctx.dispose()
    return
  }

  const connections: WebSocket[] = []
  const clientRefresh = (): void => {
    connections.forEach((conn) => conn.send("rebuild"))
  }

  if (argv.baseDir !== "" && !argv.baseDir.startsWith("/")) {
    argv.baseDir = `/${argv.baseDir}`
  }

  await build(clientRefresh)

  const server = http.createServer((req, res) => {
    if (argv.baseDir && !req.url?.startsWith(argv.baseDir)) {
      console.log(
        chalk.red(`[404] ${req.url} (warning: link outside of site, this is likely a Quartz bug)`),
      )
      res.writeHead(404)
      res.end()
      return
    }

    // Strip baseDir prefix
    req.url = req.url?.slice(argv.baseDir.length)

    const serve = async () => {
      const release = await buildMutex.acquire()
      await serveHandler(req, res, {
        public: argv.output,
        directoryListing: false,
        headers: [
          {
            source: "**/*.*",
            headers: [{ key: "Content-Disposition", value: "inline" }],
          },
        ],
      })
      const status: number = res.statusCode
      const statusString: string =
        status >= 200 && status < 300 ? chalk.green(`[${status}]`) : chalk.red(`[${status}]`)
      console.log(statusString + chalk.grey(` ${argv.baseDir}${req.url}`))
      release()
    }

    const redirect = (newFp: string) => {
      newFp = argv.baseDir + newFp
      res.writeHead(302, {
        Location: newFp,
      })
      console.log(chalk.yellow("[302]") + chalk.grey(` ${argv.baseDir}${req.url} -> ${newFp}`))
      res.end()
      return true
    }

    const filepath: string = req.url?.split("?")[0] ?? "/"

    // Handle redirects
    if (filepath.endsWith("/")) {
      // Does /trailing/index.html exist? If so, serve it
      const indexFp: string = path.posix.join(filepath, "index.html")
      if (fs.existsSync(path.posix.join(argv.output, indexFp))) {
        req.url = filepath
        serve()
        return
      }

      // Does /trailing.html exist? If so, redirect to /trailing
      let base: string = filepath.slice(0, -1)
      if (path.extname(base) === "") {
        base += ".html"
      }
      if (fs.existsSync(path.posix.join(argv.output, base))) {
        if (redirect(filepath.slice(0, -1))) return
      }
    } else {
      // Does /regular.html exist? If so, serve it
      let base: string = filepath
      if (path.extname(base) === "") {
        base += ".html"
      }
      if (fs.existsSync(path.posix.join(argv.output, base))) {
        req.url = filepath
        serve()
        return
      }

      // Does /regular/index.html exist? If so, redirect to /regular/
      const indexFp: string = path.posix.join(filepath, "index.html")
      if (fs.existsSync(path.posix.join(argv.output, indexFp))) {
        if (redirect(`${filepath}/`)) return
      }
    }

    serve()
  })

  server.listen(argv.port)
  const wss = new WebSocketServer({ port: argv.wsPort })
  wss.on("connection", (ws: WebSocket) => connections.push(ws))
  console.log(
    chalk.cyan(
      `Started a turntrout.com server listening at http://localhost:${argv.port}${argv.baseDir}`,
    ),
  )
  console.log("Hint: exit with Ctrl+C")

  watch(["**/*.ts", "**/*.tsx", "**/*.scss", "package.json"], {
    ignoreInitial: true,
    ignored: [
      "**/test/**",
      "**/tests/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
    ],
  }).on("all", async (_event, fp) => {
    if (fp.endsWith(".scss")) {
      cachedCriticalCSS = ""
      console.log(chalk.yellow("SCSS change detected, invalidating critical CSS cache."))
    }
    await build(clientRefresh)
  })
}

export const loadSettings = {
  xml: false,
  decodeEntities: false,
  _useHtmlParser2: true,
}
/**
 * Handles critical CSS injection into HTML files
 * Prevents emitting files until critical CSS is successfully generated
 * @param htmlFiles - Array of HTML file paths
 * @param outputDir - Output directory path
 */
export async function injectCriticalCSSIntoHTMLFiles(
  htmlFiles: string[],
  outputDir: string,
): Promise<void> {
  await maybeGenerateCriticalCSS(outputDir)

  if (!cachedCriticalCSS) {
    throw new Error("Critical CSS generation failed. Build aborted.")
  }

  for (const file of htmlFiles) {
    try {
      const htmlContent: string = await fsPromises.readFile(file, "utf-8")
      const querier = cheerioLoad(htmlContent, loadSettings)

      // Remove existing critical CSS
      querier("style#critical-css").remove()

      // Insert the new critical CSS at the end of the head
      const styleTag = `<style id="critical-css">${cachedCriticalCSS}</style>`
      querier("head").append(styleTag)

      // Reorder the head elements if needed
      const updatedQuerier: CheerioAPI = reorderHead(querier)

      await fsPromises.writeFile(file, updatedQuerier.html(loadSettings))
    } catch (err) {
      console.warn(`Warning: Could not process ${file}: ${err}`)
      continue
    }
  }
}
const themeCSS = `
:root {
  font-family: var(--font-main);
}
#navbar-left h2 {
  color: var(--midground);
}
code,
pre {
  font-family: var(--font-monospace);
}
a {
  color: var(--color-link);
}
a:visited {
  color: color-mix(in srgb,currentcolor 50%,var(--color-link));
}
article[data-use-dropcap="true"] {
  --dropcap-vertical-offset: 0.15rem;
  --dropcap-font-size: 3.95rem;
  --before-color: var(--midground-faint);
  --font-italic-situational: var(--font-italic);
  --font-dropcap-foreground: 'EBGaramondInitialsF2__subset', "EBGaramondInitialsF2",serif;
  --font-dropcap-background: 'EBGaramondInitialsF1__subset', "EBGaramondInitialsF1",serif;
}

article[data-use-dropcap="true"] > p:first-of-type {
    position: relative;
    min-height: 4.2rem;
}
article[data-use-dropcap="true"] > p:first-of-type::before {
    content: attr(data-first-letter);
    text-transform: uppercase;
    position: absolute;
    top: var(--dropcap-vertical-offset);
    left: 0;
    font-size: var(--dropcap-font-size);
    line-height: 1;
    padding-right: 0.1em;
    font-family: var(--font-dropcap-background);
    color: var(--before-color);
}
article[data-use-dropcap="true"] > p:first-of-type::first-letter {
    padding-top: var(--dropcap-vertical-offset);
    text-transform: uppercase;
    font-style: normal !important;
    float: left;
    color: var(--foreground);
    font-size: var(--dropcap-font-size);
    width: var(--dropcap-font-size);
    line-height: 1;
    padding-right: 0.1em;
    font-family: var(--font-dropcap-foreground), "EBGaramondInitialsF2", serif;
    font-weight: 500 !important;
}
article[data-use-dropcap="true"] > p:first-of-type::first-line {
      --font-italic-situational: var(--font-main) !important;
}
em {
  font-family: var(--font-italic-situational);
}
:root[saved-theme="dark"],
.dark-mode {
  --background: #303446;
  --foreground: #c6d0f5;
  --red: #de585a;
  --green: #a6d189;
  --blue: #8caaee;
}
:root[saved-theme="light"],
.light-mode {
  --background: #eff1f5;
  --foreground: #4c4f69;
  --red: #be415c;
  --green: #40a02b;
  --blue: #406ecc;
}
#quartz-body {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: flex-start;
  gap: 4rem;
  margin: 0 auto;
}
#left-sidebar {
  flex-basis: 200px;
  flex-shrink: 0.25;
  margin-left: 0;
}
#right-sidebar {
  flex-basis: 330px;
  flex-shrink: 1;
  padding-right: 0;
}
#center-content {
  flex-grow: 1;
  flex-shrink: 1;
  max-width: 720px;
  overflow-x: hidden;
  width: 100%;
}
`

/**
 * Generates and caches critical CSS if not already cached
 * Throws an error if generation fails
 * @param outputDir - Output directory path
 */
export async function maybeGenerateCriticalCSS(outputDir: string): Promise<void> {
  if (cachedCriticalCSS !== "") {
    return
  }

  let attempts = 0
  const maxAttempts = 5 // Maximum number of retry attempts
  const retryDelayMs = 2000 // Delay between retries in milliseconds

  while (cachedCriticalCSS === "" && attempts < maxAttempts) {
    attempts++
    if (attempts > 1) {
      console.log(`Retrying critical CSS generation (attempt ${attempts}/${maxAttempts})...`)
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
    } else {
      console.log("Computing and caching critical CSS...")
    }

    try {
      const { css } = await generate({
        inline: false,
        base: outputDir,
        src: "index.html",
        width: 1700,
        height: 900,
        css: [
          path.join(outputDir, "index.css"),
          path.join(outputDir, "static", "styles", "katex.min.css"),
        ],
        penthouse: {
          timeout: 120000,
          blockJSRequests: false,
          waitForStatus: "networkidle0",
          renderWaitTime: 2000,
          puppeteer: {
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-accelerated-2d-canvas",
              "--disable-gpu",
            ],
          },
        },
      })

      // Append essential theme variables
      cachedCriticalCSS = css + themeCSS
      console.log("Cached critical CSS with theme variables")
    } catch (error) {
      console.error(`Error generating critical CSS (attempt ${attempts}/${maxAttempts}):`, error)
      cachedCriticalCSS = "" // Ensure it's reset on failure
      if (attempts >= maxAttempts) {
        throw new Error(`Critical CSS generation failed after ${maxAttempts} attempts.`)
      }
    }
  }
}

/**
 * Sorts <head> contents to optimize metadata and CSS loading
 * @param htmlContent - Original HTML content
 * @returns Updated HTML content with reordered <head> elements
 */
export function reorderHead(querier: CheerioAPI): CheerioAPI {
  const head = querier("head")
  const originalChildren = new Set(head.children())

  // Group <head> children by type
  const headChildren = head.children()
  // Dark mode detection script
  const isDarkModeScript = (_i: number, el: CheerioElement): boolean =>
    el.type === "script" && el.attribs.id === "detect-dark-mode"
  const darkModeScript = headChildren.filter(isDarkModeScript)

  // Meta and title tags
  const metaAndTitle = headChildren.filter(
    (_i: number, el: CheerioElement): boolean =>
      el.type === "tag" && (el.tagName === "meta" || el.tagName === "title"),
  )

  const isCriticalCSS = (_i: number, el: CheerioElement): boolean =>
    el.type === "style" && el.attribs.id === "critical-css"
  const criticalCSS = headChildren.filter(isCriticalCSS)

  // Links cause Firefox FOUC, so we need to move them before scripts
  const isLink = (_i: number, el: CheerioElement): boolean =>
    el.type === "tag" && el.tagName === "link"
  const links = headChildren.filter(isLink)

  // Anything else (scripts, etc.)
  const elementsSoFar = new Set([...darkModeScript, ...metaAndTitle, ...criticalCSS, ...links])
  const notAlreadySeen = (_i: number, el: CheerioElement): boolean => !elementsSoFar.has(el)
  const otherElements = headChildren.filter(notAlreadySeen)

  head
    .empty()
    .append(darkModeScript)
    .append(metaAndTitle)
    .append(criticalCSS)
    .append(links)
    .append(otherElements)

  // Ensure we haven't gained any child elements
  const finalChildren = new Set(head.children())
  if (!finalChildren.isSubsetOf(originalChildren)) {
    throw new Error("New elements were added to the head")
  }

  // If we've lost any elements, throw an error
  if (!finalChildren.isSupersetOf(originalChildren)) {
    const lostElements = originalChildren.difference(finalChildren)
    const lostTags: string[] = Array.from(lostElements).map(
      (el): string => (el as CheerioElement).tagName,
    )
    throw new Error(
      `Head reordering changed number of elements: ${originalChildren.size} -> ${finalChildren.size}. Specifically, the elements ${lostTags.join(", ")} were lost.`,
    )
  }

  return querier
}
