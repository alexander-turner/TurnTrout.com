import { type Element, type Root } from "hast"
import { h } from "hastscript"
import { visit } from "unist-util-visit"
import { VFile } from "vfile"

import { mailIconPath, rssIconPath } from "../../components/constants"
import { type QuartzTransformerPlugin } from "../types"
import { type QuartzPluginData } from "../vfile"
import { createFaviconElement } from "./linkfavicons"
import { createSequenceLinksComponent } from "./sequenceLinks"
import { troutContainerId } from "./trout_hr"

const SUBSTACK_URL = "https://assets.turntrout.com/static/images/external-favicons/substack_com.svg"

const newsletterElement = h("a", { href: "https://turntrout.substack.com/subscribe" }, [
  "newsle",
  h("span", { className: "favicon-span" }, ["tter", createFaviconElement(SUBSTACK_URL)]),
])

const rssSpan = h("span", { className: "favicon-span" }, [
  h("abbr", { class: "small-caps" }, "rss"),
  createFaviconElement(rssIconPath, "RSS icon"),
])
export const rssElement = h("a", { href: "/rss.xml", id: "rss-link" }, [rssSpan])
const subscriptionElement = h("div", { className: "centered" }, [
  h("div", h("p", ["Find out when I post more content: ", newsletterElement, " & ", rssElement])),
])

const mailLink = h("a", { href: "mailto:alex@turntrout.com" }, [
  "alex@turntrout",
  h("span", { className: "favicon-span" }, [".com", createFaviconElement(mailIconPath)]),
])

const pgpLink = h(
  "a",
  {
    href: "https://keys.openpgp.org/search?q=alex%40turntrout.com",
    rel: "noopener noreferrer",
    target: "_blank",
  },
  [h("abbr", { className: "small-caps" }, "pgp")],
)
const contactMe = h("div", [
  h("div", { className: "centered" }, [
    "Thoughts? Email me at ",
    h("code", {}, [mailLink]),
    " (",
    pgpLink,
    ")",
  ]),
])

/**
 * Inserts components after the ornament node (trout container) in the tree
 */
export function insertAfterOrnamentNode(tree: Root, components: Element[]) {
  visit(tree, "element", (node: Element, index, parent: Element | null) => {
    if (
      index !== undefined &&
      node.tagName === "div" &&
      node.properties &&
      node.properties.id === troutContainerId &&
      parent
    ) {
      const wrapperDiv = h("div", { class: "after-article-components" }, components)
      parent.children.splice(index + 1, 0, wrapperDiv)
      return false // Stop traversing
    }
    return true
  })
}

/**
 * Transforms the AST to add after-article components
 * @param tree - The root AST node
 * @param file - The VFile containing frontmatter and plugin data
 */
function afterArticleTransform(tree: Root, file: VFile) {
  const sequenceLinksComponent = createSequenceLinksComponent(file.data as QuartzPluginData)
  const components = [sequenceLinksComponent ?? null].filter(Boolean) as Element[]

  // If frontmatter doesn't say to avoid it
  if (!file.data.frontmatter?.hideSubscriptionLinks) {
    components.push(h("div", { id: "subscription-and-contact" }, [subscriptionElement, contactMe]))
  }

  if (components.length > 0) {
    insertAfterOrnamentNode(tree, components)
  }
}

// skipcq: JS-D1001
export const AfterArticle: QuartzTransformerPlugin = () => {
  return {
    name: "AfterArticleTransformer",
    htmlPlugins: () => [() => afterArticleTransform],
  }
}
