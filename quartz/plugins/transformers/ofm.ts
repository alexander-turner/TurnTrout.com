/**
 * Obsidian Flavored Markdown transformer for Quartz.
 * Supports wikilinks, admonitions, tags, highlights, embeds, and more.
 */

import type {
  Element,
  Root as HtmlRoot,
  ElementContent,
  Properties,
  ElementData,
  Parent,
} from "hast"
import type { Root, Html, BlockContent, Paragraph, PhrasingContent, Blockquote } from "mdast"
import type { PluggableList } from "unified"

import fs from "fs"
import { toHtml } from "hast-util-to-html"
import { ReplaceFunction, findAndReplace as mdastFindReplace } from "mdast-util-find-and-replace"
import { toHast } from "mdast-util-to-hast"
import path from "path"
import rehypeRaw from "rehype-raw"
import { SKIP, visit } from "unist-util-visit"
import { fileURLToPath } from "url"
import { VFile } from "vfile"

import type { JSResource } from "../../util/resources"
import type { QuartzTransformerPlugin } from "../types"

import { type FilePath, slugTag, slugifyFilePath } from "../../util/path"
import { slugify as slugAnchor, resetSlugger } from "./gfm"

const currentFilePath = fileURLToPath(import.meta.url)
const currentDirPath = path.dirname(currentFilePath)

/** Regular expression to match external URLs (http/https) */
export const externalLinkRegex = /^https?:\/\//i

/** Matches Obsidian wikilinks: [[page]], [[page#section]], [[page#]], [[page|alias]], ![[embed]] */
export const wikilinkRegex = new RegExp(
  /!?\[\[(?<page>[^[\]|#\\]+)?(?<section>#+(?:[^[\]|#\\]+)?)?(?<alias>\\?\|[^[\]#]+)?\]\]/,
  "g",
)

/** Matches Markdown tables with header, separator, and body rows. */
export const tableRegex = new RegExp(
  /^\|(?:[^\n])+\|\n(?:\|)(?:[ ]?:?-{3,}:?[ ]?\|)+\n(?:\|(?:[^\n])+\|\n?)+/,
  "gm",
)

/** Regular expression to match wikilinks within tables for escaping purposes */
export const tableWikilinkRegex = new RegExp(/(?<wikilink>!?\[\[[^\]]*?\]\])/, "g")

/** Regular expression to match highlight syntax (==text==) */
const highlightRegex = new RegExp(/[=]{2}(?<content>[^=]+)[=]{2}/, "g")

/** Regular expression to match Obsidian-style comments (%%comment%%) */
const commentRegex = new RegExp(/%%[\s\S]*?%%/, "g")

/** Regular expression to match admonition syntax ([!type][fold]) */
const admonitionRegex = new RegExp(/^\[!(?<type>\w+)\](?<collapse>[+-]?)/)

/** Regular expression to match admonition lines in blockquotes */
const admonitionLineRegex = new RegExp(/^> *\[!\w+\][+-]?.*$/, "gm")

/** Matches tags with Unicode support: #tag, #tag/subtag */
const tagRegex = new RegExp(
  /(?:^| )#(?<tag>(?:[-_\p{L}\p{Emoji}\p{M}\d])+(?:\/[-_\p{L}\p{Emoji}\p{M}\d]+)*)/u,
  "gu",
)

/** Regular expression to match block references (^blockid) */
const blockReferenceRegex = new RegExp(/\^(?<blockId>[-_A-Za-z0-9]+)$/, "g")

/** Regular expression to match YouTube video URLs */
const ytLinkRegex = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)(?<videoId>[^#&?]*).*/

/** Regular expression to match YouTube playlist parameters */
const ytPlaylistLinkRegex = /[?&]list=(?<playlistId>[^#?&]*)/

/** Regular expression to match video file extensions */
const videoExtensionRegex = new RegExp(/\.(?:mp4|webm|ogg|avi|mov|flv|wmv|mkv|mpg|mpeg|3gp|m4v)$/)

/** Regular expression to parse image embed dimensions and alt text */
const wikilinkImageEmbedRegex = new RegExp(
  /^(?<alt>(?!^\d*x?\d*$).*?)?(?:\|?\s*?(?<width>\d+)(?:x(?<height>\d+))?)?$/,
)

/** Extended ElementData interface for custom HAST element properties. */
interface CustomElementData extends ElementData {
  hName?: string
  hProperties?: Record<string, unknown>
}

/** Creates an admonition icon element. */
const createAdmonitionIcon = (): Element => ({
  type: "element",
  tagName: "span",
  properties: {},
  data: {
    hName: "span",
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
  tagName: "span",
  properties: {},
  data: {
    hName: "span",
    hProperties: {
      className: ["admonition-title-inner"],
    },
  } as unknown as CustomElementData,
  children: [
    createAdmonitionIcon(),
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
): PhrasingContent => {
  const isExternal = externalLinkRegex.test(url)
  const href = isExternal ? `${url}${ref}` : `/${url}${ref}`
  return {
    type: "html",
    data: { hProperties: { transclude: true } },
    value: `<span class="transclude" data-url="${url}" data-block="${ref}"><a href="${href}" class="transclude-inner">${
      displayAlias ?? `Transclude of ${url}${ref}`
    }</a></span>`,
  }
}

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

  const match = admonitionRegex.exec(firstLine)
  if (!match?.groups) return

  const admonitionDirective = match[0]
  const typeString = match.groups.type
  const collapseChar = match.groups.collapse
  const admonitionType = canonicalizeAdmonition(typeString.toLowerCase())
  const collapse = collapseChar === "+" || collapseChar === "-"
  const defaultState = collapseChar === "-" ? "collapsed" : "expanded"
  const titleContent = firstLine.slice(admonitionDirective.length).trim()
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
    // Note: mdast-util-find-and-replace passes capture groups positionally
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
      // Note: mdast-util-find-and-replace passes capture groups positionally
      (_value: string, content: string) => {
        return createHighlightElement(content)
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
        blockReferenceRegex.lastIndex = 0
        const match = blockReferenceRegex.exec(last.value)
        if (match?.groups) {
          const blockId = match.groups.blockId
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
      const match = ytLinkRegex.exec(node.properties.src)
      const videoId =
        match?.groups?.videoId && match.groups.videoId.length === 11
          ? match.groups.videoId
          : null
      const playlistMatch = ytPlaylistLinkRegex.exec(node.properties.src)
      const playlistId = playlistMatch?.groups?.playlistId
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

/** Checks if a checkbox is inside a list item with content after it. */
function isCheckboxInListItemWithContent(
  parent: Parent | undefined,
  index: number | undefined,
): boolean {
  // istanbul ignore if -- defensive coding
  if (!parent || index === undefined) {
    return false
  }
  if (parent.type !== "element" || (parent as Element).tagName !== "li") {
    return false
  }
  const siblingsAfterCheckbox = parent.children.slice(index + 1)
  return siblingsAfterCheckbox.length > 0
}

/** Creates checkbox properties with appropriate accessibility attributes. */
function createCheckboxProperties(
  isChecked: boolean,
  checkboxId: string,
  willBeWrappedInLabel: boolean,
): Properties {
  return {
    type: "checkbox",
    disabled: false,
    checked: isChecked,
    class: "checkbox-toggle",
    id: checkboxId,
    ...(willBeWrappedInLabel ? {} : { ariaLabel: "checkbox" }),
  }
}

interface CheckboxInfo {
  node: Element
  index: number
  parent: Parent
  checkboxId: string
  willBeWrappedInLabel: boolean
}

/** Wraps a checkbox and its immediate text content in a label element. */
function wrapCheckboxInLabel(
  node: Element,
  parent: Parent,
  index: number,
  checkboxId: string,
): void {
  const siblingsAfterCheckbox = parent.children.slice(index + 1)

  // Find where text content ends (before any nested lists)
  const textContentEndIndex = siblingsAfterCheckbox.findIndex(
    (sibling) => sibling.type === "element" && (sibling as Element).tagName === "ul",
  )
  const endIndex = textContentEndIndex === -1 ? siblingsAfterCheckbox.length : textContentEndIndex

  const label: Element = {
    type: "element",
    tagName: "label",
    properties: { htmlFor: checkboxId },
    children: [node, ...siblingsAfterCheckbox.slice(0, endIndex)] as ElementContent[],
  }

  // Replace checkbox and text content with label; nested lists remain as siblings
  parent.children.splice(index, endIndex + 1, label)
}

/** Processes checkbox input elements and wraps them with their text in label elements. */
function processCheckboxElements(tree: HtmlRoot): void {
  const checkboxes: CheckboxInfo[] = []
  let checkboxCounter = 0

  visit(tree, "element", (node, index, parent) => {
    if (
      node.tagName !== "input" ||
      node.properties.type !== "checkbox" ||
      !parent ||
      index === undefined
    ) {
      return undefined
    }

    // Skip checkboxes already inside a label
    if (parent.type === "element" && (parent as Element).tagName === "label") {
      return SKIP
    }

    const isChecked = Boolean(node.properties?.checked ?? false)
    const checkboxId = `checkbox-${checkboxCounter++}`
    const willBeWrappedInLabel = isCheckboxInListItemWithContent(parent, index)

    node.properties = createCheckboxProperties(isChecked, checkboxId, willBeWrappedInLabel)
    checkboxes.push({ node, index, parent, checkboxId, willBeWrappedInLabel })
    return undefined
  })

  // Process in reverse order to avoid index shifting during tree modification
  for (let i = checkboxes.length - 1; i >= 0; i--) {
    const { node, index, parent, checkboxId, willBeWrappedInLabel } = checkboxes[i]
    if (willBeWrappedInLabel) {
      wrapCheckboxInLabel(node, parent, index, checkboxId)
    }
  }
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

      // Reset slugger per file so IDs are unique per page, not globally
      resetSlugger()

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
          const embedDisplay = value.startsWith("!") ? "!" : ""

          // Handle anchor/header processing
          let displayAnchor = ""
          if (rawHeader === "#") {
            // Preserve bare "#" for intro transclusion (![[page#]])
            displayAnchor = "#"
          } else if (rawHeader) {
            const anchor = rawHeader.trim().replace(/^#+/, "")
            const blockRef = anchor.startsWith("^") ? "^" : ""
            displayAnchor = `#${blockRef}${slugAnchor(anchor)}`
          }

          // Handle alias processing - only use explicitly provided aliases
          const displayAlias = rawAlias ?? ""

          /* istanbul ignore next -- external link wikilink edge case */
          if (rawFp && externalLinkRegex.test(rawFp)) {
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
