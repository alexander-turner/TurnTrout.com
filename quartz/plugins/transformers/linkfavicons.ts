import { visit } from "unist-util-visit"
import { QuartzTransformerPlugin } from "../types"

export const AddFavicons: QuartzTransformerPlugin = () => {
  return {
    name: "AddFavicons",
    htmlPlugins() {
      return [
        () => {
          return (tree) => {
            visit(tree, "element", (node) => {
              if (node.tagName === "a" && node?.properties?.className?.includes("external")) {
                const linkNode = node
                const url = new URL(linkNode.properties.href)
                const domain = url.hostname

                const faviconImg = {
                  type: "element",
                  tagName: "img",
                  properties: {
                    src: `https://www.google.com/s2/favicons?sz=64&domain=${domain}`,
                    onerror: `console.error('Failed to load favicon for ${domain}'); this.remove();`,
                    class: "favicon",
                  },
                  alt: "Favicon for " + domain,
                }

                // Extract the last word
                const textContent = linkNode.children[0].value
                if (textContent === undefined) {
                  linkNode.children.push(faviconImg)
                  return
                }
                const words = textContent.split(" ")
                const lastWord = words.pop()

                // Create a span for the last word and image
                const span = {
                  type: "element",
                  tagName: "span",
                  className: ["favicon-span"],
                  properties: {},
                  children: [{ type: "text", value: " " + lastWord }, faviconImg],
                }

                // Replace the original text with the span
                linkNode.children[0].value = words.join(" ")
                linkNode.children.push(span)
              }
            })
          }
        },
      ]
    },
  }
}
