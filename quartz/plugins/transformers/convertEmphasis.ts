import { QuartzTransformerPlugin } from "../types"
import { Plugin } from "unified"
import { visit } from "unist-util-visit"
import { Text, Parent, PhrasingContent } from "mdast"

/**
 * Processes a single text node and converts emphasis syntax to the corresponding node type.
 *
 * @param node - The text node to process.
 * @param index - The index of the node in its parent's children array.
 * @param parent - The parent node containing the text node.
 * @param regex - The regular expression to match the emphasis syntax.
 * @param tag - The type of emphasis to convert to ('em' or 'strong').
 * @throws {Error} If an invalid tag is provided.
 */
export const formatNode = (
  node: Text,
  index: number | undefined,
  parent: Parent | null,
  regex: RegExp,
  tag: string,
) => {
  if (!["em", "strong"].includes(tag)) throw new Error("Invalid tag")
  if (regex.test(node.value)) {
    const newNodes: PhrasingContent[] = []
    let lastIndex = 0

    // Process each match in the node's text
    node.value.replace(regex, (fullMatch, content, offset) => {
      // Add any text before the match as a regular text node
      if (offset > lastIndex) {
        newNodes.push({
          type: "text",
          value: node.value.slice(lastIndex, offset),
        } as Text)
      }

      newNodes.push({
        type: "element",
        tagName: tag,
        children: [{ type: "text", value: content } as Text],
      } as any)

      lastIndex = offset + fullMatch.length
      return fullMatch // This return is not used, it's just to satisfy TypeScript
    })

    // Add any remaining text after the last match
    if (lastIndex < node.value.length) {
      newNodes.push({
        type: "text",
        value: node.value.slice(lastIndex),
      } as Text)
    }

    // Replace the original node with our new nodes
    if (parent && typeof index === "number") {
      parent.children.splice(index, 1, ...newNodes)
    }
  }
}

/**
 * A unified plugin that converts emphasis syntax in markdown to the appropriate AST nodes.
 *
 * @returns A function that transforms the AST.
 */
export const convertEmphasisHelper = (tree: any): void => {
  const boldRegex = /\*\*(.*?)\*\*/g
  const italicRegex = /_(.*?)_/g
  for (const pair of [
    ["strong", boldRegex],
    ["em", italicRegex],
  ]) {
    const tagName = pair[0]
    const regex = pair[1]
    visit(tree, "text", (node: Text, index: number | undefined, parent: Parent | null) => {
      // Skip processing if the parent node is a code block or inline code
      if (parent && ["code", "inlineCode", "pre"].includes((parent as any).tagName)) {
        return
      }
      formatNode(node, index, parent, regex as RegExp, tagName as string)
    })
  }
}

/**
 * A Quartz transformer plugin that converts emphasis syntax in markdown.
 *
 * This plugin converts **bold** syntax to <strong> tags and _italic_ syntax to <em> tags.
 *
 * @returns An object with the plugin name and HTML plugins.
 */
export const ConvertEmphasis: QuartzTransformerPlugin = () => {
  return {
    name: "ReplaceAsterisksBold",
    htmlPlugins() {
      return [() => convertEmphasisHelper]
    },
  }
}
