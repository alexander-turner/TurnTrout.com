import type { Element, Root } from "hast"

import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

import { renderLineChart } from "./charts/line-renderer"
import { parseChartSpec } from "./charts/parse"

/** Inline script that positions annotation tooltips at the user's initial hover x. */
const ANNOTATION_TOOLTIP_SCRIPT = `(function () {
  var figure = document.currentScript && document.currentScript.parentElement;
  var svg = figure && figure.querySelector("svg.smart-chart");
  if (!svg) return;

  svg.querySelectorAll(".smart-chart-annotation").forEach(function (annotation) {
    var hitArea = annotation.querySelector(".smart-chart-annotation-hit");
    var tooltip = annotation.querySelector(".smart-chart-tooltip");
    var tooltipBg = annotation.querySelector(".smart-chart-tooltip-bg");
    if (!hitArea || !tooltip) return;

    hitArea.addEventListener("mouseenter", function (e) {
      // Convert mouse clientX to SVG coordinates
      var ctm = svg.getScreenCTM();
      if (!ctm) return;
      var x = (e.clientX - ctm.e) / ctm.a;

      // Subtract the inner group's translate offset
      var innerGroup = annotation.parentElement;
      if (innerGroup) {
        var transform = innerGroup.getAttribute("transform");
        var match = transform && transform.match(/translate\\(([^,)]+)/);
        if (match) x -= parseFloat(match[1]);
      }

      // Clamp so the tooltip background stays within the chart area
      var bgWidth = tooltipBg ? parseFloat(tooltipBg.getAttribute("width") || "0") : 0;
      var chartWidth = parseFloat(hitArea.getAttribute("width") || "0");
      x = Math.max(bgWidth / 2, Math.min(chartWidth - bgWidth / 2, x));

      // Position the tooltip text and all its tspan children
      tooltip.setAttribute("x", "" + x);
      tooltip.querySelectorAll("tspan").forEach(function (tspan) {
        tspan.setAttribute("x", "" + x);
      });
      if (tooltipBg) tooltipBg.setAttribute("x", "" + (x - bgWidth / 2));

      // Show tooltip
      tooltip.style.display = "block";
      if (tooltipBg) tooltipBg.style.display = "block";
    });

    hitArea.addEventListener("mouseleave", function () {
      tooltip.style.display = "";
      if (tooltipBg) tooltipBg.style.display = "";
    });
  });
})();`

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
          const script: Element = {
            type: "element",
            tagName: "script",
            properties: {},
            children: [{ type: "text" as const, value: ANNOTATION_TOOLTIP_SCRIPT }],
          }
          const figure: Element = {
            type: "element",
            tagName: "figure",
            properties: { className: ["smart-chart-container"] },
            children: [svg, script],
          }

          parent.children[index] = figure
        })
      },
    ]
  },
})
