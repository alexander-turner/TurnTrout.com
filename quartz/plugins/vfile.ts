import type { Node, Parent, Root, Element as HastElement } from "hast"

import { VFile } from "vfile"

import type { FullSlug, SimpleSlug, FilePath } from "../util/path"
import type { TocEntry } from "./transformers/toc"

export interface FrontmatterData {
  title: string
  description?: string
  tags?: string[]
  aliases?: string[]
  publish?: boolean
  draft?: boolean
  toc?: boolean | string
  enableToc?: string
  cssclasses?: string[]
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
  authors?: string
  created?: string | Date
  children?: string[]
  [key: string]: unknown
}

export interface BlockData {
  [key: string]: HastElement
}

export interface Data {
  frontmatter?: FrontmatterData
  toc?: TocEntry[]
  links?: SimpleSlug[]
  slug?: FullSlug
  filePath?: FilePath
  relativePath?: FilePath
  text?: string
  html?: string
  htmlAst?: Root
  tree?: Node
  blocks?: BlockData
  dates?: { created?: Date; modified?: Date; published?: Date }
  children?: string[]
  [key: string]: unknown
}

export type QuartzPluginData = Data
export type ProcessedContent = [Node, VFile]

export function defaultProcessedContent(vfileData: Partial<QuartzPluginData>): ProcessedContent {
  const root: Parent = { type: "root", children: [] }
  const vfile = new VFile("")
  vfile.data = vfileData as Record<string, unknown>
  return [root, vfile]
}
