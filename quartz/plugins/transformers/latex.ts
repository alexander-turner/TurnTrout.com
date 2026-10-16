import type { Element, ElementContent, Root } from "hast"

import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"
import { visit } from "unist-util-visit"
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

/** True when the last visible atom of a KaTeX `.base` is a relation such as `=` or `\in`. */
function endsWithRelation(base: Element): boolean {
  const atoms = base.children.filter(
    (child): child is Element => child.type === "element" && !hasClass(child, "mspace"),
  )
  const last = atoms.at(-1)
  return last !== undefined && hasClass(last, "mrel")
}

/**
 * KaTeX ends a `.base` inline-block after each top-level relation, and the
 * browser may wrap between adjacent inline-blocks. Merging the following
 * `.base` into the relation's binds a relation to its right operand like a
 * non-breaking space, so `α ∈ {0.2, 0.4}` never strands `α ∈` at a line end.
 * Breaks after binary operators stay available for long formulas.
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
          visit(tree, "element", (node: Element) => {
            const classes = node.properties?.className
            if (!Array.isArray(classes)) return
            if (classes.includes("katex") || classes.includes("katex-display")) {
              // Flag the page so `<Head>` loads the katex stylesheet, which is
              // render-blocking and otherwise wasted on math-free pages.
              file.data.usesKatex = true
            }
            if (classes.includes("katex-html")) {
              glueRelations(node)
            }
            if (classes.includes("katex-display")) {
              node.properties.tabIndex = 0
              node.properties.role = "group"
            }
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
