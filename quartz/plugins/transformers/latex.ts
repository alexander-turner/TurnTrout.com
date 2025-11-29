import rehypeKatex from "rehype-katex"
import rehypeMathjax from "rehype-mathjax/svg"
import remarkMath from "remark-math"

import type { QuartzTransformerPlugin } from "../types"

interface Options {
  renderEngine: "katex" | "mathjax"
}
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

export const Latex: QuartzTransformerPlugin<Options> = (opts?: Options) => {
  const engine = opts?.renderEngine ?? "katex"
  return {
    name: "Latex",
    markdownPlugins() {
      return [remarkMath]
    },
    htmlPlugins() {
      if (engine === "katex") {
        return [
          [
            rehypeKatex,
            { output: "html", strict: false, trust: true, macros, colorIsTextColor: true },
          ],
        ]
      } else {
        return [rehypeMathjax]
      }
    },
    externalResources() {
      if (engine === "katex") {
        return {
          css: ["/static/styles/katex.min.css"],
        }
      } else {
        return {}
      }
    },
  }
}
