import type { Element, ElementContent, Parent, Root, Text } from "hast"

import { h } from "hastscript"
import { type Transformer } from "unified"
// skipcq: JS-0257
import { visitParents } from "unist-util-visit-parents"

import { type QuartzTransformerPlugin } from "../types"
import { toSkip } from "./formatting_improvement_html"
import { hasAncestor, hasClass } from "./utils"

const ITALIC_TAGS = ["em", "i"]

// Parentheses, brackets, and braces — the Bringhurst core set
const UPRIGHT_PUNCTUATION_REGEX = /(?<punct>[()[\]{}])/g

function isItalicElement(node: Element): boolean {
  return ITALIC_TAGS.includes(node.tagName)
}

export const uprightPunctuationTransform: Transformer<Root, Root> = (tree: Root) => {
  visitParents(tree, "text", (node: Text, ancestors: Parent[]) => {
    const parent = ancestors[ancestors.length - 1]
    // istanbul ignore next
    if (!parent) return

    if (hasAncestor(parent as Element, toSkip, ancestors)) return

    if (!hasAncestor(parent as Element, isItalicElement, ancestors)) return

    if (!UPRIGHT_PUNCTUATION_REGEX.test(node.value)) return
    UPRIGHT_PUNCTUATION_REGEX.lastIndex = 0 // Reset after test()

    // Don't double-wrap
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

    const parts: (Text | Element)[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    UPRIGHT_PUNCTUATION_REGEX.lastIndex = 0
    while ((match = UPRIGHT_PUNCTUATION_REGEX.exec(node.value)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: node.value.slice(lastIndex, match.index) })
      }

      const punct = match.groups?.punct ?? /* istanbul ignore next */ match[0]
      parts.push(h("span.upright-punctuation", punct))

      lastIndex = match.index + match[0].length
    }

    if (lastIndex < node.value.length) {
      parts.push({ type: "text", value: node.value.slice(lastIndex) })
    }

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
