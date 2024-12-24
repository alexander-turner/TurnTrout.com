import { intro, outro, select, text } from "@clack/prompts"
import { Mutex } from "async-mutex"
import chalk from "chalk"
import { load as cheerioLoad } from "cheerio"
import { execSync, spawnSync } from "child_process"
import chokidar from "chokidar"
import CleanCSS from "clean-css"
import { generate } from "critical"
import { randomUUID } from "crypto"
import { context, build as esBuild, analyzeMetafile } from "esbuild"
import { sassPlugin } from "esbuild-sass-plugin"
import fs, { promises } from "fs"
import glob from "glob-promise"
import http from "http"
import path from "path"
import prettyBytes from "pretty-bytes"
import { rimraf } from "rimraf"
import serveHandler from "serve-handler"
import { WebSocketServer } from "ws"

import {
  UPSTREAM_NAME,
  QUARTZ_SOURCE_BRANCH,
  ORIGIN_NAME,
  version,
  fp,
  cacheFile,
  cwd,
} from "./constants.js"
import {
  exitIfCancel,
  escapePath,
  gitPull,
  popContentFolder,
  stashContentFolder,
} from "./helpers.js"

let cachedCriticalCSS = ""

/**
 * Handles `npx quartz create`
 * @param {*} argv arguments for `create`
 */
export async function handleCreate(argv) {
  console.log()
  intro(chalk.bgGreen.black(` turntrout.com v${version} `))
  const contentFolder = path.join(cwd, argv.directory)
  let setupStrategy = argv.strategy?.toLowerCase()
  let linkResolutionStrategy = argv.links?.toLowerCase()
  const sourceDirectory = argv.source

  // If all cmd arguments were provided, check if theyre valid
  if (setupStrategy && linkResolutionStrategy) {
    // If setup isn't, "new", source argument is required
    if (setupStrategy !== "new") {
      // Error handling
      if (!sourceDirectory) {
        throw new Error(
          "Setup strategies other than 'new' require content folder argument to be set",
        )
      } else {
        if (!fs.existsSync(sourceDirectory)) {
          throw new Error(
            `Input directory to copy/symlink 'content' from not found ('${sourceDirectory}')`,
          )
        } else if (!fs.lstatSync(sourceDirectory).isDirectory()) {
          throw new Error(
            `Source directory to copy/symlink 'content' from is not a directory (found file at '${sourceDirectory}')`,
          )
        }
      }
    }
  }

  // Use cli process if cmd args werent provided
  if (!setupStrategy) {
    setupStrategy = exitIfCancel(
      await select({
        message: `Choose how to initialize the content in \`${contentFolder}\``,
        options: [
          { value: "new", label: "Empty Quartz" },
          { value: "copy", label: "Copy an existing folder", hint: "overwrites `content`" },
          {
            value: "symlink",
            label: "Symlink an existing folder",
            hint: "don't select this unless you know what you are doing!",
          },
        ],
      }),
    )
  }

  async function rmContentFolder() {
    const contentStat = await fs.promises.lstat(contentFolder)
    if (contentStat.isSymbolicLink()) {
      await fs.promises.unlink(contentFolder)
    } else {
      await rimraf(contentFolder)
    }
  }

  const gitkeepPath = path.join(contentFolder, ".gitkeep")
  if (fs.existsSync(gitkeepPath)) {
    await fs.promises.unlink(gitkeepPath)
  }
  if (setupStrategy === "copy" || setupStrategy === "symlink") {
    let originalFolder = sourceDirectory

    // If input directory was not passed, use cli
    if (!sourceDirectory) {
      originalFolder = escapePath(
        exitIfCancel(
          await text({
            message: "Enter the full path to existing content folder",
            placeholder:
              "On most terminal emulators, you can drag and drop a folder into the window and it will paste the full path",
            validate(filepath) {
              const fullPath = escapePath(filepath)
              if (!fs.existsSync(fullPath)) {
                return "The given path doesn't exist"
              } else if (!fs.lstatSync(fullPath).isDirectory()) {
                return "The given path is not a folder"
              } else {
                return null
              }
            },
          }),
        ),
      )
    }

    await rmContentFolder()
    if (setupStrategy === "copy") {
      await fs.promises.cp(originalFolder, contentFolder, {
        recursive: true,
        preserveTimestamps: true,
      })
    } else if (setupStrategy === "symlink") {
      await fs.promises.symlink(originalFolder, contentFolder, "dir")
    }
  } else if (setupStrategy === "new") {
    await fs.promises.writeFile(
      path.join(contentFolder, "index.md"),
      `---
title: Welcome to Quartz
---

This is a blank Quartz installation.
See the [documentation](https://quartz.jzhao.xyz) for how to get started.
`,
    )
  }

  // Use cli process if cmd args werent provided
  if (!linkResolutionStrategy) {
    // get a preferred link resolution strategy
    linkResolutionStrategy = exitIfCancel(
      await select({
        message:
          "Choose how Quartz should resolve links in your content. This should match Obsidian's link format. You can change this later in `quartz.config.ts`.",
        options: [
          {
            value: "shortest",
            label: "Treat links as shortest path",
            hint: "(default)",
          },
          {
            value: "absolute",
            label: "Treat links as absolute path",
          },
          {
            value: "relative",
            label: "Treat links as relative paths",
          },
        ],
      }),
    )
  }

  // now, do config changes
  const configFilePath = path.join(cwd, "quartz.config.ts")
  let configContent = await fs.promises.readFile(configFilePath, { encoding: "utf-8" })
  configContent = configContent.replace(
    /markdownLinkResolution: '(.+)'/,
    `markdownLinkResolution: '${linkResolutionStrategy}'`,
  )
  await fs.promises.writeFile(configFilePath, configContent)

  // setup remote
  execSync(
    "git remote show upstream || git remote add upstream https://github.com/jackyzha0/quartz.git",
    { stdio: "ignore" },
  )

  outro(`You're all set! Not sure what to do next? Try:
  • Customizing Quartz a bit more by editing \`quartz.config.ts\`
  • Running \`npx quartz build --serve\` to preview your Quartz locally
  • Hosting your Quartz online (see: https://quartz.jzhao.xyz/hosting)
`)
}

/**
 * Handles `npx quartz build`
 * @param {*} argv arguments for `build`
 */
export async function handleBuild(argv) {
  console.log(chalk.bgGreen.black(`\n turntrout.com v${version} \n`))
  const ctx = await context({
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
    sourcemap: false,
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
            let pathText = await promises.readFile(args.path, "utf8")

            // remove default exports that we manually inserted
            pathText = pathText.replace("export default", "")
            pathText = pathText.replace("export", "")

            const sourcefile = path.relative(path.resolve("."), args.path)
            const resolveDir = path.dirname(sourcefile)
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
            const rawMod = transpiled.outputFiles[0].text
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
  let cleanupBuild = null
  const build = async (clientRefresh) => {
    const buildStart = new Date().getTime()
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

    const result = await ctx.rebuild().catch((err) => {
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
      // empty because function is a callback placeholder
    })
    await ctx.dispose()

    const allHtmlFiles = await glob(`${argv.output}/**/*.html`, {
      recursive: true,
      posix: true,
    })
    await injectCriticalCSSIntoHTMLFiles(allHtmlFiles, argv.output)

    return
  }

  const connections = []
  const clientRefresh = async () => {
    connections.forEach((conn) => conn.send("rebuild"))

    // Inline the critical CSS
    const allHtmlFiles = await glob(`${argv.output}/**/*.html`, {
      recursive: true,
      posix: true,
    })

    await injectCriticalCSSIntoHTMLFiles(allHtmlFiles, argv.output)
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

    // strip baseDir prefix
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
      const status = res.statusCode
      const statusString =
        status >= 200 && status < 300 ? chalk.green(`[${status}]`) : chalk.red(`[${status}]`)
      console.log(statusString + chalk.grey(` ${argv.baseDir}${req.url}`))
      release()
    }

    const redirect = (newFp) => {
      newFp = argv.baseDir + newFp
      res.writeHead(302, {
        Location: newFp,
      })
      console.log(chalk.yellow("[302]") + chalk.grey(` ${argv.baseDir}${req.url} -> ${newFp}`))
      res.end()
    }

    const filepath = req.url?.split("?")[0] ?? "/"

    // handle redirects
    if (filepath.endsWith("/")) {
      // /trailing/
      // does /trailing/index.html exist? if so, serve it
      const indexFp = path.posix.join(filepath, "index.html")
      if (fs.existsSync(path.posix.join(argv.output, indexFp))) {
        req.url = filepath
        return serve()
      }

      // does /trailing.html exist? if so, redirect to /trailing
      let base = filepath.slice(0, -1)
      if (path.extname(base) === "") {
        base += ".html"
      }
      if (fs.existsSync(path.posix.join(argv.output, base))) {
        return redirect(filepath.slice(0, -1))
      }
    } else {
      // /regular
      // does /regular.html exist? if so, serve it
      let base = filepath
      if (path.extname(base) === "") {
        base += ".html"
      }
      if (fs.existsSync(path.posix.join(argv.output, base))) {
        req.url = filepath
        return serve()
      }

      // does /regular/index.html exist? if so, redirect to /regular/
      const indexFp = path.posix.join(filepath, "index.html")
      if (fs.existsSync(path.posix.join(argv.output, indexFp))) {
        return redirect(`${filepath}/`)
      }
    }

    return serve()
  })

  server.listen(argv.port)
  const wss = new WebSocketServer({ port: argv.wsPort })
  wss.on("connection", (ws) => connections.push(ws))
  console.log(
    chalk.cyan(
      `Started a turntrout.com server listening at http://localhost:${argv.port}${argv.baseDir}`,
    ),
  )
  console.log("hint: exit with ctrl+c")
  chokidar
    .watch(["**/*.ts", "**/*.tsx", "**/*.scss", "package.json"], {
      ignoreInitial: true,
      ignored: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    })
    .on("all", async () => {
      await build(clientRefresh)
    })
}

async function maybeGenerateCriticalCSS(outputDir) {
  if (cachedCriticalCSS !== "") {
    return
  }
  console.log("Computing and caching critical CSS...")
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
        penthouse: {
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
      },
    })

    // Append essential theme variables
    const themeCSS = `
      a {
        color: var(--color-link);
      }
      a:visited {
        color: color-mix(in srgb,currentcolor 50%,var(--color-link));
      }
      article[data-use-dropcap="true"] {
        --dropcap-vertical-offset: 0.15rem;
        --dropcap-font-size: 3.95rem;

            & > p:first-of-type {
              position: relative;
              min-height: 4.2rem;
            }

            & > p:first-of-type::before {
          content: attr(data-first-letter);
          text-transform: uppercase;
          position: absolute;
          top: var(--dropcap-vertical-offset);
          left: 0;
          font-size: var(--dropcap-font-size);
          line-height: 1;
          padding-right: 0.1em;
          font-family: "EBGaramondInitialsF2", serif;
        }

        & > p:first-of-type::first-letter {
          padding-top: var(--dropcap-vertical-offset);
          text-transform: uppercase;
          font-style: normal !important;
          float: left;
          color: var(--lightgray);
          font-size: var(--dropcap-font-size);
          line-height: 1;
          padding-right: 0.1em;
          font-family: "EBGaramondInitialsF1", serif;
          font-weight: 500 !important;
        }
      }

      :root[saved-theme="dark"],
      .dark-mode {
        --light: #303446;
        --dark: #c6d0f5;
        --red: #de585a;
        --green: #a6d189;
        --blue: #8caaee;
      }
      :root[saved-theme="light"],
      .light-mode {
        --light: #eff1f5;
        --dark: #4c4f69;
        --red: #be415c;
        --green: #40a02b;
        --blue: #406ecc;
      }
      `
    const minifiedCSS = new CleanCSS().minify(css + themeCSS).styles
    cachedCriticalCSS = minifiedCSS
    console.log("Cached critical CSS with theme variables")
  } catch (error) {
    console.error("Error generating critical CSS:", error)
    cachedCriticalCSS = ""
  }
}

function styleWithId(id) {
  return (_i, el) => el.tagName === "style" && el.attribs.id === id
}

// Sort <head> contents so that Slack unfurls the page with the right info
function reorderHead(htmlContent) {
  const querier = cheerioLoad(htmlContent)
  const head = querier("head")
  const originalChildCount = head.children().length

  // Separate <meta>, <title>, and other tags
  const headChildren = head.children()

  const isDarkModeScript = (_i, el) =>
    el.tagName === "script" && el.attribs.id === "detect-dark-mode"
  const darkModeScript = headChildren.filter(isDarkModeScript)

  const metaAndTitle = headChildren.filter(
    (_i, el) => el.tagName === "meta" || el.tagName === "title",
  )

  const isCriticalCSS = styleWithId("critical-css")
  const criticalCSS = headChildren.filter(isCriticalCSS)

  // Links cause firefox FOUC, so we need to move them before scripts
  const isLink = (_i, el) => el.tagName === "link"
  const links = headChildren.filter(isLink)

  const otherElements = headChildren.filter(
    (_i, el) =>
      el.tagName !== "meta" &&
      el.tagName !== "title" &&
      !isCriticalCSS(_i, el) &&
      !isLink(_i, el) &&
      !isDarkModeScript(_i, el),
  )

  // Clear the head and re-append elements in desired order
  head.empty()

  // Goes first to prevent FOUC
  head.append(darkModeScript)
  // Ensure metadata compatibility across platforms
  head.append(metaAndTitle)

  // Append the critical CSS styles
  head.append(criticalCSS)

  // Append links to CSS stylesheets immediately after
  head.append(links)

  // Append any other elements (e.g., scripts)
  head.append(otherElements)

  // Check if the number of children hasn't changed
  const finalChildCount = head.children().length
  if (originalChildCount !== finalChildCount) {
    throw new Error(
      `Head reordering changed number of elements: ${originalChildCount} -> ${finalChildCount}`,
    )
  }

  return querier.html()
}

/**
 * Handles `npx quartz update`
 * @param {*} argv arguments for `update`
 */
export async function handleUpdate(argv) {
  const contentFolder = path.join(cwd, argv.directory)
  console.log(chalk.bgGreen.black(`\n turntrout.com v${version} \n`))
  console.log("Backing up your content")
  execSync(
    "git remote show upstream || git remote add upstream https://github.com/jackyzha0/quartz.git",
  )
  await stashContentFolder(contentFolder)
  console.log(
    "Pulling updates... you may need to resolve some `git` conflicts if you've made changes to components or plugins.",
  )

  try {
    gitPull(UPSTREAM_NAME, QUARTZ_SOURCE_BRANCH)
  } catch {
    console.log(chalk.red("An error occurred above while pulling updates."))
    await popContentFolder(contentFolder)
    return
  }

  await popContentFolder(contentFolder)
  console.log("Ensuring dependencies are up to date")
  const res = spawnSync("npm", ["i"], { stdio: "inherit" })
  if (res.status === 0) {
    console.log(chalk.green("Done!"))
  } else {
    console.log(chalk.red("An error occurred above while installing dependencies."))
  }
}

/**
 * Handles `npx quartz restore`
 * @param {*} argv arguments for `restore`
 */
export async function handleRestore(argv) {
  const contentFolder = path.join(cwd, argv.directory)
  await popContentFolder(contentFolder)
}

/**
 * Handles `npx quartz sync`
 * @param {*} argv arguments for `sync`
 */
export async function handleSync(argv) {
  const contentFolder = path.join(cwd, argv.directory)
  console.log(chalk.bgGreen.black(`\n turntrout.com v${version} \n`))
  console.log("Backing up your content")

  if (argv.commit) {
    const contentStat = await fs.promises.lstat(contentFolder)
    if (contentStat.isSymbolicLink()) {
      const linkTarg = await fs.promises.readlink(contentFolder)
      console.log(chalk.yellow("Detected symlink, trying to dereference before committing"))

      // stash symlink file
      await stashContentFolder(contentFolder)

      // follow symlink and copy content
      await fs.promises.cp(linkTarg, contentFolder, {
        recursive: true,
        preserveTimestamps: true,
      })
    }

    const currentTimestamp = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    })
    const commitMessage = argv.message ?? `turntrout.com sync: ${currentTimestamp}`
    spawnSync("git", ["add", "."], { stdio: "inherit" })
    spawnSync("git", ["commit", "-m", commitMessage], { stdio: "inherit" })

    if (contentStat.isSymbolicLink()) {
      // put symlink back
      await popContentFolder(contentFolder)
    }
  }

  await stashContentFolder(contentFolder)

  if (argv.pull) {
    console.log(
      "Pulling updates from your repository. You may need to resolve some `git` conflicts if you've made changes to components or plugins.",
    )
    try {
      gitPull(ORIGIN_NAME, QUARTZ_SOURCE_BRANCH)
    } catch {
      console.log(chalk.red("An error occurred above while pulling updates."))
      await popContentFolder(contentFolder)
      return
    }
  }

  await popContentFolder(contentFolder)
  if (argv.push) {
    console.log("Pushing your changes")
    const res = spawnSync("git", ["push", "-uf", ORIGIN_NAME, QUARTZ_SOURCE_BRANCH], {
      stdio: "inherit",
    })
    if (res.status !== 0) {
      console.log(chalk.red(`An error occurred above while pushing to remote ${ORIGIN_NAME}.`))
      return
    }
  }

  console.log(chalk.green("Done!"))
}

export async function injectCriticalCSSIntoHTMLFiles(htmlFiles, outputDir) {
  await maybeGenerateCriticalCSS(outputDir)

  let processedCount = 0
  for (const file of htmlFiles) {
    try {
      const htmlContent = await fs.promises.readFile(file, "utf-8")
      const querier = cheerioLoad(htmlContent)

      // Remove existing critical CSS
      querier("style#critical-css").remove()

      // Insert the new critical CSS at the end of the head
      const styleTag = `<style id="critical-css">${cachedCriticalCSS}</style>`
      querier("head").append(styleTag)

      // Reorder the head elements if needed
      const updatedHTML = reorderHead(querier.html())

      await fs.promises.writeFile(file, updatedHTML)
      processedCount++
    } catch (err) {
      console.warn(`Warning: Could not process ${file}: ${err.message}`)
      continue
    }
  }

  console.log(`Injected critical CSS into ${processedCount} files`)
}
