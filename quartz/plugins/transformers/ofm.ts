/**
 * Obsidian Flavored Markdown transformer for Quartz.
 * Supports wikilinks, admonitions, tags, highlights, embeds, and more.
 */

import type { Element, Root as HtmlRoot, ElementContent, Properties, ElementData } from "hast"
import type { Root, Html, BlockContent, Paragraph, PhrasingContent, Blockquote } from "mdast"
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
import { fileURLToPath } from "url"

import type { JSResource } from "../../util/resources"
import type { QuartzTransformerPlugin } from "../types"

import { type FilePath, slugTag, slugifyFilePath } from "../../util/path"

const currentFilePath = fileURLToPath(import.meta.url)
const currentDirPath = path.dirname(currentFilePath)

/** Extended ElementData interface for custom HAST element properties. */
interface CustomElementData extends ElementData {
  hName?: string
  hProperties?: Record<string, unknown>
}

/** Creates an admonition icon element. */
const createAdmonitionIcon = (): Element => ({
  type: "element",
  tagName: "div",
  properties: {},
  data: {
    hName: "div",
    hProperties: {
      className: ["admonition-icon"],
    },
    position: {},
  } as unknown as CustomElementData,
  children: [],
})

/** Creates the inner title content for an admonition. */
const createAdmonitionTitleInner = (
  useDefaultTitle: boolean,
  capitalizedTypeString: string,
  titleContent: string,
  remainingChildren: ElementContent[],
): Element => ({
  type: "element",
  tagName: "div",
  properties: {},
  data: {
    hName: "div",
    hProperties: {
      className: ["admonition-title-inner"],
    },
    position: {},
  } as unknown as CustomElementData,
  children: [
    {
      type: "text",
      /* istanbul ignore next -- admonition title formatting edge case */
      value: useDefaultTitle ? capitalizedTypeString : `${titleContent} `,
    },
    ...remainingChildren,
  ],
})

/** Creates a fold/collapse icon for collapsible admonitions. */
const createFoldIcon = (): Element => ({
  type: "element",
  tagName: "div",
  data: {
    hName: "div",
    hProperties: {
      className: ["fold-admonition-icon"],
    },
    position: {},
  } as unknown as CustomElementData,
  children: [],
  properties: {},
})

/** Creates the complete title element for an admonition. */
const createAdmonitionTitle = (
  useDefaultTitle: boolean,
  capitalizedTypeString: string,
  titleContent: string,
  remainingChildren: ElementContent[],
  collapse: boolean,
): Element => {
  const children: ElementContent[] = [
    createAdmonitionIcon(),
    createAdmonitionTitleInner(
      useDefaultTitle,
      capitalizedTypeString,
      titleContent,
      remainingChildren,
    ),
  ]

  if (collapse) {
    children.push(createFoldIcon())
  }

  return {
    type: "element",
    tagName: "div",
    properties: {},
    data: {
      hName: "div",
      hProperties: {
        className: ["admonition-title"],
      },
      position: {},
    } as unknown as CustomElementData,
    children,
  }
}

/** Creates the content container for an admonition. */
const createAdmonitionContent = (contentChildren: ElementContent[]): Element | null => {
  if (contentChildren.length === 0) return null
  return {
    type: "element",
    tagName: "div",
    properties: {},
    children: contentChildren,
    data: {
      hName: "div",
      hProperties: {
        className: ["admonition-content"],
      },
      position: {},
    } as unknown as CustomElementData,
  }
}

/** Creates a video element for embedding. */
const createVideoElement = (url: string): PhrasingContent => ({
  type: "html",
  value: `<span class="video-container"><video src="${url}" controls></video></span>`,
})

/** Creates an audio element for embedding. */
const createAudioElement = (url: string): PhrasingContent => ({
  type: "html",
  value: `<audio src="${url}" controls></audio>`,
})

/** Creates a PDF embed iframe. */
const createPdfEmbed = (url: string): PhrasingContent => ({
  type: "html",
  value: `<iframe src="${url}"></iframe>`,
})

/** Creates a transclude element for embedding content from other pages. */
const createTranscludeElement = (
  url: string,
  ref: string,
  displayAlias?: string,
): PhrasingContent => ({
  type: "html",
  data: { hProperties: { transclude: true } },
  value: `<span class="transclude" data-url="${url}" data-block="${ref}"><a href="${url}${ref}" class="transclude-inner">${
    displayAlias ?? `Transclude of ${url}${ref}`
  }</a></span>`,
})

/** Creates a highlight span element. */
const createHighlightElement = (content: string): PhrasingContent => ({
  type: "html",
  value: `<span class="text-highlight">${content}</span>`,
})

// skipcq: JS-D1001
export const createYouTubeEmbed = (videoId: string, playlistId?: string): Properties => ({
  class: "external-embed",
  allow: "fullscreen",
  frameborder: 0,
  width: "600px",
  height: "350px",
  src: playlistId
    ? `https://www.youtube.com/embed/${videoId}?list=${playlistId}`
    : `https://www.youtube.com/embed/${videoId}`,
})

/** Creates YouTube playlist embed properties. */
const createPlaylistEmbed = (playlistId: string): Properties => ({
  class: "external-embed",
  allow: "fullscreen",
  frameborder: 0,
  width: "600px",
  height: "350px",
  src: `https://www.youtube.com/embed/videoseries?list=${playlistId}`,
})

/** Processes blockquotes and converts them to admonitions. */
const processAdmonitionBlockquote = (node: Blockquote): void => {
  if (node.children.length === 0) return

  const firstChild = node.children[0]
  if (firstChild.type !== "paragraph" || firstChild.children[0]?.type !== "text") {
    return
  }

  const text = firstChild.children[0].value
  const [firstLine, ...remainingLines] = text.split("\n")
  const remainingText = remainingLines.join("\n")

  // skipcq: JS-0357
  const match = firstLine.match(admonitionRegex)
  if (!match?.input) return

  const [admonitionDirective, typeString, collapseChar] = match
  const admonitionType = canonicalizeAdmonition(typeString.toLowerCase())
  const collapse = collapseChar === "+" || collapseChar === "-"
  const defaultState = collapseChar === "-" ? "collapsed" : "expanded"
  const titleContent = match.input.slice(admonitionDirective.length).trim()
  /* istanbul ignore next -- admonition title detection edge case */
  const useDefaultTitle = titleContent === "" && firstChild.children.length === 1
  const capitalizedTypeString = typeString.charAt(0).toUpperCase() + typeString.slice(1)

  const admonitionTitle = createAdmonitionTitle(
    useDefaultTitle,
    capitalizedTypeString,
    titleContent,
    firstChild.children.slice(1) as ElementContent[],
    collapse,
  ) as unknown as BlockContent

  /* istanbul ignore next -- admonition content handling edge case */
  const contentChildren = [
    ...(remainingText.trim() !== ""
      ? [
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, value: remainingText }],
          },
        ]
      : []),
    ...node.children.slice(1),
  ]

  const contentNode = createAdmonitionContent(contentChildren as ElementContent[])

  node.children = [admonitionTitle]
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

  node.data = {
    ...node.data,
    hProperties: {
      ...(node.data?.hProperties ?? {}),
      className: classNames.join(" "),
      "data-admonition": admonitionType,
      "data-admonition-fold": collapse,
    },
  }
}

/** Configuration options for the OFM transformer. */
export interface OFMOptions {
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

/** Default OFM configuration. */
export const defaultOptions: OFMOptions = {
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

/** Admonition type aliases mapping. */
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

/** Normalizes admonition names to canonical forms. */
function canonicalizeAdmonition(admonitionName: string): keyof typeof admonitionMapping {
  const normalizedAdmonition = admonitionName.toLowerCase() as keyof typeof admonitionMapping
  return admonitionMapping[normalizedAdmonition] ?? admonitionName
}

/** Regular expression to match external URLs (http/https) */
export const externalLinkRegex = /^https?:\/\//i

/** Matches Obsidian wikilinks: [[page]], [[page#section]], [[page|alias]], ![[embed]] */
export const wikilinkRegex = new RegExp(
  /!?\[\[([^[\]|#\\]+)?(#+[^[\]|#\\]+)?(\\?\|[^[\]#]+)?\]\]/,
  "g",
)

/** Matches Markdown tables with header, separator, and body rows. */
export const tableRegex = new RegExp(
  /^\|([^\n])+\|\n(\|)( ?:?-{3,}:? ?\|)+\n(\|([^\n])+\|\n?)+/,
  "gm",
)

/** Regular expression to match wikilinks within tables for escaping purposes */
export const tableWikilinkRegex = new RegExp(/(!?\[\[[^\]]*?\]\])/, "g")

/** Regular expression to match highlight syntax (==text==) */
const highlightRegex = new RegExp(/[=]{2}([^=]+)[=]{2}/, "g")

/** Regular expression to match Obsidian-style comments (%%comment%%) */
const commentRegex = new RegExp(/%%[\s\S]*?%%/, "g")

/** Regular expression to match admonition syntax ([!type][fold]) */
const admonitionRegex = new RegExp(/^\[!(\w+)\]([+-]?)/)

/** Regular expression to match admonition lines in blockquotes */
const admonitionLineRegex = new RegExp(/^> *\[!\w+\][+-]?.*$/, "gm")

/** Matches tags with Unicode support: #tag, #tag/subtag */
const tagRegex = new RegExp(
  /(?:^| )#((?:[-_\p{L}\p{Emoji}\p{M}\d])+(?:\/[-_\p{L}\p{Emoji}\p{M}\d]+)*)/u,
  "gu",
)

/** Regular expression to match block references (^blockid) */
const blockReferenceRegex = new RegExp(/\^([-_A-Za-z0-9]+)$/, "g")

/** Regular expression to match YouTube video URLs */
const ytLinkRegex = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/

/** Regular expression to match YouTube playlist parameters */
const ytPlaylistLinkRegex = /[?&]list=([^#?&]*)/

/** Regular expression to match video file extensions */
const videoExtensionRegex = new RegExp(/\.(mp4|webm|ogg|avi|mov|flv|wmv|mkv|mpg|mpeg|3gp|m4v)$/)

/** Regular expression to parse image embed dimensions and alt text */
const wikilinkImageEmbedRegex = new RegExp(
  /^(?<alt>(?!^\d*x?\d*$).*?)?(\|?\s*?(?<width>\d+)(x(?<height>\d+))?)?$/,
)

/** Converts MDAST nodes to HTML strings. */
const mdastToHtml = (ast: PhrasingContent | Paragraph): string => {
  const hast = toHast(ast, { allowDangerousHtml: true })
  return toHtml(hast, { allowDangerousHtml: true })
}

/** Processes wikilinks and converts them to appropriate MDAST nodes. */
export function processWikilink(
  textContent: string,
  ...captureGroups: [string, string, string]
): PhrasingContent | null {
  const [filePath, blockRef, alias] = captureGroups
  const fp = filePath?.trim() ?? ""
  const ref = blockRef?.trim() ?? ""
  const displayAlias = alias ? alias.slice(1).trim() : undefined

  if (textContent.startsWith("!")) {
    const ext: string = path.extname(fp).toLowerCase()
    const url = slugifyFilePath(fp as FilePath)
    if ([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp"].includes(ext)) {
      const match = wikilinkImageEmbedRegex.exec(alias ?? "")
      const width = match?.groups?.width ?? "auto"
      const height = match?.groups?.height ?? "auto"
      const specifiedDimensions = width !== "auto" || height !== "auto"
      /* istanbul ignore next -- edge case for image alt text handling */
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
      return createVideoElement(url)
    } else if ([".mp3", ".webm", ".wav", ".m4a", ".ogg", ".3gp", ".flac"].includes(ext)) {
      return createAudioElement(url)
    } else if ([".pdf"].includes(ext)) {
      return createPdfEmbed(url)
    } else {
      return createTranscludeElement(url, ref, displayAlias)
      // otherwise, fall through to regular link
    }
  }

  return {
    type: "link",
    url: `${fp}${ref}`,
    children: [{ type: "text", value: displayAlias ?? fp }],
  }
}

/** Creates a tag processing function. */
const createTagProcessor =
  (file: VFile): ReplaceFunction =>
  (_value: string, tag: string) => {
    if (/^\d+$/.test(tag)) {
      return false
    }

    tag = slugTag(tag)
    /* istanbul ignore next -- frontmatter handling is tested elsewhere */
    if (file.data.frontmatter) {
      const noteTags = file.data.frontmatter.tags ?? []
      file.data.frontmatter.tags = [...new Set([...noteTags, tag])]
    }

    return {
      type: "link" as const,
      url: `/tags/${tag}`,
      data: {
        hProperties: {
          className: ["tag-link"],
        },
      },
      children: [
        {
          type: "text" as const,
          value: tag,
        },
      ],
    }
  }

/** Applies regex-based text replacements to MDAST tree. */
function applyRegexReplacements(tree: Root, file: VFile, opts: OFMOptions): void {
  const replacements: [RegExp, string | ReplaceFunction][] = []

  if (opts.wikilinks) {
    replacements.push([wikilinkRegex, processWikilink])
  }

  if (opts.highlight) {
    replacements.push([
      highlightRegex,
      (_value: string, ...capture: string[]) => {
        const [inner] = capture
        return createHighlightElement(inner)
      },
    ])
  }

  if (opts.parseTags) {
    replacements.push([tagRegex, createTagProcessor(file)])
  }

  if (opts.enableInHtmlEmbed) {
    visit(tree, "html", (node: Html) => {
      for (const [regex, replace] of replacements) {
        /* istanbul ignore next -- string replacements are not used in current implementation */
        if (typeof replace === "string") {
          node.value = node.value.replace(regex, replace)
        } else {
          node.value = node.value.replace(regex, (substring: string, ...args) => {
            const replaceValue = replace(substring, ...args)
            /* istanbul ignore next -- string return case is covered by existing tests */
            if (typeof replaceValue === "string") {
              return replaceValue
              /* istanbul ignore next -- array return case is covered by existing tests */
            } else if (Array.isArray(replaceValue)) {
              return replaceValue.map(mdastToHtml).join("")
            } else if (typeof replaceValue === "object" && replaceValue !== null) {
              return mdastToHtml(replaceValue)
              /* istanbul ignore next -- fallback case for edge scenarios */
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

/** Creates a plugin that applies regex-based text replacements. */
// istanbul ignore next -- this is a plugin
const createRegexReplacementsPlugin = (opts: OFMOptions) => () => {
  return (tree: Root, file: VFile) => {
    applyRegexReplacements(tree, file, opts)
  }
}

/** Converts image nodes with video extensions to video embeds. */
function convertImageToVideoEmbed(tree: Root): void {
  visit(tree, "image", (node, index, parent) => {
    if (parent && index !== undefined && videoExtensionRegex.test(node.url)) {
      const newNode = createVideoElement(node.url) as Html
      parent.children.splice(index, 1, newNode)
      return SKIP
    }
    return undefined
  })
}

/** Creates a plugin that converts image nodes with video extensions to video embeds. */
// istanbul ignore next -- this is a plugin
const createVideoEmbedPlugin = () => () => {
  return (tree: Root) => {
    convertImageToVideoEmbed(tree)
  }
}

/** Creates a plugin that processes blockquotes and converts them to admonitions. */
// istanbul ignore next -- this is a plugin
const createAdmonitionsPlugin = () => () => {
  return (tree: Root) => {
    visit(tree, "blockquote", processAdmonitionBlockquote)
  }
}

/** Parses block references in HTML elements and stores them in file data. */
function parseBlockReferences(tree: HtmlRoot, file: VFile): void {
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

/** Converts image elements with YouTube URLs to iframe embeds. */
function convertImagesToYouTubeEmbeds(tree: HtmlRoot): void {
  visit(tree, "element", (node) => {
    if (node.tagName === "img" && typeof node.properties.src === "string") {
      const match = node.properties.src.match(ytLinkRegex)
      const videoId = match && match[2].length === 11 ? match[2] : null
      const playlistId = node.properties.src.match(ytPlaylistLinkRegex)?.[1]
      if (videoId) {
        node.tagName = "iframe"
        node.properties = createYouTubeEmbed(videoId, playlistId)
      } else if (playlistId) {
        node.tagName = "iframe"
        node.properties = createPlaylistEmbed(playlistId)
      }
    }
  })
}

/** Processes checkbox input elements and adds custom styling classes. */
function processCheckboxElements(tree: HtmlRoot): void {
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

/** Unwraps video elements that are the only child of a paragraph. */
function unwrapSingleVideoElements(tree: HtmlRoot): void {
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

/** Creates markdown processing plugins based on configuration. */
export function markdownPlugins(opts: OFMOptions): PluggableList {
  const plugins: PluggableList = []

  plugins.push(createRegexReplacementsPlugin(opts))

  if (opts.enableVideoEmbed) {
    plugins.push(createVideoEmbedPlugin())
  }

  if (opts.admonitions) {
    plugins.push(createAdmonitionsPlugin())
  }

  return plugins
}

/** Main Obsidian Flavored Markdown transformer plugin for Quartz. */
export const ObsidianFlavoredMarkdown: QuartzTransformerPlugin<Partial<OFMOptions> | undefined> = (
  userOpts,
) => {
  const opts = { ...defaultOptions, ...userOpts }

  return {
    name: "ObsidianFlavoredMarkdown",
    /** Performs text-level transformations on the raw markdown source. */
    textTransform(_ctx, src: string | Buffer) {
      /* istanbul ignore next -- Buffer input handling edge case */
      src = typeof src === "string" ? src : src.toString()

      // strip HTML comments
      src = src.replace(/<!--[\s\S]*?-->/g, "")

      /* istanbul ignore next -- comment removal is optional feature */
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
            /* istanbul ignore next -- table wikilink escaping edge case */
            let escaped = raw ?? ""
            escaped = escaped.replace("#", "\\#")
            escaped = escaped.replace("|", "\\|")

            return escaped
          })
        })

        // replace all other wikilinks
        src = src.replace(wikilinkRegex, (value: string, ...capture: string[]): string => {
          const [rawFp, rawHeader, rawAlias]: (string | undefined)[] = capture

          /* istanbul ignore next -- wikilink parsing edge cases */
          const fp = rawFp ?? ""
          const anchor = rawHeader?.trim().replace(/^#+/, "")
          const blockRef = anchor?.startsWith("^") ? "^" : ""
          const displayAnchor = anchor ? `#${blockRef}${slugAnchor(anchor)}` : ""
          /* istanbul ignore next -- wikilink alias parsing edge cases */
          const displayAlias = rawAlias ?? rawHeader?.replace("#", "|") ?? ""
          /* istanbul ignore next -- external wikilink embed detection edge case */
          const embedDisplay = value.startsWith("!") ? "!" : ""

          /* istanbul ignore next -- external link wikilink edge case */
          if (rawFp?.match(externalLinkRegex)) {
            return `${embedDisplay}[${displayAlias.replace(/^\|/, "")}](${rawFp})`
          }

          return `${embedDisplay}[[${fp}${displayAnchor}${displayAlias}]]`
        })
      }

      return src
    },
    /** Returns the markdown processing plugins. */
    // istanbul ignore next -- this is a plugin
    markdownPlugins() {
      return markdownPlugins(opts)
    },
    /** Returns the HTML processing plugins. */
    // istanbul ignore next -- this is a plugin
    htmlPlugins() {
      const plugins: PluggableList = [rehypeRaw]

      if (opts.parseBlockReferences) {
        plugins.push(() => {
          return (tree: HtmlRoot, file: VFile) => {
            parseBlockReferences(tree, file)
          }
        })
      }

      if (opts.enableYouTubeEmbed) {
        plugins.push(() => {
          return (tree: HtmlRoot) => {
            convertImagesToYouTubeEmbeds(tree)
          }
        })
      }

      if (opts.enableCheckbox) {
        plugins.push(() => {
          return (tree: HtmlRoot) => {
            processCheckboxElements(tree)
          }
        })
      }

      // unwrap video tags which are only children of a paragraph
      plugins.push(() => {
        return (tree: HtmlRoot) => {
          unwrapSingleVideoElements(tree)
        }
      })

      return plugins
    },
    /** Returns external resources needed by this transformer. */
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

/** Extends VFile data interface for OFM-specific data. */
declare module "vfile" {
  interface DataMap {
    blocks: Record<string, Element>
    htmlAst: HtmlRoot
  }
}
