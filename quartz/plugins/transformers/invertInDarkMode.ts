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
  const labels = new Map<string, boolean>()
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (v === null || typeof v !== "object" || !("invert" in v)) {
      throw new Error(`${filePath} entry for ${k} must be {invert, reviewed}`)
    }
    labels.set(k, Boolean((v as { invert: unknown }).invert))
  }
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

/** True iff this is an inline GIF-replacement video — autoplay+loop+muted —
 * but not the persistent `#pond-video` background. (Hast normalizes the
 * `autoplay` HTML attr to the camelCased property `autoPlay`.) */
export function isInlineLoopingVideo(node: Element): boolean {
  if (node.tagName !== "video") return false
  const props = node.properties ?? {}
  if (props.id === "pond-video") return false
  return Boolean(props.autoPlay) && Boolean(props.loop) && Boolean(props.muted)
}

/** Returns every `src` referenced by this video — direct `src` if present
 * plus every `<source src>` child. */
export function collectVideoSources(node: Element): string[] {
  const direct = node.properties?.src
  const sources: string[] = typeof direct === "string" ? [direct] : []
  for (const child of node.children) {
    if (child.type !== "element" || child.tagName !== "source") continue
    const childSrc = child.properties?.src
    if (typeof childSrc === "string") sources.push(childSrc)
  }
  return sources
}

/** Returns the URLs that, if labeled `true`, mean we should tag this node
 * with the invert class. `[]` for elements we don't care about. */
function eligibleSources(node: Element): string[] {
  if (node.tagName === "img") {
    const src = node.properties?.src
    return typeof src === "string" ? [src] : []
  }
  return isInlineLoopingVideo(node) ? collectVideoSources(node) : []
}

export function applyLabelsToTree(tree: Root, labels: InvertLabelMap): void {
  visit(tree, "element", (node: Element) => {
    if (eligibleSources(node).some((src) => labels.get(src) === true)) {
      addInvertClass(node)
    }
  })
}

/**
 * Tags `<img>` and inline looping muted `<video>` elements whose src is
 * labeled `true` in `.invert_labels.json` with the `invert-in-dark-mode`
 * class. Dark-mode CSS applies the inversion filter only to tagged
 * elements. The persistent `#pond-video` is excluded by
 * `isInlineLoopingVideo`.
 */
export const InvertInDarkMode = () => ({
  name: "InvertInDarkMode" as const,
  htmlPlugins: () => [
    () => async (tree: Root) => {
      applyLabelsToTree(tree, await loadInvertLabels())
    },
  ],
})
