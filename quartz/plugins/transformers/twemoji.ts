import type { Element, Parent, Text } from "hast"
import type { Node } from "unist"

import { h } from "hastscript"
import { type Plugin } from "unified"
import { visit } from "unist-util-visit"

import { twemoji } from "./modules/twemoji.min"

export const EMOJI_REPLACEMENT = "⤴"
export const TWEMOJI_BASE_URL = "https://assets.turntrout.com/twemoji/"
export const EMOJIS_TO_REPLACE = ["1fabf"]

export interface TwemojiOptions {
  folder: string
  ext: string
  callback: (icon: string, options: TwemojiOptions) => string
}

export function createTwemojiCallback(icon: string, options: TwemojiOptions): string {
  return `${TWEMOJI_BASE_URL}${icon}${options.ext}`
}

export function parseAttributes(imgTag: string): Record<string, string> {
  const attrs = imgTag.match(/(\w+)="([^"]*)"?/g) || []
  return attrs.reduce(
    (acc, attr) => {
      const [key, value] = attr.split("=")
      acc[key] = value.replace(/"/g, "")
      return acc
    },
    {} as Record<string, string>,
  )
}

export function replaceEmoji(content: string): string {
  let twemojiContent = twemoji.parse(content, {
    folder: "svg",
    ext: ".svg",
    callback: createTwemojiCallback,
  } as TwemojiOptions)

  EMOJIS_TO_REPLACE.forEach((emoji) => {
    twemojiContent = twemojiContent.replace(
      `twemoji/${emoji}.svg`,
      `twemoji/replacements/${emoji}.svg`,
    )
  })

  return twemojiContent
}

export function createNodes(twemojiContent: string): (Text | Element)[] {
  const newNodes: (Text | Element)[] = []
  const parts = twemojiContent.split(/<img.*?>/g)
  const matches = twemojiContent.match(/<img.*?>/g) || []

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

// private-use unicode; html formatting uses E000
export const ignoreMap = new Map<string, string>([
  ["⤴", "\uE001"],
  ["⇔", "\uE002"],
  ["↗", "\uE003"],
])

export function replaceEmojiConvertArrows(content: string): string {
  let twemojiContent = content
  twemojiContent = twemojiContent.replaceAll(/↩/gu, "⤴")
  for (const [key, value] of ignoreMap) {
    const exp = new RegExp(key, "g")
    twemojiContent = twemojiContent.replaceAll(exp, value)
  }
  twemojiContent = replaceEmoji(twemojiContent)
  for (const [key, value] of ignoreMap) {
    const exp = new RegExp(value, "g")
    twemojiContent = twemojiContent.replaceAll(exp, key)
  }
  return twemojiContent
}

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
