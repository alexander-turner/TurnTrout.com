import type { Element, Root } from "hast";

import gitRoot from "find-git-root";
import fs from "fs/promises";
import path from "path";
import { visit } from "unist-util-visit";
import { fileURLToPath } from "url";

import { invertInDarkModeClass } from "../../components/constants";

const projectRoot = path.dirname(gitRoot(fileURLToPath(import.meta.url)));

export const labelsPath = path.join(
  projectRoot,
  "quartz",
  "plugins",
  "transformers",
  ".invert_labels.json",
)

export type InvertLabelMap = ReadonlyMap<string, boolean>

function parseLabels(raw: string, source: string): InvertLabelMap {
  const parsed: unknown = JSON.parse(raw)
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${source} must contain a JSON object`)
  }
  const labels = new Map<string, boolean>()
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (value === null || typeof value !== "object" || !("invert" in value)) {
      throw new Error(`${source} entry for ${key} must be {invert, reviewed}`)
    }
    labels.set(key, Boolean((value as { invert: unknown }).invert))
  }
  return labels
}

/** Missing file → empty map; other I/O errors propagate. */
export async function loadInvertLabels(filePath: string = labelsPath): Promise<InvertLabelMap> {
  let raw: string
  try {
    raw = await fs.readFile(filePath, "utf-8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map()
    throw error
  }
  return parseLabels(raw, filePath)
}

function classTokens(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean)
  return []
}

export function addInvertClass(node: Element): void {
  const props = (node.properties ??= {})
  const tokens = classTokens(props.className)
  if (!tokens.includes(invertInDarkModeClass)) tokens.push(invertInDarkModeClass)
  props.className = tokens
}

/**
 * True iff this is an inline GIF-replacement video — autoplay+loop+muted —
 * but not the persistent `#pond-video` background. (Hast normalizes the
 * `autoplay` HTML attr to the camelCased property `autoPlay`.)
 */
export function isInlineLoopingVideo(node: Element): boolean {
  if (node.tagName !== "video") return false
  const props = node.properties ?? {}
  if (props.id === "pond-video") return false
  return Boolean(props.autoPlay) && Boolean(props.loop) && Boolean(props.muted)
}

/** Direct `src` plus every `<source src>` child of a video element. */
export function collectVideoSources(node: Element): string[] {
  const sources: string[] = []
  const direct = node.properties?.src
  if (typeof direct === "string") sources.push(direct)
  for (const child of node.children) {
    if (child.type !== "element" || child.tagName !== "source") continue
    const childSrc = child.properties?.src
    if (typeof childSrc === "string") sources.push(childSrc)
  }
  return sources
}

/** URLs whose label decides whether to tag this element. */
function eligibleSources(node: Element): readonly string[] {
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
 *
 * Labels are read once per plugin instance and shared across every page in
 * the build.
 */
export const InvertInDarkMode = () => {
  let labelsPromise: Promise<InvertLabelMap> | null = null
  const labels = () => (labelsPromise ??= loadInvertLabels())
  return {
    name: "InvertInDarkMode" as const,
    htmlPlugins: () => [() => async (tree: Root) => applyLabelsToTree(tree, await labels())],
  }
}
