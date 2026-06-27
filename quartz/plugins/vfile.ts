import type { Element as HastElement, Node, Parent, Root } from "hast"

import { VFile } from "vfile"

import type { FilePath, FullSlug, SimpleSlug } from "../util/path"

/**
 * Represents a single entry in the Table of Contents
 */
export interface TocEntry {
  /** Heading level (0-based from highest level in document) */
  depth: number
  /** Plain text content of the heading */
  text: string
  /** HTML anchor ID for the heading */
  slug: string
}

export interface FrontmatterData {
  title: string
  description?: string
  tags?: readonly string[]
  aliases?: readonly string[]
  publish?: boolean
  draft?: boolean
  toc?: boolean | string
  enableToc?: string
  cssclasses?: readonly string[]
  date_published?: string | Date
  date_updated?: string | Date
  hide_metadata?: boolean
  hide_reading_time?: boolean
  original_url?: string
  "lw-sequence-title"?: string
  "sequence-link"?: string
  "prev-post-slug"?: string
  "prev-post-title"?: string
  "next-post-slug"?: string
  "next-post-title"?: string
  "lw-linkpost-url"?: string
  authors?: readonly string[]
  createBibtex?: boolean
  created?: string | Date
  children?: string[]
  [key: string]: unknown
}

export interface BlockData {
  [key: string]: HastElement
}

export interface Data {
  frontmatter?: FrontmatterData
  toc?: readonly TocEntry[]
  links?: readonly SimpleSlug[]
  slug?: FullSlug
  filePath?: FilePath
  relativePath?: FilePath
  text?: string
  /** Text counted toward the displayed reading time; excludes collapsed admonitions and appendices. */
  readingTimeText?: string
  html?: string
  htmlAst?: Root
  tree?: Node
  blocks?: BlockData
  dates?: { created?: Date; modified?: Date; published?: Date }
  children?: string[]
  /** BibTeX citation content, stored during transform for cross-thread access */
  bibtexContent?: string
  /**
   * Filenames (without extension) of `/static/icons/<name>.svg` icons
   * actually rendered by admonitions on the page. Populated by the OFM
   * transformer; consumed by `<Head>` to scope prefetch hints.
   */
  usedAdmonitionIcons?: readonly string[]
  [key: string]: unknown
}

export type QuartzPluginData = Data
export type ProcessedContent = [Node, VFile]
export type ValidDateType = keyof Required<QuartzPluginData>["dates"]

/** Client-side content details (date/description stripped before writing to JSON). */
export type ContentDetails = {
  title: string
  links: readonly SimpleSlug[]
  tags: readonly string[]
  content: string
  richContent?: string
  authors: readonly string[]
}
export type ContentIndex = Map<FullSlug, ContentDetails>

export function defaultProcessedContent(vfileData: Partial<QuartzPluginData>): ProcessedContent {
  const root: Parent = { type: "root", children: [] }
  const vfile = new VFile("")
  vfile.data = vfileData as Record<string, unknown>
  return [root, vfile]
}
