import { QuartzTransformerPlugin } from "../types"
import { Root, Element, Text } from "hast"
import { visit } from "unist-util-visit"
import { toString } from "hast-util-to-string"
import { fromHtml } from "hast-util-from-html"

export const TableCaption: QuartzTransformerPlugin = () => {
  return {
    name: "TableCaption",
    transform(tree: Root) {
      visit(tree, "element", (node: Element, index, parent) => {
        if (node.tagName === "p" && node.children.length > 0) {
          const firstChild = node.children[0]
          if (firstChild.type === "text" && firstChild.value.startsWith("^Table: ")) {
            const captionText = firstChild.value.slice(8) // Remove "^Table: "
            const captionHtml = fromHtml(`<figcaption>${captionText}</figcaption>`, {
              fragment: true,
            })

            // Replace the paragraph with a figcaption
            parent!.children.splice(index!, 1, ...captionHtml.children)

            // Find the preceding table and wrap it with a figure
            if (
              index! > 0 &&
              parent!.children[index! - 1].type === "element" &&
              parent!.children[index! - 1].tagName === "table"
            ) {
              const figure: Element = {
                type: "element",
                tagName: "figure",
                properties: {},
                children: [
                  parent!.children[index! - 1] as Element,
                  ...(captionHtml.children as Element[]),
                ],
              }
              parent!.children.splice(index! - 1, 2, figure)
            }
          }
        }
      })
    },
  }
}
