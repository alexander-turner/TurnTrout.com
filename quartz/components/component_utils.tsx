import { type Element, type Parent, type Root, type RootContent, type Text } from "hast"
import { fromHtml } from "hast-util-from-html"
import { h } from "hastscript"
import { renderToString } from "katex"
import { type JSX } from "preact"
// skipcq: JS-W1028
import React from "react"
import { titleCase } from "title-case"
// skipcq: JS-0257
import { visitParents } from "unist-util-visit-parents"

import { applyTextTransforms } from "../plugins/transformers/formatting_improvement_html"
import { replaceSCInNode } from "../plugins/transformers/tagSmallcaps"
import { processTree as processTwemojiTree } from "../plugins/transformers/twemoji"
import { EMOJI_CLASS, locale, TWEMOJI_INTRINSIC_DIMENSION, WORK_TITLE_CLASS } from "./constants"

export function formatTitle(title: string): string {
  // Replace single quotes with double quotes for consistency
  title = title.replace(/(?<prefix> |^)'/g, '$<prefix>"')
  title = title.replace(/'(?<suffix>[ ?!.]|$)/g, '"$<suffix>')
  title = applyTextTransforms(title, { useNbsp: false })

  title = titleCase(title, { locale })
  return title
}

/**
 * Single source of truth for the site's node-producing inline transforms:
 * emoji → Twemoji `<img>` and acronym small-caps, applied in pipeline order
 * (Twemoji before TagSmallcaps) over an existing hast subtree in place.
 *
 * Content injected after those two passes have run (the "Similar posts" block,
 * sequence links, backlinks) must re-apply them here. Smart-quote / arrow /
 * nbsp transforms are string-level and belong upstream in the caller
 * (`formatTitle` for titles, `applyTextTransforms` for descriptions).
 *
 * `workTitle` marks text that names a work (a page or sequence title), whose
 * acronyms render as plain caps: the small-caps pass is skipped.
 */
export function applyInlineFormattingTransforms(tree: Root | Element, workTitle = false): void {
  processTwemojiTree(tree as unknown as Root)
  if (workTitle) return
  visitParents(tree, "text", (node: Text, ancestors: Parent[]) => {
    replaceSCInNode(node, ancestors)
  })
}

/**
 * Renders a plain (already string-transformed) title or description string into
 * hast inline nodes with {@link applyInlineFormattingTransforms} applied. For
 * callers whose source may contain HTML markup, parse it first and call
 * {@link applyInlineFormattingTransforms} on the resulting tree instead.
 *
 * When `workTitle` is true, the result is wrapped in a {@link WORK_TITLE_CLASS}
 * span so every title-rendering surface gets the same typographic treatment
 * (e.g. lining-figure numerals) from one shared CSS rule.
 */
export function renderInlineFormatting(text: string, workTitle = false): (Text | Element)[] {
  const container = h("span", [{ type: "text", value: text } as Text])
  applyInlineFormattingTransforms(container, workTitle)
  if (workTitle) {
    container.properties = { ...container.properties, className: [WORK_TITLE_CLASS] }
    return [container]
  }
  return container.children as (Text | Element)[]
}

/** Joins a hast `className` (an array, or absent) into a class string. */
function classNameString(properties: Element["properties"]): string {
  const className = properties?.className
  return Array.isArray(className) ? className.map(String).join(" ") : ""
}

/**
 * Semantic inline tags preserved verbatim when rendering a title; everything
 * else falls back to a `<span>`.
 */
const SEMANTIC_INLINE_TAGS: ReadonlySet<string> = new Set([
  "em",
  "strong",
  "code",
  "del",
  "sub",
  "sup",
])

/**
 * Renders a hast inline node (as produced by {@link applyInlineFormattingTransforms})
 * to JSX. Single source of truth for turning formatted-title hast into elements,
 * shared by every component that displays a title.
 */
export function elementToJsx(elt: RootContent): JSX.Element {
  switch (elt.type) {
    case "text":
      // skipcq: JS-0424 want to cast as JSX element
      return <>{elt.value}</>
    case "element":
      if (elt.tagName === "abbr") {
        const firstChild = elt.children[0]
        const abbrText = firstChild?.type === "text" ? firstChild.value : ""
        return <abbr className={classNameString(elt.properties)}>{abbrText}</abbr>
      }
      if (elt.tagName === "img") {
        const classes = classNameString(elt.properties)
        const isEmoji = classes.split(" ").includes(EMOJI_CLASS)
        const width =
          (elt.properties?.width as number | string | undefined) ??
          (isEmoji ? TWEMOJI_INTRINSIC_DIMENSION : undefined)
        const height =
          (elt.properties?.height as number | string | undefined) ??
          (isEmoji ? TWEMOJI_INTRINSIC_DIMENSION : undefined)
        return (
          <img
            className={classes || undefined}
            src={elt.properties?.src as string}
            alt={elt.properties?.alt as string}
            draggable={elt.properties?.draggable === "false" ? false : undefined}
            width={width}
            height={height}
          />
        )
      }
      if (SEMANTIC_INLINE_TAGS.has(elt.tagName)) {
        const Tag = elt.tagName as keyof JSX.IntrinsicElements
        return (
          <Tag className={classNameString(elt.properties) || undefined}>
            {elt.children.map(elementToJsx)}
          </Tag>
        )
      }
      return (
        <span className={classNameString(elt.properties) || undefined}>
          {elt.children.map(elementToJsx)}
        </span>
      )
    default:
      // skipcq: JS-0424 want to cast as JSX element
      return <></>
  }
}

/**
 * Parses an already-typography-formatted title string and applies the shared
 * inline-formatting pipeline (Twemoji; the small-caps pass is skipped for work
 * titles), returning the resulting hast inline nodes wrapped in a
 * {@link WORK_TITLE_CLASS} span. Titles may carry inline HTML (e.g. `<abbr>`),
 * so the string is parsed before transforming.
 */
export function renderTitleNodes(formattedTitle: string): RootContent[] {
  const htmlAst = fromHtml(formattedTitle, { fragment: true }) as Root
  applyInlineFormattingTransforms(htmlAst, true)
  const wrapper = h("span", { className: [WORK_TITLE_CLASS] }, htmlAst.children as RootContent[])
  return [wrapper]
}

/** Like {@link renderTitleNodes} but rendered to JSX for component consumers. */
export function renderTitleJsx(formattedTitle: string): JSX.Element[] {
  return renderTitleNodes(formattedTitle).map(elementToJsx)
}

/**
 * Processes small caps in the given text and adds it to the parent node.
 * @param text - The text to process.
 * @param parent - The parent node to add the processed text to.
 */
export function processSmallCaps(text: string, parent: Parent): void {
  const textNode = { type: "text", value: text } as Text
  parent.children.push(textNode)
  replaceSCInNode(textNode, [parent])
}

/**
 * Renders inline code as a code block.
 * @param text - The text to process.
 * @param parent - The parent node to add the processed text to.
 */
export function processInlineCode(text: string, parent: Parent): void {
  const codeBlock = {
    type: "element",
    tagName: "code",
    properties: { className: ["inline-code"] },
    children: [{ type: "text", value: text }],
  } as Element
  parent.children.push(codeBlock)
}

/**
 * Processes LaTeX content and adds it to the parent node as a KaTeX-rendered span.
 * @param latex - The LaTeX content to process.
 * @param parent - The parent node to add the processed LaTeX to.
 */
export function processKatex(latex: string, parent: Parent): void {
  const html = renderToString(latex, { throwOnError: false })
  const katexNode: Element = {
    type: "element",
    tagName: "span",
    properties: { className: ["katex-toc"] },
    children: [{ type: "raw", value: html }],
  } as Element
  parent.children.push(katexNode)
}

/**
 * Wraps text in a span for arrows.
 * @param text The text to process (assumed to be an arrow).
 * @param parent The parent node to add the processed text to.
 */
export function processTextWithArrows(text: string, parent: Parent): void {
  const arrowSpan: Element = {
    type: "element",
    tagName: "span",
    properties: { className: ["monospace-arrow"] },
    children: [{ type: "text", value: text }],
  }
  parent.children.push(arrowSpan)
}
