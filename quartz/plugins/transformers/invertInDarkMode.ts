import type { Element, Parent, Root } from "hast"

import gitRoot from "find-git-root"
import fs from "fs/promises"
import { h } from "hastscript"
import path from "path"
import { visit } from "unist-util-visit"
import { fileURLToPath } from "url"

import { cdnBaseUrl, forceHslInvertClass, invertInDarkModeClass } from "../../components/constants"
import { invertedUrl, isInvertibleRaster } from "../../components/scripts/invertedAssets"

const projectRoot = path.dirname(gitRoot(fileURLToPath(import.meta.url)))

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

/**
 * Wrap a raster `<img>` in a `<picture>` whose `<source media="prefers-color-scheme:
 * dark" srcset="<inverted>">` lets the browser pick the precomputed inverted
 * variant in dark mode without ever fetching the light version. Cheaper than
 * canvas inversion and sidesteps Firefox's anti-fingerprinting prompt on
 * `canvas.getImageData`. SVGs and videos are not wrapped — they keep the
 * existing fetch-and-rewrite (SVG) / SVG-filter (video) paths.
 */
export function wrapInDarkModePicture(node: Element, parent: Parent, index: number): void {
  if (parent.type === "element" && (parent as Element).tagName === "picture") return
  const src = node.properties?.src
  if (typeof src !== "string" || !isInvertibleRaster(src)) return
  const picture = h("picture", [
    h("source", {
      srcSet: invertedUrl(src),
      media: "(prefers-color-scheme: dark)",
    }),
    node,
  ])
  parent.children[index] = picture
}

/**
 * Adds `crossorigin="anonymous"` to every CDN-hosted `<img>`. Needed
 * because `renderPage.tsx` emits `<link rel="preload" as="image"
 * crossorigin="anonymous">` for the LCP image — preload and img must
 * share a CORS mode or the browser silently re-fetches, defeating the
 * preload and logging a console warning. `built_site_checks` already
 * enforces that every media src is relative or on `cdnBaseUrl`, and the
 * CDN sends `Access-Control-Allow-Origin: *`. Assert that invariant
 * here so a non-CDN absolute src never silently ships `crossorigin`
 * (which would block loading entirely if the third-party host has no
 * CORS).
 */
export function addCrossOriginToImages(tree: Root): void {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "img") return
    const src = node.properties?.src
    if (typeof src !== "string" || !/^https?:\/\//.test(src)) return
    if (!src.startsWith(cdnBaseUrl)) {
      throw new Error(`addCrossOriginToImages: expected <img src> on ${cdnBaseUrl}, got ${src}`)
    }
    const props = (node.properties ??= {})
    props.crossOrigin ??= "anonymous"
  })
}

export function wrapForceHslInvertImages(tree: Root): void {
  visit(tree, "element", (node: Element, index, parent) => {
    if (node.tagName !== "img" || !parent || typeof index !== "number") return
    const tokens = classTokens(node.properties?.className)
    if (!tokens.includes(forceHslInvertClass)) return
    wrapInDarkModePicture(node, parent, index)
  })
}

export function applyLabelsToTree(tree: Root, labels: InvertLabelMap): void {
  visit(tree, "element", (node: Element, index, parent) => {
    if (!eligibleSources(node).some((src) => labels.get(src) === true)) return
    addInvertClass(node)
    if (node.tagName === "img" && parent && typeof index === "number") {
      wrapInDarkModePicture(node, parent, index)
    }
  })
}

/**
 * Tags `<img>` and inline looping muted `<video>` elements whose src is
 * labeled `true` in `.invert_labels.json` with the `invert-in-dark-mode`
 * class. Labeled rasters are wrapped in `<picture>` so the browser
 * fetches the precomputed inverted variant in dark mode. Inline videos
 * still rely on the dark-mode CSS filter. Force-hsl-invert rasters get
 * their `<img src>` rewritten to the inverted variant directly. The
 * persistent `#pond-video` is excluded by `isInlineLoopingVideo`.
 *
 * Labels are read once per plugin instance and shared across every page in
 * the build.
 */
export const InvertInDarkMode = () => {
  let labelsPromise: Promise<InvertLabelMap> | null = null
  const labels = () => (labelsPromise ??= loadInvertLabels())
  return {
    name: "InvertInDarkMode" as const,
    htmlPlugins: () => [
      () => async (tree: Root) => {
        applyLabelsToTree(tree, await labels())
        wrapForceHslInvertImages(tree)
        addCrossOriginToImages(tree)
      },
    ],
  }
}
