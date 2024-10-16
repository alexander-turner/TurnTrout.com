import { QuartzTransformerPlugin } from "../types"
import { Root, Element } from "hast"
import { visit } from "unist-util-visit"
import { h } from "hastscript"
import { createSequenceLinksComponent } from "./sequenceLinks"
import { CreateFaviconElement, MAIL_PATH } from "./linkfavicons"

export const rssElement = h("a", { href: "/rss.xml", id: "rss-link" }, [
  h("abbr", { class: "small-caps" }, "RSS"),
  h("img", {
    src: "https://assets.turntrout.com/static/images/rss.svg",
    id: "rss-svg",
    alt: "RSS icon",
    className: "favicon",
  }),
])

const SUBSTACK_URL =
  "https://assets.turntrout.com/static/images/external-favicons/substack_com.avif"

const newsletterElement = h("a", { href: "https://turntrout.substack.com/subscribe" }, [
  "newsle",
  h("span", ["tter", CreateFaviconElement(SUBSTACK_URL)]),
])

const subscriptionElement = h("center", [
  h("div", h("p", ["Find out when I post more content: ", newsletterElement, " & ", rssElement])),
])

const contactMe = h("div", [
  h("center", [
    "Thoughts? Email me at ",
    h("code", h("a", { href: MAIL_PATH }, "alex@turntrout.com")),
    CreateFaviconElement(MAIL_PATH),
  ]),
])

export function insertAfterTroutOrnament(tree: Root, components: Element[]) {
  visit(tree, "element", (node: Element, index, parent: Element | null) => {
    if (
      index !== undefined &&
      node.tagName === "div" &&
      node.properties &&
      node.properties.id === "trout-ornament" &&
      parent
    ) {
      const wrapperDiv = h("div", { class: "after-article-components" }, components)
      parent.children.splice(index + 1, 0, wrapperDiv)
      return false // Stop traversing
    }
  })
}

export const AfterArticle: QuartzTransformerPlugin = () => {
  return {
    name: "AfterArticleTransformer",
    htmlPlugins: () => [
      () => (tree: Root, file) => {
        const sequenceLinksComponent = createSequenceLinksComponent(file.data)

        const components = [sequenceLinksComponent ?? null].filter(Boolean) as Element[]

        // If frontmatter doesn't say to avoid it
        if (!file.data.frontmatter?.hideSubscriptionLinks) {
          components.push(
            h("div", { id: "subscription-and-contact" }, [subscriptionElement, contactMe]),
          )
        }

        if (components.length > 0) {
          insertAfterTroutOrnament(tree, components)
        }
      },
    ],
  }
}
