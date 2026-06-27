import type { Heading, Root as MdRoot } from "mdast"

import fs from "fs"
import path from "path"
import remarkFrontmatter from "remark-frontmatter"
import remarkParse from "remark-parse"
import { read } from "to-vfile"
import { unified } from "unified"
import { visit } from "unist-util-visit"

import type { BuildCtx } from "../util/ctx"

import { formatTitle } from "../components/component_utils"
import { normalizeNbsp } from "../components/constants"
import { titleIndexFile } from "../components/constants.server"
import { applyTextTransforms } from "../plugins/transformers/formatting_improvement_html"
import { resetSlugger, slugify } from "../plugins/transformers/gfm"
import { customToString, stripHtmlTagsFromString } from "../plugins/transformers/toc"
import { parseFrontmatter, resolveTitle } from "../util/frontmatter"
import { type FilePath, type FullSlug, slugifyFilePath } from "../util/path"

/** Live title of a page plus the live text of each of its section headings. */
export interface TargetTitles {
  title: string
  /** Heading `id` -> rendered heading text. */
  headings: ReadonlyMap<string, string>
}

export type TitleIndex = Map<FullSlug, TargetTitles>

const mdParser = unified().use(remarkParse).use(remarkFrontmatter, ["yaml", "toml"])

/**
 * Map each heading `id` to its display text, mirroring how the TOC and GFM
 * transformers derive heading ids so the keys match the anchors that
 * `@title` links resolve to. Reset the slugger per file so duplicate-heading
 * suffixes (`-1`, `-2`) are numbered per page, matching the rendered ids.
 */
export function extractHeadings(tree: MdRoot): Map<string, string> {
  const headings = new Map<string, string>()
  resetSlugger()
  visit(tree, "heading", (node: Heading) => {
    const text = applyTextTransforms(customToString(node), { useNbsp: false })
    const id = slugify(normalizeNbsp(stripHtmlTagsFromString(text)))
    headings.set(id, text)
  })
  return headings
}

/** Apply the configured markdown text transforms so the pre-pass sees the same
 * source the worker parse will. */
function applyConfiguredTextTransforms(ctx: BuildCtx, content: string): string {
  let result: string | Buffer = content
  for (const plugin of ctx.cfg.plugins.transformers.filter((p) => p.textTransform)) {
    result = plugin.textTransform?.(ctx, result.toString()) ?? result
  }
  return result.toString()
}

/** Build the slug -> {title, headings} index for the given files. */
export async function computeTitleIndex(
  ctx: BuildCtx,
  filePaths: readonly FilePath[],
): Promise<TitleIndex> {
  const index: TitleIndex = new Map()
  for (const fp of filePaths) {
    const file = await read(fp)
    const transformed = applyConfiguredTextTransforms(ctx, file.value.toString().trim())

    const data = parseFrontmatter(transformed)
    const stem = path.basename(fp, path.extname(fp))
    const title = formatTitle(resolveTitle(data, stem))

    const tree = mdParser.parse(transformed) as MdRoot
    const slug = slugifyFilePath(path.posix.relative(ctx.argv.directory, fp) as FilePath)
    const target: TargetTitles = { title, headings: extractHeadings(tree) }
    // Key by the filename slug plus every permalink/alias, because a link's
    // resolved `data-slug` is whichever path the author wrote (often a permalink
    // that differs from the filename). `aliases.ts` serves all of them.
    for (const key of [slug, ...permalinkKeys(data)]) {
      if (!index.has(key)) index.set(key, target)
    }
  }
  return index
}

/** Stripped permalink + alias paths a page is also served at. */
function permalinkKeys(data: Record<string, unknown>): FullSlug[] {
  const raw = [data.permalink, ...(Array.isArray(data.aliases) ? data.aliases : [data.aliases])]
  return raw
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map((v) => v.replace(/^\/+/, "").replace(/\/+$/, "") as FullSlug)
}

/** Serialize the index to its cache file (atomically, via a temp file). */
export async function writeTitleIndex(index: TitleIndex): Promise<void> {
  const serializable = [...index].map(([slug, target]) => [
    slug,
    { title: target.title, headings: [...target.headings] },
  ])
  const tempFile = `${titleIndexFile}.tmp`
  await fs.promises.writeFile(tempFile, JSON.stringify(serializable), "utf8")
  await fs.promises.rename(tempFile, titleIndexFile)
}

/**
 * Pre-pass: compute the title index and write it to disk before workers parse.
 * The {@link BindLinkTitles} transformer reads it in-worker to resolve `@title`
 * links to the current title of their target page or section heading.
 */
export async function buildTitleIndex(
  ctx: BuildCtx,
  filePaths: readonly FilePath[],
): Promise<void> {
  await writeTitleIndex(await computeTitleIndex(ctx, filePaths))
}
