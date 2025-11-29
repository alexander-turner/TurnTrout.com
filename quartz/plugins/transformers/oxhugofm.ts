import type { QuartzTransformerPlugin } from "../types"

export interface Options {
  /** Replace {{ relref }} with quartz wikilinks []() */
  wikilinks: boolean
  /** Remove pre-defined anchor (see https://ox-hugo.scripter.co/doc/anchors/) */
  removePredefinedAnchor: boolean
  /** Remove hugo shortcode syntax */
  removeHugoShortcode: boolean
  /** Replace <figure/> with ![]() */
  replaceFigureWithMdImg: boolean

  /** Replace org latex fragments with $ and $$ */
  replaceOrgLatex: boolean
}

const defaultOptions: Options = {
  wikilinks: true,
  removePredefinedAnchor: true,
  removeHugoShortcode: true,
  replaceFigureWithMdImg: true,
  replaceOrgLatex: true,
}

// Regex for Hugo relref shortcode
const relrefRegex = new RegExp(/\[([^\]]+)\]\(\{\{< relref "([^"]+)" >\}\}\)/, "g")
// Regex for predefined heading IDs in Markdown
const predefinedHeadingIdRegex = new RegExp(/(.*) {#(?:.*)}/, "g")
// Regex for Hugo shortcodes
const hugoShortcodeRegex = new RegExp(/{{(.*)}}/, "g")
// Regex for HTML figure tags
const figureTagRegex = new RegExp(/< ?figure src="(.*)" ?>/, "g")
// Regex for inline LaTeX: matches \\( ... \\)
const inlineLatexRegex = new RegExp(/\\\\\((.+?)\\\\\)/, "g")
// Regex for block LaTeX: matches various LaTeX delimiters
const blockLatexRegex = new RegExp(
  /(?:\\begin{equation}|\\\\\(|\\\\\[)([\s\S]*?)(?:\\\\\]|\\\\\)|\\end{equation})/,
  "g",
)
// Regex for Quartz-style LaTeX: matches both inline ($...$) and block ($$...$$) equations
const quartzLatexRegex = new RegExp(/\$\$[\s\S]*?\$\$|\$.*?\$/, "g")

/**
 * ox-hugo is an org exporter backend that exports org files to hugo-compatible
 * markdown in an opinionated way. This plugin adds some tweaks to the generated
 * markdown to make it compatible with quartz but the list of changes applied it
 * is not exhaustive.
 * */
export const OxHugoFlavouredMarkdown: QuartzTransformerPlugin<Partial<Options> | undefined> = (
  userOpts,
) => {
  const opts = { ...defaultOptions, ...userOpts }
  return {
    name: "OxHugoFlavouredMarkdown",
    textTransform(_ctx, src) {
      if (opts.wikilinks) {
        // Convert Hugo relref shortcodes to Markdown links
        src = src.toString()
        src = src.replaceAll(relrefRegex, (value, ...capture) => {
          const [text, link] = capture
          return `[${text}](${link})`
        })
      }

      if (opts.removePredefinedAnchor) {
        // Remove predefined heading IDs
        src = src.toString()
        src = src.replaceAll(predefinedHeadingIdRegex, (value, ...capture) => {
          const [headingText] = capture
          return headingText
        })
      }

      if (opts.removeHugoShortcode) {
        // Remove Hugo shortcodes
        src = src.toString()
        src = src.replaceAll(hugoShortcodeRegex, (value, ...capture) => {
          const [scContent] = capture
          return scContent
        })
      }

      if (opts.replaceFigureWithMdImg) {
        // Replace HTML figure tags with Markdown image syntax
        src = src.toString()
        src = src.replaceAll(figureTagRegex, (value, ...capture) => {
          const [src] = capture
          return `![](${src})`
        })
      }

      if (opts.replaceOrgLatex) {
        // Convert org-mode LaTeX to Quartz-compatible LaTeX
        src = src.toString()
        src = src.replaceAll(inlineLatexRegex, (value, ...capture) => {
          const [eqn] = capture
          return `$${eqn}$`
        })
        src = src.replaceAll(blockLatexRegex, (value, ...capture) => {
          const [eqn] = capture
          return `$$${eqn}$$`
        })

        // Unescape underscores in LaTeX equations
        src = src.replaceAll(quartzLatexRegex, (value) => {
          return value.replaceAll("\\_", "_")
        })
      }
      return src
    },
  }
}
