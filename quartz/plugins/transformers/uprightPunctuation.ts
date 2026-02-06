import type { Element, ElementContent, Parent, Root, Text } from "hast"

import { h } from "hastscript"
import { type Transformer } from "unified"
// skipcq: JS-0257
import { visitParents } from "unist-util-visit-parents"

import { type QuartzTransformerPlugin } from "../types"
import { hasAncestor, hasClass } from "./utils"

const SKIP_TAGS = ["code", "script", "style", "pre"] as const
const SKIP_CLASSES = ["no-formatting", "elvish", "bad-handwriting"] as const
const ITALIC_TAGS = ["em", "i"]

// Parentheses, brackets, and braces — the Bringhurst core set
const UPRIGHT_PUNCTUATION_REGEX = /(?<punct>[()[\]{}])/g

function shouldSkip(node: Element): boolean {
  if (node.type !== "element") return false
  const skipTag = (SKIP_TAGS as readonly string[]).includes(node.tagName)
  const skipClass = SKIP_CLASSES.some((cls) => hasClass(node, cls))
  return skipTag || skipClass
}

function isItalicElement(node: Element): boolean {
  return ITALIC_TAGS.includes(node.tagName)
}

function hasItalicAncestor(parent: Parent, ancestors: Parent[]): boolean {
  return hasAncestor(parent as Element, isItalicElement, ancestors)
}

export const uprightPunctuationTransform: Transformer<Root, Root> = (tree: Root) => {
  visitParents(tree, "text", (node: Text, ancestors: Parent[]) => {
    const parent = ancestors[ancestors.length - 1]
    // istanbul ignore next
    if (!parent) return

    // Skip if inside code/pre/etc.
    if (hasAncestor(parent as Element, shouldSkip, ancestors)) return

    // Only process text inside italic context
    if (!hasItalicAncestor(parent, ancestors)) return

    // Skip if there's no punctuation to process
    if (!UPRIGHT_PUNCTUATION_REGEX.test(node.value)) return
    UPRIGHT_PUNCTUATION_REGEX.lastIndex = 0 // Reset after test()

    // Don't double-wrap: skip if direct parent is already an upright-punctuation span
    if (
      parent.type === "element" &&
      (parent as Element).tagName === "span" &&
      hasClass(parent as Element, "upright-punctuation")
    ) {
      return
    }

    const index = parent.children.indexOf(node as ElementContent)
    // istanbul ignore next
    if (index === -1) return

    // Split the text node at punctuation characters and wrap them
    const parts: (Text | Element)[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    UPRIGHT_PUNCTUATION_REGEX.lastIndex = 0
    while ((match = UPRIGHT_PUNCTUATION_REGEX.exec(node.value)) !== null) {
      // Text before the punctuation
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: node.value.slice(lastIndex, match.index) })
      }

      // The punctuation character, wrapped in an upright span
      const punct = match.groups?.punct ?? /* istanbul ignore next */ match[0]
      parts.push(h("span.upright-punctuation", punct))

      lastIndex = match.index + match[0].length
    }

    // Remaining text after last match
    if (lastIndex < node.value.length) {
      parts.push({ type: "text", value: node.value.slice(lastIndex) })
    }

    // Replace the original text node with the split parts.
    // parts is guaranteed non-empty since we already confirmed regex matches above.
    parent.children.splice(index, 1, ...(parts as ElementContent[]))
  })
}

export const UprightPunctuation: QuartzTransformerPlugin = () => ({
  name: "uprightPunctuation",
  htmlPlugins() {
    return [() => uprightPunctuationTransform]
  },
})
