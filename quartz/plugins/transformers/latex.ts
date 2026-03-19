import type { Element, Root } from "hast"

import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"
import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

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
        () => (tree: Root) => {
          // Add tabindex="0" to .katex-display spans so they satisfy the axe
          // scrollable-region-focusable rule in static HTML (before JS runs).
          // CSS gives .katex-display `overflow: auto hidden`, making it scrollable.
          // The client-side katex-a11y-tabindex.js refines this at runtime,
          // removing tabindex from elements that don't actually overflow.
          visit(tree, "element", (node: Element) => {
            const classes = node.properties?.className
            if (Array.isArray(classes) && classes.includes("katex-display")) {
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
