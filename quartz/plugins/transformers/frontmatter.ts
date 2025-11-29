import type { Root } from "hast"

import matter from "gray-matter"
import { JSON_SCHEMA, load as loadYAML } from "js-yaml"
import remarkFrontmatter from "remark-frontmatter"
import toml from "toml"
import { visit } from "unist-util-visit"
import { VFile } from "vfile"

import type { QuartzTransformerPlugin } from "../types"
import type { QuartzPluginData } from "../vfile"

import { uiStrings } from "../../components/constants"
import { escapeHTML } from "../../util/escape"
import { slugTag } from "../../util/path"
import { urlRegex } from "./utils"

export interface Options {
  delimiters: string | [string, string]
  language: "yaml" | "toml"
}

const defaultOptions: Options = {
  delimiters: "---",
  language: "yaml",
}

/**
 * Gathers text from all text nodes plus any content nested inside <code> blocks.
 * Returns a single string that you can store for indexing.
 */
function gatherAllText(tree: Root): string {
  let allText = ""
  visit(tree, (node) => {
    if (
      // @ts-expect-error: mixing AST node types
      (node.type === "text" || node.type === "inlineCode") &&
      "value" in node &&
      typeof node.value === "string"
    ) {
      allText += `${node.value} `
    }
  })
  return allText
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

function coerceToArray(input: string | string[]): string[] | undefined {
  if (input === undefined || input === null) return undefined

  // coerce to array
  if (!Array.isArray(input)) {
    input = input
      .toString()
      .split(",")
      .map((tag: string) => tag.toLowerCase())
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
            const { data } = matter(fileContent, {
              ...opts,
              engines: {
                yaml: (s) => loadYAML(s, { schema: JSON_SCHEMA }) as object,
                toml: (s) => toml.parse(s) as object,
              },
            })

            if (data.title && data.title.toString() !== "") {
              data.title = data.title.toString()
            } else {
              data.title = file.stem ?? uiStrings.propertyDefaults.title
            }

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

            // Fill out frontmatter data
            file.data.frontmatter = data as QuartzPluginData["frontmatter"]

            // Gather text from all text + code nodes
            let combinedText = gatherAllText(tree)
            combinedText = escapeHTML(combinedText)
            combinedText = combinedText.replace(urlRegex, "$<domain>$<path>")
            file.data.text = combinedText
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
        tags: string[]
        aliases: string[]
        description: string
        draft: boolean
        lang: string
        enableToc: string
        cssclasses: string[]
      }>
  }
}
