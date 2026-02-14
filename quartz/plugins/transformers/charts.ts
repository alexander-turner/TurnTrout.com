import type { Element, Root } from "hast"

import fs from "fs"
import path from "path"
import { visit } from "unist-util-visit"
import { fileURLToPath } from "url"

import type { QuartzTransformerPlugin } from "../types"

import { renderLineChart } from "./charts/line-renderer"
import { parseChartSpec } from "./charts/parse"

const currentFilePath = fileURLToPath(import.meta.url)
const currentDirPath = path.dirname(currentFilePath)

/**
 * Finds the text content of a code element (the YAML chart spec).
 * Code blocks are represented as <pre><code class="language-chart">...</code></pre>.
 */
function getCodeText(node: Element): string {
  if (node.children.length === 1 && node.children[0].type === "text") {
    return node.children[0].value
  }
  // Shiki-processed code blocks have nested spans — collect all text
  let text = ""
  visit(node, "text", (textNode) => {
    text += textNode.value
  })
  return text
}

function isChartCodeBlock(node: Element): boolean {
  if (node.tagName !== "pre") return false

  const code = node.children.find(
    (child) => child.type === "element" && child.tagName === "code",
  ) as Element | undefined
  if (!code) return false

  const className = code.properties?.className
  if (Array.isArray(className)) {
    return className.some((c) => String(c) === "language-chart")
  }
  return false
}

function getCodeElement(pre: Element): Element {
  return pre.children.find(
    (child) => child.type === "element" && child.tagName === "code",
  ) as Element
}

export const Charts: QuartzTransformerPlugin = () => ({
  name: "Charts",
  externalResources() {
    const tooltipScriptPath = path.join(currentDirPath, "../../static/scripts/chart-tooltips.js")
    const tooltipScript = fs.readFileSync(tooltipScriptPath, "utf8")
    return {
      js: [
        {
          script: tooltipScript,
          loadTime: "afterDOMReady",
          contentType: "inline",
        },
      ],
    }
  },
  htmlPlugins() {
    return [
      () => (tree: Root) => {
        visit(tree, "element", (node: Element, index: number | undefined, parent) => {
          // istanbul ignore next -- defensive: visit always provides parent with index
          if (index === undefined || !parent) return
          if (!isChartCodeBlock(node)) return

          const code = getCodeElement(node)
          const yamlText = getCodeText(code)
          const spec = parseChartSpec(yamlText)

          // parseChartSpec validates that type is "line" (the only supported type)
          const svg = renderLineChart(spec)

          // Replace the <pre> block with the rendered SVG wrapped in a figure
          const figure: Element = {
            type: "element",
            tagName: "figure",
            properties: { className: ["smart-chart-container"] },
            children: [svg],
          }

          parent.children[index] = figure
        })
      },
    ]
  },
})
