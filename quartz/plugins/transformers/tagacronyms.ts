import { QuartzTransformerPlugin } from "../types"
import { Plugin } from "unified"
import { replaceRegex } from "./utils"
import { Node, Parent, Text } from "hast"

import { visit } from "unist-util-visit"
// Custom Rehype plugin for tagging acronyms
const ignoreAcronym = (_node: Node, _index: number, parent: Parent): boolean => {
  const noSmallCaps =
    "properties" in parent &&
    parent.properties &&
    typeof parent.properties === "object" &&
    "className" in parent.properties &&
    Array.isArray(parent.properties.className) &&
    parent.properties.className.includes("no-smallcaps")

  return (noSmallCaps ||
    ("tagName" in parent && (parent.tagName === "abbr" || parent.tagName === "code"))) as boolean
}

// Regex for acronyms and abbreviations
// Acronyms are defined as words with 3 or more capital letters
//  After the third letter, we can have any number of capital letters, digits, or hyphens
// Note that we are ignoring roman numerals
const REGEX_ACRONYM =
  /(?:\b|^)(?![ILVXM][ICLVXM]{2,}\b)(?<acronym>IF|TL;DR|IL|[A-Z\u00C0-\u00DC]{3,}(?:[-'’]?[\dA-Z\u00C0-\u00DC]+)*)(?<suffix>[sx]?)\b/

const REGEX_ABBREVIATION = /(?<number>[\d,]*\.?\d+)(?<abbreviation>[A-Zk]{1,})/g
const combinedRegex = new RegExp(`${REGEX_ACRONYM.source}|${REGEX_ABBREVIATION.source}`, "g")

export function replaceSCInNode(node: Text, index: number, parent: Parent): void {
  replaceRegex(
    node,
    index,
    parent,
    combinedRegex,
    (match: RegExpMatchArray) => {
      if (REGEX_ACRONYM.test(match[0])) {
        const { acronym, suffix } = match[0].match(REGEX_ACRONYM)!.groups!
        return { before: "", replacedMatch: acronym, after: suffix }
      } else {
        return { before: "", replacedMatch: match[0].toUpperCase(), after: "" }
      }
    },
    (node, index, parent) => ignoreAcronym(node, index, parent),
    "abbr.small-caps",
  )
}

export const rehypeTagAcronyms: Plugin = () => {
  return (tree) => {
    visit(tree, "text", replaceSCInNode)
  }
}

// The main Quartz plugin export
export const TagAcronyms: QuartzTransformerPlugin = () => {
  return {
    name: "TagAcronyms",
    htmlPlugins() {
      return [rehypeTagAcronyms]
    },
  }
}
