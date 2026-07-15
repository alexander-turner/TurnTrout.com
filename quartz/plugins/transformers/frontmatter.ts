import type { Root } from "mdast"

import remarkFrontmatter from "remark-frontmatter"
import { VFile } from "vfile"

import type { QuartzTransformerPlugin } from "../types"
import type { QuartzPluginData } from "../vfile"

import { parseFrontmatter, resolveTitle } from "../../util/frontmatter"
import { slugTag } from "../../util/path"
import { gatherAllText, gatherReadingTimeText, processGatheredText } from "./extractText"

export interface Options {
  delimiters: string | [string, string]
  language: "yaml" | "toml"
}

const defaultOptions: Options = {
  delimiters: "---",
  language: "yaml",
}

function coalesceAliases(data: { [key: string]: string[] }, aliases: string[]) {
  for (const alias of aliases) {
    if (data[alias] !== undefined && data[alias] !== null) return data[alias]
  }
  return []
}

// I don't want tags to be case-sensitive
function transformTag(tag: string): string {
  const trimmedTag = tag.trim()
  if (trimmedTag === "AI") return trimmedTag
  const newTag = tag.toLowerCase().trim().replace(/\s+/g, "-")
  return newTag
}

function coerceToArray(input: string | string[], lowercase = true): string[] | undefined {
  if (input === undefined || input === null) return undefined

  // coerce to array
  if (!Array.isArray(input)) {
    const parts = input.toString().split(",")
    const trimmed = parts.map((s) => s.trim())
    input = lowercase ? trimmed.map((tag) => tag.toLowerCase()) : trimmed
  }

  // remove all non-strings
  return input
    .filter((tag: unknown) => typeof tag === "string" || typeof tag === "number")
    .map((tag: string | number) => tag.toString())
}

export const FrontMatter: QuartzTransformerPlugin<Partial<Options> | undefined> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  return {
    name: "FrontMatter",
    markdownPlugins() {
      return [
        [remarkFrontmatter, ["yaml", "toml"]],
        () => {
          return (tree: Root, file: VFile) => {
            const fileContent = file.value?.toString() ?? ""
            const data = parseFrontmatter(fileContent, opts)
            data.title = resolveTitle(data, file.stem)

            const tags = coerceToArray(coalesceAliases(data, ["tags", "tag"]) || [])
            const lowerCaseTags = tags?.map((tag: string) => transformTag(tag))
            if (tags) {
              data.tags = [...new Set(lowerCaseTags?.map((tag: string) => slugTag(tag)))]
            }

            const aliases = coerceToArray(coalesceAliases(data, ["aliases", "alias"]) || [])
            if (aliases) data.aliases = aliases
            const cssclasses = coerceToArray(
              coalesceAliases(data, ["cssclasses", "cssclass"]) || [],
            )
            if (cssclasses) data.cssclasses = cssclasses

            const authors = coerceToArray(coalesceAliases(data, ["authors", "author"]) || [], false)
            if (authors) data.authors = authors

            // Fill out frontmatter data
            file.data.frontmatter = data as QuartzPluginData["frontmatter"]

            file.data.text = processGatheredText(gatherAllText(tree))
            file.data.readingTimeText = processGatheredText(gatherReadingTimeText(tree))
          }
        },
      ]
    },
  }
}

declare module "vfile" {
  interface DataMap {
    frontmatter: { [key: string]: unknown } & {
      title: string
    } & Partial<{
        tags: readonly string[]
        aliases: readonly string[]
        authors: readonly string[]
        description: string
        draft: boolean
        lang: string
        enableToc: string
        cssclasses: readonly string[]
        similar_posts: readonly string[]
      }>
  }
}
