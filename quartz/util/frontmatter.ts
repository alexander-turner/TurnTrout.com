import matter from "gray-matter"
import { JSON_SCHEMA, load as loadYAML } from "js-yaml"
import toml from "toml"

import { uiStrings } from "../components/constants"

export interface FrontmatterParseOptions {
  delimiters: string | [string, string]
  language: "yaml" | "toml"
}

const defaultParseOptions: FrontmatterParseOptions = {
  delimiters: "---",
  language: "yaml",
}

/** Parse a file's frontmatter using Quartz's YAML/TOML engines. */
export function parseFrontmatter(
  content: string,
  opts: FrontmatterParseOptions = defaultParseOptions,
) {
  const { data } = matter(content, {
    ...opts,
    engines: {
      yaml: (s) => loadYAML(s, { schema: JSON_SCHEMA }) as object,
      toml: (s) => toml.parse(s) as object,
    },
  })
  return data
}

/** Resolve the display title for a file: its `title` frontmatter, else its stem. */
export function resolveTitle(data: { title?: unknown }, stem: string | undefined): string {
  if (data.title && data.title.toString() !== "") {
    return data.title.toString()
  }
  return stem ?? uiStrings.propertyDefaults.title
}
