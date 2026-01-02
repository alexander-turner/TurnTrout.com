import type { Root as HTMLRoot } from "hast"
import type { Root } from "mdast"

import esbuild from "esbuild"
import path from "path"
import rehypeMermaid from "rehype-mermaid"
import remarkAttributes from "remark-attributes"
import { remarkDefinitionList, defListHastHandlers } from "remark-definition-list"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { read } from "to-vfile"
import { Processor, unified, type Plugin } from "unified"
import { visit } from "unist-util-visit"
import workerpool, { Promise as WorkerPromise } from "workerpool"

import type { ProcessedContent } from "../plugins/vfile"
import type { BuildCtx } from "../util/ctx"

import { createWinstonLogger } from "../util/log"
import { type FilePath, QUARTZ, slugifyFilePath } from "../util/path"
import { PerfTimer } from "../util/perf"
import { trace } from "../util/trace"
// @ts-expect-error: no types
const remarkCaptions = (await import("remark-captions")).default

// https://github.com/zestedesavoir/zmarkdown/issues/490
const remarkCaptionsCodeFix = () => (tree: HTMLRoot) => {
  visit(tree, "figure", (figure: Element) => {
    if ("value" in figure) {
      delete figure.value
    }
  })
}

export type QuartzProcessor = Processor<Root, Root, HTMLRoot>
export function createProcessor(ctx: BuildCtx): QuartzProcessor {
  const transformers = ctx.cfg.plugins.transformers

  return (
    unified()
      // Markdown plugins
      .use(remarkParse)
      .use(remarkAttributes as unknown as Plugin<[], Root, Root>)
      .use(
        transformers
          .filter((p) => p.markdownPlugins)
          .flatMap((plugin) => plugin.markdownPlugins?.(ctx) ?? []),
      )
      .use(remarkDefinitionList)
      .use(remarkCaptions)
      .use(remarkCaptionsCodeFix)
      .use(remarkRehype, { allowDangerousHtml: true, handlers: defListHastHandlers })
      // Rehype plugins
      .use(rehypeMermaid, {
        strategy: "inline-svg",
        mermaidConfig: {
          theme: "default",
          themeVariables: { lineColor: "var(--gray)" },
        },
        dark: {
          theme: "dark",
          themeVariables: { lineColor: "var(--gray)" },
        },
      })
      // HTML plugins
      .use(
        transformers
          .filter((p) => p.htmlPlugins)
          .flatMap((plugin) => plugin.htmlPlugins?.(ctx) ?? []),
      )
  )
}

function* chunks<T>(arr: T[], n: number) {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n)
  }
}

function transpileWorkerScript() {
  // transpile worker script
  const cacheFile = "./.quartz-cache/transpiled-worker.mjs"
  const fp = "./quartz/worker.ts"
  return esbuild.build({
    entryPoints: [fp],
    outfile: path.join(QUARTZ, cacheFile),
    bundle: true,
    keepNames: true,
    platform: "node",
    format: "esm",
    packages: "external",
    sourcemap: true,
    sourcesContent: false,
    plugins: [
      {
        name: "css-and-scripts-as-text",
        setup(build) {
          build.onLoad({ filter: /\.scss$/ }, () => ({
            contents: "",
            loader: "text",
          }))
          build.onLoad({ filter: /\.inline\.(ts|js)$/ }, () => ({
            contents: "",
            loader: "text",
          }))
        },
      },
    ],
  })
}

export function createFileParser(ctx: BuildCtx, fps: FilePath[]) {
  const { argv, cfg } = ctx
  return async (processor: QuartzProcessor) => {
    const res: ProcessedContent[] = []
    for (const fp of fps) {
      try {
        const perf = new PerfTimer()
        const file = await read(fp)

        // strip leading and trailing whitespace
        file.value = file.value.toString().trim()

        // Text -> Text transforms
        for (const plugin of cfg.plugins.transformers.filter((p) => p.textTransform)) {
          file.value = plugin.textTransform?.(ctx, file.value.toString()) ?? file.value
        }

        // base data properties that plugins may use
        file.data.filePath = file.path as FilePath
        file.data.relativePath = path.posix.relative(argv.directory, file.path) as FilePath
        file.data.slug = slugifyFilePath(file.data.relativePath)

        const ast = processor.parse(file)
        const newAst = await processor.run(ast, file)
        res.push([newAst, file])

        if (argv.verbose) {
          console.log(`[process] ${fp} -> ${file.data.slug} (${perf.timeSince()})`)
        }
      } catch (err) {
        trace(`\nFailed to process \`${fp}\``, err as Error)
      }
    }

    return res
  }
}

const clamp = (num: number, min: number, max: number) =>
  Math.min(Math.max(Math.round(num), min), max)
export async function parseMarkdown(ctx: BuildCtx, fps: FilePath[]): Promise<ProcessedContent[]> {
  const { argv } = ctx
  const perf = new PerfTimer()
  const log = createWinstonLogger("parse")

  // rough heuristics: 128 gives enough time for v8 to JIT and optimize parsing code paths
  const CHUNK_SIZE = 128
  const concurrency = ctx.argv.concurrency ?? clamp(fps.length / CHUNK_SIZE, 1, 4)

  let res: ProcessedContent[] = []
  log.info(`Parsing input files using ${concurrency} threads`)
  if (concurrency === 1) {
    const processor = createProcessor(ctx)
    const parse = createFileParser(ctx, fps)
    res = await parse(processor)
  } else {
    await transpileWorkerScript()
    const pool = workerpool.pool("./quartz/bootstrap-worker.mjs", {
      minWorkers: "max",
      maxWorkers: concurrency,
      workerType: "thread",
    })

    const childPromises: WorkerPromise<ProcessedContent[]>[] = []
    for (const chunk of chunks(fps, CHUNK_SIZE)) {
      childPromises.push(pool.exec("parseFiles", [argv, chunk, ctx.allSlugs]))
    }

    const results: ProcessedContent[][] = await WorkerPromise.all(childPromises).catch((err) => {
      const errString = err.toString().slice("Error:".length)
      throw new Error(errString)
    })
    res = results.flat()
    await pool.terminate()
  }

  log.info(`Parsed ${res.length} Markdown files in ${perf.timeSince()}`)
  return res
}
