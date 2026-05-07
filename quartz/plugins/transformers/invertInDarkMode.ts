import type { Element, Root } from "hast"

import gitRoot from "find-git-root"
import fs from "fs/promises"
import path from "path"
import { visit } from "unist-util-visit"
import { fileURLToPath } from "url"

const projectRoot = path.dirname(gitRoot(fileURLToPath(import.meta.url)))

export const labelsPath = path.join(
  projectRoot,
  "quartz",
  "plugins",
  "transformers",
  ".invert_labels.json",
)

export const INVERT_CLASS = "invert-in-dark-mode"

export type InvertLabelMap = ReadonlyMap<string, boolean>

let cache: InvertLabelMap | null = null

export function resetCacheForTesting(): void {
  cache = null
}

export async function loadInvertLabels(filePath: string = labelsPath): Promise<InvertLabelMap> {
  const isDefault = filePath === labelsPath
  if (isDefault && cache !== null) return cache

  let raw: string
  try {
    raw = await fs.readFile(filePath, "utf-8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const empty: InvertLabelMap = new Map()
      if (isDefault) cache = empty
      return empty
    }
    throw error
  }

  const parsed = JSON.parse(raw) as unknown
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filePath} must contain a JSON object`)
  }
  const labels = new Map<string, boolean>(
    Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, Boolean(v)]),
  )
  if (isDefault) cache = labels
  return labels
}

export function addInvertClass(node: Element): void {
  const props = (node.properties ??= {})
  const existing = props.className
  const tokens = Array.isArray(existing)
    ? existing.map(String)
    : typeof existing === "string"
      ? existing.split(/\s+/).filter(Boolean)
      : []
  if (!tokens.includes(INVERT_CLASS)) tokens.push(INVERT_CLASS)
  props.className = tokens
}

export function applyLabelsToTree(tree: Root, labels: InvertLabelMap): void {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "img") return
    const src = node.properties?.src
    if (typeof src === "string" && labels.get(src) === true) addInvertClass(node)
  })
}

/**
 * Tags <img> elements whose src is labeled `true` in
 * `.invert_labels.json` with the `invert-in-dark-mode` class. Dark-mode
 * CSS applies the inversion filter only to tagged images.
 */
export const InvertInDarkMode = () => ({
  name: "InvertInDarkMode" as const,
  htmlPlugins: () => [
    () => async (tree: Root) => {
      applyLabelsToTree(tree, await loadInvertLabels())
    },
  ],
})
