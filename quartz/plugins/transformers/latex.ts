import type { Element, ElementContent, Root } from "hast"

import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"
import { CONTINUE, SKIP, visit } from "unist-util-visit"
import { VFile } from "vfile"

import type { QuartzTransformerPlugin } from "../types"

import { hasClass } from "./utils"

const macros = {
  "\\abs": "\\left|#1\\right|",
  "\\prn": "\\left(#1\\right)",
  "\\brx": "\\left[#1\\right]",
  "\\set": "\\left\\{#1\\right\\}",
  "\\defeq": "\\coloneqq",
  "\\eqdef": "\\eqqcolon",
  "\\x": "\\mathbf{x}",
  "\\av": "\\mathbf{a}",
  "\\bv": "\\mathbf{b}",
  "\\cv": "\\mathbf{c}",
  "\\reals": "\\mathbb{R}",
  "\\argmax": "\\operatorname*{arg\\,max}",
  "\\argsup": "\\operatorname*{arg\\,sup}",
  "\\unitvec": "\\mathbf{e}_{#1}",
  "\\St": "\\mathcal{S}",
  "\\A": "\\mathcal{A}",
  "\\rf": "\\mathbf{r}",
  "\\uf": "\\mathbf{u}",
  "\\rewardSpace": "\\reals^{\\St}",
  "\\rewardVS": "\\reals^{\\abs{\\St}}",
  "\\Prb": "\\mathbb{P}",
  "\\prob": "\\Prb_{#1}\\prn{#2}",
  "\\lone": "\\left \\lVert#1\\right \\rVert_1",
  "\\ltwo": "\\left \\lVert#1\\right \\rVert_2",
  "\\linfty": "\\left \\lVert#1\\right \\rVert_\\infty",
  "#": "\\#",
  "⨉": "×",
  "⅓": "$\\frac{1}{3}$",
  "꙳": "$\\star$",
}

function isBase(node: ElementContent | undefined): node is Element {
  return node?.type === "element" && hasClass(node, "base")
}

/** Trailing `.mspace` glue is skipped, except an author's explicit `\allowbreak`. */
function endsWithRelation(base: Element): boolean {
  const last = base.children.findLast(
    (child) =>
      child.type === "element" && (!hasClass(child, "mspace") || hasClass(child, "allowbreak")),
  )
  return last?.type === "element" && hasClass(last, "mrel")
}

/**
 * KaTeX ends a `.base` inline-block after each top-level relation, and the
 * browser may wrap between adjacent inline-blocks. Merging the following
 * `.base` into the relation's `.base` binds the relation to its right operand
 * like a non-breaking space, so `α ∈ {0.2, 0.4}` never strands `α ∈` at a line
 * end. Breaks remain after binary operators and at `\allowbreak`; a chain of
 * relations with neither, such as `a = b = c`, becomes unbreakable.
 */
export function glueRelations(katexHtml: Element): void {
  const merged: ElementContent[] = []
  for (const child of katexHtml.children) {
    const previous = merged.at(-1)
    if (isBase(previous) && isBase(child) && endsWithRelation(previous)) {
      previous.children.push(...child.children)
    } else {
      merged.push(child)
    }
  }
  katexHtml.children = merged
}

export const Latex: QuartzTransformerPlugin = () => {
  return {
    name: "Latex",
    markdownPlugins() {
      return [remarkMath]
    },
    htmlPlugins() {
      return [
        [
          rehypeKatex,
          { output: "htmlAndMathml", strict: false, trust: true, macros, colorIsTextColor: true },
        ],
        () => (tree: Root, file: VFile) => {
          // Add tabindex="0" to .katex-display spans so they satisfy the axe
          // scrollable-region-focusable rule in static HTML (before JS runs).
          // CSS gives .katex-display `overflow: auto hidden`, making it scrollable.
          // The client-side katex-a11y-tabindex.js refines this at runtime,
          // removing tabindex from elements that don't actually overflow.
          // Inline math also has its relations glued to their right operands;
          // display math never wraps, so it is left as KaTeX emitted it.
          visit(tree, "element", (node: Element) => {
            const classes = node.properties?.className
            if (!Array.isArray(classes)) return CONTINUE
            if (classes.includes("katex") || classes.includes("katex-display")) {
              // Flag the page so `<Head>` loads the katex stylesheet, which is
              // render-blocking and otherwise wasted on math-free pages.
              file.data.usesKatex = true
            }
            if (classes.includes("katex-display")) {
              node.properties.tabIndex = 0
              node.properties.role = "group"
              return SKIP
            }
            if (classes.includes("katex-html")) {
              glueRelations(node)
            }
            return CONTINUE
          })
        },
      ]
    },
    externalResources() {
      return {
        css: ["/static/styles/katex.min.css"],
      }
    },
  }
}
