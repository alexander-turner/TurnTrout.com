import type { Element, Root as HtmlRoot, ElementContent, ElementData } from "hast"
import type { Root, Html, BlockContent, Paragraph, PhrasingContent } from "mdast"
import type { PluggableList } from "unified"

import fs from "fs"
import { slug as slugAnchor } from "github-slugger"
import { toHtml } from "hast-util-to-html"
import { ReplaceFunction, findAndReplace as mdastFindReplace } from "mdast-util-find-and-replace"
import { toHast } from "mdast-util-to-hast"
import { VFile } from "mdast-util-to-hast/lib/state"
import path from "path"
import rehypeRaw from "rehype-raw"
import { SKIP, visit } from "unist-util-visit"
// Script imports
import { fileURLToPath } from "url"

import type { JSResource } from "../../util/resources"
import type { QuartzTransformerPlugin } from "../types"

import { capitalize } from "../../util/lang"
import { type FilePath, slugTag, slugifyFilePath } from "../../util/path"

const currentFilePath = fileURLToPath(import.meta.url)
const currentDirPath = path.dirname(currentFilePath)

interface CustomElementData extends ElementData {
  hName?: string
  hProperties?: Record<string, unknown>
}

export interface Options {
  comments: boolean
  highlight: boolean
  wikilinks: boolean
  admonitions: boolean
  mermaid: boolean
  parseTags: boolean
  parseArrows: boolean
  parseBlockReferences: boolean
  enableInHtmlEmbed: boolean
  enableYouTubeEmbed: boolean
  enableVideoEmbed: boolean
  enableCheckbox: boolean
}

export const defaultOptions: Options = {
  comments: true,
  highlight: true,
  wikilinks: true,
  admonitions: true,
  mermaid: true,
  parseTags: true,
  parseArrows: true,
  parseBlockReferences: true,
  enableInHtmlEmbed: false,
  enableYouTubeEmbed: true,
  enableVideoEmbed: true,
  enableCheckbox: false,
}

const admonitionMapping = {
  note: "note",
  abstract: "abstract",
  summary: "abstract",
  tldr: "abstract",
  info: "info",
  todo: "todo",
  tip: "tip",
  hint: "tip",
  important: "tip",
  success: "success",
  check: "success",
  done: "success",
  question: "question",
  help: "question",
  faq: "question",
  warning: "warning",
  attention: "warning",
  caution: "warning",
  failure: "failure",
  missing: "failure",
  fail: "failure",
  danger: "danger",
  error: "danger",
  bug: "bug",
  example: "example",
  quote: "quote",
  cite: "quote",
} as const

// Lowercases the admonition name and returns the canonical key of the admonition else the original name
function canonicalizeAdmonition(admonitionName: string): keyof typeof admonitionMapping {
  const normalizedAdmonition = admonitionName.toLowerCase() as keyof typeof admonitionMapping
  // if admonition is not recognized, make it a custom one
  return admonitionMapping[normalizedAdmonition] ?? admonitionName
}

export const externalLinkRegex = /^https?:\/\//i

// !?                 -> optional embedding
// \[\[               -> open brace
// ([^\[\]\|\#]+)     -> one or more non-special characters ([,], |, or #) (name)
// (#[^\[\]\|\#]+)?   -> # then one or more non-special characters (heading link)
// (\\?\|[^\[\]\#]+)? -> optional escape \ then | then one or more non-special characters (alias)
export const wikilinkRegex = new RegExp(
  /!?\[\[([^[\]|#\\]+)?(#+[^[\]|#\\]+)?(\\?\|[^[\]#]+)?\]\]/,
  "g",
)

// ^\|([^\n])+\|\n(\|) -> matches the header row
// ( ?:?-{3,}:? ?\|)+  -> matches the header row separator
// (\|([^\n])+\|\n)+   -> matches the body rows
export const tableRegex = new RegExp(
  /^\|([^\n])+\|\n(\|)( ?:?-{3,}:? ?\|)+\n(\|([^\n])+\|\n?)+/,
  "gm",
)

// matches any wikilink, only used for escaping wikilinks inside tables
export const tableWikilinkRegex = new RegExp(/(!?\[\[[^\]]*?\]\])/, "g")

const highlightRegex = new RegExp(/[=]{2}([^=]+)[=]{2}/, "g")
const commentRegex = new RegExp(/%%[\s\S]*?%%/, "g")
// from https://github.com/escwxyz/remark-obsidian-admonition/blob/main/src/index.ts
const admonitionRegex = new RegExp(/^\[!(\w+)\]([+-]?)/)
const admonitionLineRegex = new RegExp(/^> *\[!\w+\][+-]?.*$/, "gm")
// (?:^| )              -> non-capturing group, tag should start be separated by a space or be the start of the line
// #(...)               -> capturing group, tag itself must start with #
// (?:[-_\p{L}\d\p{Z}])+       -> non-capturing group, non-empty string of (Unicode-aware) alpha-numeric characters and symbols, hyphens and/or underscores
// (?:\/[-_\p{L}\d\p{Z}]+)*)   -> non-capturing group, matches an arbitrary number of tag strings separated by "/"
const tagRegex = new RegExp(
  /(?:^| )#((?:[-_\p{L}\p{Emoji}\p{M}\d])+(?:\/[-_\p{L}\p{Emoji}\p{M}\d]+)*)/u,
  "gu",
)
const blockReferenceRegex = new RegExp(/\^([-_A-Za-z0-9]+)$/, "g")
const ytLinkRegex = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
const ytPlaylistLinkRegex = /[?&]list=([^#?&]*)/
const videoExtensionRegex = new RegExp(/\.(mp4|webm|ogg|avi|mov|flv|wmv|mkv|mpg|mpeg|3gp|m4v)$/)
const wikilinkImageEmbedRegex = new RegExp(
  /^(?<alt>(?!^\d*x?\d*$).*?)?(\|?\s*?(?<width>\d+)(x(?<height>\d+))?)?$/,
)

// skipcq: JS-D1001
const mdastToHtml = (ast: PhrasingContent | Paragraph): string => {
  const hast = toHast(ast, { allowDangerousHtml: true })
  return toHtml(hast, { allowDangerousHtml: true })
}

// skipcq: JS-D1001
export function processWikilink(
  textContent: string,
  ...captureGroups: [string, string, string]
): PhrasingContent | null {
  const [filePath, blockRef, alias] = captureGroups
  const fp = filePath?.trim() ?? ""
  const ref = blockRef?.trim() ?? ""
  // Remove the leading | from the alias if it exists
  const displayAlias = alias ? alias.slice(1).trim() : undefined

  if (textContent.startsWith("!")) {
    // Get lowercase file extension and slugified path
    const ext: string = path.extname(fp).toLowerCase()
    const url = slugifyFilePath(fp as FilePath)
    if ([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp"].includes(ext)) {
      const match = wikilinkImageEmbedRegex.exec(alias ?? "")
      // Don't use the raw alias as alt text when dimensions are specified
      const width = match?.groups?.width ?? "auto"
      const height = match?.groups?.height ?? "auto"
      const specifiedDimensions = width !== "auto" || height !== "auto"
      const alt = specifiedDimensions ? "" : (match?.groups?.alt ?? "")
      return {
        type: "image",
        url,
        data: {
          hProperties: {
            width,
            height,
            alt,
          },
        },
      }
    } else if ([".mp4", ".webm", ".ogv", ".mov", ".mkv"].includes(ext)) {
      return {
        type: "html",
        value: `<span class="video-container"><video src="${url}" controls></video></span>`,
      }
    } else if ([".mp3", ".webm", ".wav", ".m4a", ".ogg", ".3gp", ".flac"].includes(ext)) {
      return {
        type: "html",
        value: `<audio src="${url}" controls></audio>`,
      }
    } else if ([".pdf"].includes(ext)) {
      return {
        type: "html",
        value: `<iframe src="${url}"></iframe>`,
      }
    } else {
      return {
        type: "html",
        data: { hProperties: { transclude: true } },
        value: `<span class="transclude" data-url="${url}" data-block="${ref}"><a href="${url}${ref}" class="transclude-inner">${
          displayAlias ?? `Transclude of ${url}${ref}`
        }</a></span>`,
      }
      // otherwise, fall through to regular link
    }
  }

  return {
    type: "link",
    url: `${fp}${ref}`,
    children: [{ type: "text", value: displayAlias ?? fp }],
  }
}

/**
 * Returns a list of plugins for the ObsidianFlavoredMarkdown transformer.
 */
export function markdownPlugins(opts: Options): PluggableList {
  const plugins: PluggableList = []

  // regex replacements
  plugins.push(() => {
    return (tree: Root, file: VFile) => {
      const replacements: [RegExp, string | ReplaceFunction][] = []

      if (opts.wikilinks) {
        replacements.push([wikilinkRegex, processWikilink])
      }

      if (opts.highlight) {
        replacements.push([
          highlightRegex,
          (_value: string, ...capture: string[]) => {
            const [inner] = capture
            return {
              type: "html",
              value: `<span class="text-highlight">${inner}</span>`,
            }
          },
        ])
      }

      if (opts.parseTags) {
        replacements.push([
          tagRegex,
          (_value: string, tag: string) => {
            // Check if the tag only includes numbers
            if (/^\d+$/.test(tag)) {
              return false
            }

            tag = slugTag(tag)
            if (file.data.frontmatter) {
              const noteTags = file.data.frontmatter.tags ?? []
              file.data.frontmatter.tags = [...new Set([...noteTags, tag])]
            }

            return {
              type: "link",
              url: `/tags/${tag}`,
              data: {
                hProperties: {
                  className: ["tag-link"],
                },
              },
              children: [
                {
                  type: "text",
                  value: tag,
                },
              ],
            }
          },
        ])
      }

      if (opts.enableInHtmlEmbed) {
        visit(tree, "html", (node: Html) => {
          for (const [regex, replace] of replacements) {
            if (typeof replace === "string") {
              node.value = node.value.replace(regex, replace)
            } else {
              node.value = node.value.replace(regex, (substring: string, ...args) => {
                const replaceValue = replace(substring, ...args)
                if (typeof replaceValue === "string") {
                  return replaceValue
                } else if (Array.isArray(replaceValue)) {
                  return replaceValue.map(mdastToHtml).join("")
                } else if (typeof replaceValue === "object" && replaceValue !== null) {
                  return mdastToHtml(replaceValue)
                } else {
                  return substring
                }
              })
            }
          }
        })
      }
      mdastFindReplace(tree, replacements)
    }
  })

  if (opts.enableVideoEmbed) {
    plugins.push(() => {
      return (tree: Root) => {
        visit(tree, "image", (node, index, parent) => {
          if (parent && index !== undefined && videoExtensionRegex.test(node.url)) {
            const newNode: Html = {
              type: "html",
              value: `<span class="video-container"><video controls src="${node.url}"></video></span>`,
            }

            parent.children.splice(index, 1, newNode)
            return SKIP
          }
          return undefined
        })
      }
    })
  }

  if (opts.admonitions) {
    plugins.push(() => {
      return (tree: Root) => {
        visit(tree, "blockquote", (node) => {
          if (node.children.length === 0) {
            return
          }

          // find first line
          const firstChild = node.children[0]
          if (firstChild.type !== "paragraph" || firstChild.children[0]?.type !== "text") {
            return
          }

          const text = firstChild.children[0].value
          const [firstLine, ...remainingLines] = text.split("\n")
          const remainingText = remainingLines.join("\n")

          const match = firstLine.match(admonitionRegex)
          if (match?.input) {
            const [admonitionDirective, typeString, collapseChar] = match
            const admonitionType = canonicalizeAdmonition(typeString.toLowerCase())
            const collapse = collapseChar === "+" || collapseChar === "-"
            const defaultState = collapseChar === "-" ? "collapsed" : "expanded"
            const titleContent = match.input.slice(admonitionDirective.length).trim()
            const useDefaultTitle = titleContent === "" && firstChild.children.length === 1

            const admonitionTitle: Element = {
              type: "element",
              tagName: "div",
              properties: {},
              data: {
                hName: "div",
                hProperties: {
                  className: ["admonition-title"],
                },
                position: {},
              } as CustomElementData,
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {},
                  data: {
                    hName: "div",
                    hProperties: {
                      className: ["admonition-icon"],
                    },
                    position: {},
                  } as CustomElementData,
                  children: [],
                },
                {
                  type: "element",
                  tagName: "div",
                  properties: {},
                  data: {
                    hName: "div",
                    hProperties: {
                      className: ["admonition-title-inner"],
                    },
                    position: {},
                  } as CustomElementData,
                  children: [
                    {
                      type: "text",
                      value: useDefaultTitle ? capitalize(typeString) : `${titleContent} `,
                    },
                    ...(firstChild.children.slice(1) as ElementContent[]),
                  ],
                },
                ...((collapse
                  ? [
                      {
                        type: "element",
                        tagName: "div",
                        data: {
                          hName: "div",
                          hProperties: {
                            className: ["fold-admonition-icon"],
                          },
                          position: {},
                        } as CustomElementData,
                        children: [],
                        properties: {},
                      },
                    ]
                  : []) as ElementContent[]),
              ],
            }

            // Create a new content node with the remaining text and other children
            const contentChildren = [
              ...(remainingText.trim() !== ""
                ? [
                    {
                      type: "paragraph",
                      children: [{ type: "text", value: remainingText }],
                    },
                  ]
                : []),
              ...node.children.slice(1),
            ]

            // Only create contentNode if there are children to include
            let contentNode: Element | null = null
            if (contentChildren.length > 0) {
              contentNode = {
                type: "element",
                tagName: "div",
                properties: {},
                children: contentChildren as ElementContent[],
                data: {
                  hName: "div",
                  hProperties: {
                    className: ["admonition-content"],
                  },
                  position: {},
                } as ElementData,
              }
            }

            // Replace the entire blockquote content
            node.children = [admonitionTitle as unknown as BlockContent]
            if (contentNode) {
              node.children.push(contentNode as unknown as BlockContent)
            }

            const classNames = ["admonition", admonitionType]
            if (collapse) {
              classNames.push("is-collapsible")
            }
            if (defaultState === "collapsed") {
              classNames.push("is-collapsed")
            }

            // Add properties to base blockquote
            node.data = {
              hProperties: {
                ...(node.data?.hProperties ?? {}),
                className: classNames.join(" "),
                "data-admonition": admonitionType,
                "data-admonition-fold": collapse,
              },
            }
          }
        })
      }
    })
  }

  return plugins
}

// skipcq: JS-D1001
export const ObsidianFlavoredMarkdown: QuartzTransformerPlugin<Partial<Options> | undefined> = (
  userOpts,
) => {
  const opts = { ...defaultOptions, ...userOpts }

  return {
    name: "ObsidianFlavoredMarkdown",
    textTransform(_ctx, src: string | Buffer) {
      // Strip HTML comments first
      src = typeof src === "string" ? src : src.toString()

      // Add HTML comment stripping
      src = src.replace(/<!--[\s\S]*?-->/g, "")

      // do comments at text level
      if (opts.comments) {
        src = src.replace(commentRegex, "")
      }

      // pre-transform blockquotes
      if (opts.admonitions) {
        src = src.replace(admonitionLineRegex, (value: string): string => {
          // force newline after title of admonition
          return `${value}\n> `
        })
      }

      // pre-transform wikilinks (fix anchors to things that may contain illegal syntax e.g. codeblocks, latex)
      if (opts.wikilinks) {
        // replace all wikilinks inside a table first
        src = src.replace(tableRegex, (value: string): string => {
          // escape all aliases and headers in wikilinks inside a table
          return value.replace(tableWikilinkRegex, (_, ...capture: string[]) => {
            const [raw]: (string | undefined)[] = capture
            let escaped = raw ?? ""
            escaped = escaped.replace("#", "\\#")
            escaped = escaped.replace("|", "\\|")

            return escaped
          })
        })

        // replace all other wikilinks
        src = src.replace(wikilinkRegex, (value: string, ...capture: string[]): string => {
          const [rawFp, rawHeader, rawAlias]: (string | undefined)[] = capture

          const fp = rawFp ?? ""
          const anchor = rawHeader?.trim().replace(/^#+/, "")
          const blockRef = anchor?.startsWith("^") ? "^" : ""
          const displayAnchor = anchor ? `#${blockRef}${slugAnchor(anchor)}` : ""
          const displayAlias = rawAlias ?? rawHeader?.replace("#", "|") ?? ""
          const embedDisplay = value.startsWith("!") ? "!" : ""

          if (rawFp?.match(externalLinkRegex)) {
            return `${embedDisplay}[${displayAlias.replace(/^\|/, "")}](${rawFp})`
          }

          return `${embedDisplay}[[${fp}${displayAnchor}${displayAlias}]]`
        })
      }

      return src
    },
    markdownPlugins() {
      return markdownPlugins(opts)
    },
    htmlPlugins() {
      const plugins: PluggableList = [rehypeRaw]

      if (opts.parseBlockReferences) {
        plugins.push(() => {
          return (tree: HtmlRoot, file: VFile) => {
            if (!file.data.blocks) {
              file.data.blocks = {}
            }

            visit(tree, "element", (node) => {
              if (node.tagName === "p" || node.tagName === "li") {
                const last = node.children.at(-1)
                if (last?.type === "text" && typeof last.value === "string") {
                  const matches = last.value.match(blockReferenceRegex)
                  if (matches && matches.length >= 1) {
                    const blockId = matches[0].slice(1)
                    if (file.data.blocks && !file.data.blocks[blockId]) {
                      // Remove the block reference from the text
                      last.value = last.value.replace(blockReferenceRegex, "")

                      node.properties = {
                        ...node.properties,
                        "data-block": blockId,
                      }
                      file.data.blocks[blockId] = node
                    }
                  }
                }
              }
            })

            file.data.htmlAst = tree
          }
        })
      }

      if (opts.enableYouTubeEmbed) {
        plugins.push(() => {
          return (tree: HtmlRoot) => {
            visit(tree, "element", (node) => {
              if (node.tagName === "img" && typeof node.properties.src === "string") {
                const match = node.properties.src.match(ytLinkRegex)
                const videoId = match && match[2].length === 11 ? match[2] : null
                const playlistId = node.properties.src.match(ytPlaylistLinkRegex)?.[1]
                if (videoId) {
                  // YouTube video (with optional playlist)
                  node.tagName = "iframe"
                  node.properties = {
                    class: "external-embed",
                    allow: "fullscreen",
                    frameborder: 0,
                    width: "600px",
                    height: "350px",
                    src: playlistId
                      ? `https://www.youtube.com/embed/${videoId}?list=${playlistId}`
                      : `https://www.youtube.com/embed/${videoId}`,
                  }
                } else if (playlistId) {
                  // YouTube playlist only.
                  node.tagName = "iframe"
                  node.properties = {
                    class: "external-embed",
                    allow: "fullscreen",
                    frameborder: 0,
                    width: "600px",
                    height: "350px",
                    src: `https://www.youtube.com/embed/videoseries?list=${playlistId}`,
                  }
                }
              }
            })
          }
        })
      }

      if (opts.enableCheckbox) {
        plugins.push(() => {
          return (tree: HtmlRoot) => {
            visit(tree, "element", (node) => {
              if (node.tagName === "input" && node.properties.type === "checkbox") {
                const isChecked = node.properties?.checked ?? false
                node.properties = {
                  type: "checkbox",
                  disabled: false,
                  checked: isChecked,
                  class: "checkbox-toggle",
                }
              }
            })
          }
        })
      }

      // unwrap video tags which are only children of a paragraph
      plugins.push(() => {
        return (tree: HtmlRoot) => {
          visit(tree, "element", (node, index, parent) => {
            if (
              parent &&
              index !== undefined &&
              node.tagName === "p" &&
              node.children.length === 1 &&
              node.children[0].type === "element" &&
              node.children[0].tagName === "video"
            ) {
              parent.children.splice(index, 1, node.children[0])
            }
          })
        }
      })

      return plugins
    },
    externalResources() {
      const js: JSResource[] = []

      if (opts.enableCheckbox) {
        const checkboxScriptPath = path.join(
          currentDirPath,
          "../components/scripts/checkbox.inline.js",
        )
        const checkboxScript = fs.readFileSync(checkboxScriptPath, "utf8")
        js.push({
          script: checkboxScript,
          loadTime: "afterDOMReady",
          contentType: "inline",
        })
      }

      if (opts.admonitions) {
        const admonitionScriptPath = path.join(
          currentDirPath,
          "../components/scripts/admonition.inline.js",
        )
        const admonitionScript = fs.readFileSync(admonitionScriptPath, "utf8")
        js.push({
          script: admonitionScript,
          loadTime: "afterDOMReady",
          contentType: "inline",
        })
      }

      return { js }
    },
  }
}

declare module "vfile" {
  interface DataMap {
    blocks: Record<string, Element>
    htmlAst: HtmlRoot
  }
}
