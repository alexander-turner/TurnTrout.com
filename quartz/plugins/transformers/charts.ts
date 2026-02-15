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
 * Shiki-processed code blocks have nested spans — collect all text.
 */
function getCodeText(node: Element): string {
  if (node.children.length === 1 && node.children[0].type === "text") {
    return node.children[0].value
  }
  let text = ""
  visit(node, "text", (textNode) => {
    text += textNode.value
  })
  return text
}

function hasChartLanguage(el: Element): boolean {
  // rehype-pretty-code uses data-language attribute
  if (el.properties?.dataLanguage === "chart") return true
  // Standard markdown pipeline uses class="language-chart"
  const className = el.properties?.className
  if (Array.isArray(className)) {
    return className.some((c) => String(c) === "language-chart")
  }
  return false
}

/**
 * Detects chart code blocks in two forms:
 * 1. Before Shiki: <pre><code class="language-chart">...</code></pre>
 * 2. After Shiki:  <figure data-rehype-pretty-code-figure>
 *                    <pre data-language="chart"><code>...</code></pre>
 *                  </figure>
 */
function isChartCodeBlock(node: Element): boolean {
  // Direct <pre> with chart language (pre-Shiki or Shiki on <pre>)
  if (node.tagName === "pre") {
    if (hasChartLanguage(node)) return true
    const code = node.children.find(
      (child): child is Element => child.type === "element" && child.tagName === "code",
    )
    return code !== undefined && hasChartLanguage(code)
  }
  // rehype-pretty-code wraps in <figure data-rehype-pretty-code-figure>
  if (
    node.tagName === "figure" &&
    node.properties &&
    "dataRehypePrettyCodeFigure" in node.properties
  ) {
    const pre = node.children.find(
      (child): child is Element => child.type === "element" && child.tagName === "pre",
    )
    return pre !== undefined && hasChartLanguage(pre)
  }
  return false
}

function getCodeElement(node: Element): Element {
  // If this is a figure wrapper, drill into the pre first
  let container = node
  if (node.tagName === "figure") {
    const pre = node.children.find(
      (child): child is Element => child.type === "element" && child.tagName === "pre",
    )
    // istanbul ignore next -- isChartCodeBlock guarantees a pre exists inside chart figures
    if (pre) container = pre
  }
  return container.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "code",
  ) as Element
}

export const Charts: QuartzTransformerPlugin = () => ({
  name: "Charts",
  externalResources() {
    const tooltipScriptPath = path.join(
      currentDirPath,
      "../components/scripts/chart-tooltips.inline.js",
    )
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
