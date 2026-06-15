import type { Element, Parent, Text } from "hast"
import type { Node } from "unist"

import { h } from "hastscript"
import { type Plugin } from "unified"
import { visit } from "unist-util-visit"

import {
  emojiReplacement,
  emojisToReplace,
  NBSP,
  twemojiBaseUrl,
  twemojiIgnoreChars,
  WORD_JOINER,
} from "../../components/constants"
import { twemoji } from "./modules/twemoji.min"

export interface TwemojiOptions {
  folder: string
  ext: string
  callback: (icon: string, options: TwemojiOptions) => string
}

/** Builds the CDN URL for a Twemoji glyph given its codepoint and extension. */
export function constructTwemojiUrl(icon: string, options: TwemojiOptions): string {
  return `${twemojiBaseUrl}${icon}${options.ext}`
}

/**
 * Parses HTML attributes from an img tag string into a key-value object.
 * Only matches attributes with quoted values using the pattern: attribute="value".
 *
 * @param imgTag - The HTML img tag string to parse attributes from
 * @returns Object containing parsed attribute key-value pairs
 */
export function parseAttributes(imgTag: string): Record<string, string> {
  const regex = /(?<key>\w+)="(?<value>[^"]*)"?/g
  const result: Record<string, string> = {}
  for (const match of imgTag.matchAll(regex)) {
    /* istanbul ignore next -- named capture groups always produce .groups when matched */
    if (match.groups) {
      result[match.groups.key] = match.groups.value
    }
  }
  return result
}

/**
 * Replaces emoji characters in content with Twemoji SVG img tags.
 * Also handles special emoji replacements defined in emojisToReplace array.
 */
export function replaceEmoji(content: string): string {
  let twemojiContent = twemoji.parse(content, {
    folder: "svg",
    ext: ".svg",
    callback: constructTwemojiUrl,
  } as TwemojiOptions)

  emojisToReplace.forEach((emoji) => {
    twemojiContent = twemojiContent.replaceAll(
      `twemoji/${emoji}.svg`,
      `twemoji/replacements/${emoji}.svg`,
    )
  })

  return twemojiContent
}

// Matches each emoji <img> with an optional directly-preceding regular space.
const emojiImgRegex = /(?<space> )?(?<img><img.*?>)/g

/**
 * Glues each emoji `<img>` to the preceding text so it can never be the first
 * glyph on a wrapped line: a directly-preceding regular space becomes a
 * non-breaking space and a word joiner is inserted right before the emoji.
 * An emoji at the very start of the content can't strand itself, so it's left
 * untouched (mirrors the line-leading exemption in `dashWordJoiner`).
 *
 * @param content - Twemoji-processed HTML containing emoji img tags
 * @returns Content with emoji glued to their preceding text
 */
export function glueEmojiToPrecedingText(content: string): string {
  return content.replace(emojiImgRegex, (...args) => {
    const groups = args.at(-1) as { space?: string; img: string }
    const offset = args.at(-3) as number
    const { space, img } = groups
    if (!space && offset === 0) {
      return img
    }
    return `${space ? NBSP : ""}${WORD_JOINER}${img}`
  })
}

/**
 * Creates an array of text and element nodes from Twemoji-processed content.
 * Splits content by img tags and creates corresponding text nodes and img elements.
 *
 * @param twemojiContent - HTML content containing Twemoji img tags
 * @returns Array of text nodes and img elements for rendering
 */
export function createNodes(twemojiContent: string): (Text | Element)[] {
  const newNodes: (Text | Element)[] = []
  const parts = twemojiContent.split(/<img.*?>/)
  const imgRegex = /<img.*?>/g
  const matches: string[] = []
  let match: RegExpExecArray | null
  while ((match = imgRegex.exec(twemojiContent)) !== null) {
    matches.push(match[0])
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const match = matches[i]

    if (part) {
      newNodes.push({ type: "text", value: part } as Text)
    }

    if (match) {
      const properties = parseAttributes(match)
      newNodes.push(h("img", properties))
    }
  }

  return newNodes
}

// Characters to protect from twemoji processing by temporarily replacing with PUA characters
export const ignoreMap: ReadonlyMap<string, string> = new Map<string, string>([
  [emojiReplacement, twemojiIgnoreChars.emojiReplacement],
  ["⇔", twemojiIgnoreChars.doubleArrow],
  ["↗", twemojiIgnoreChars.upRightArrow],
])

// Pre-compiled regex pairs for ignoreMap to avoid creating RegExp objects on every call
const ignoreRegexPairs: readonly {
  keyRegex: RegExp
  valueRegex: RegExp
  key: string
  value: string
}[] = [...ignoreMap.entries()].map(([key, value]) => ({
  keyRegex: new RegExp(key, "g"),
  valueRegex: new RegExp(value, "g"),
  key,
  value,
}))

/**
 * Converts arrow characters and processes emoji with special character handling.
 * Converts ↩ to ⤴, temporarily replaces ignored characters during emoji processing,
 * then restores them to prevent unwanted emoji conversion.
 *
 * @param content - Text content that may contain arrows and emoji
 * @returns Content with arrows converted and emoji processed
 */
export function replaceEmojiConvertArrows(content: string): string {
  let twemojiContent = content
  twemojiContent = twemojiContent.replaceAll(/↩/gu, "⤴")
  for (const { keyRegex, value } of ignoreRegexPairs) {
    twemojiContent = twemojiContent.replaceAll(keyRegex, value)
  }
  twemojiContent = replaceEmoji(twemojiContent)
  for (const { valueRegex, key } of ignoreRegexPairs) {
    twemojiContent = twemojiContent.replaceAll(valueRegex, key)
  }
  twemojiContent = glueEmojiToPrecedingText(twemojiContent)
  return twemojiContent
}

/**
 * Processes an AST tree to replace emoji and arrows in text nodes.
 * Visits all text nodes, applies emoji and arrow conversion, and replaces
 * modified nodes with new text and element nodes.
 */
export function processTree(tree: Node): Node {
  visit(
    tree,
    "text",
    (node: Text, _index: number, parent: Parent) => {
      const twemojiContent = replaceEmojiConvertArrows(node.value)

      if (twemojiContent !== node.value) {
        const nodes = createNodes(twemojiContent)
        parent.children = [
          ...parent.children.slice(0, _index),
          ...nodes,
          ...parent.children.slice(_index + 1),
        ]
      }
    },
    true, // Reverse so that we don't re-visit newly created text nodes
  )

  return tree
}

/** Quartz transformer that swaps Unicode emoji for inline Twemoji `<img>` tags. */
export const Twemoji = (): {
  name: string
  htmlPlugins: () => Plugin[]
} => {
  return {
    name: "Twemoji",
    htmlPlugins() {
      return [() => processTree]
    },
  }
}
