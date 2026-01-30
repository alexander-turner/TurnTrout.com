/**
 * This file implements the TableOfContents component for Quartz.
 * It renders a table of contents based on the headings in the current page,
 * supporting small caps and LaTeX rendering.
 */

import type { RootContent, Parent, Element, Root } from "hast"
import type { JSX } from "preact"

import { fromHtml } from "hast-util-from-html"
// skipcq: JS-W1028
import React from "react"

import { arrowsToWrap } from "../plugins/transformers/formatting_improvement_html"
import { type TocEntry } from "../plugins/transformers/toc"
import { createWinstonLogger, getLogLevel } from "../util/log"
import {
  formatTitle,
  processInlineCode,
  processKatex,
  processSmallCaps,
  processTextWithArrows,
} from "./component_utils"
import modernStyle from "./styles/toc.scss"
import {
  type QuartzComponent,
  type QuartzComponentConstructor,
  type QuartzComponentProps,
} from "./types"

const logger = createWinstonLogger("TableOfContents", getLogLevel())
/**
 * TableOfContents component for rendering a table of contents.
 *
 * @param props - The component props.
 * @param props.fileData - Data for the current file.
 * @returns The rendered table of contents or null if disabled.
 */
export const CreateTableOfContents: QuartzComponent = ({
  fileData,
}: QuartzComponentProps): JSX.Element | null => {
  logger.info(`Rendering TableOfContents for file: ${fileData.filePath}`)

  const frontmatterToc = fileData.frontmatter?.toc
  const tocData = fileData.toc

  if (!tocData || frontmatterToc === false || frontmatterToc === "false") {
    logger.info(
      `TableOfContents skipped for ${fileData.filePath}: no TOC data or disabled in frontmatter`,
    )
    return null
  }

  const toc = buildNestedList(tocData, 0, 0)[0]

  if (!toc || toc.length === 0) {
    logger.info(`TableOfContents skipped for ${fileData.filePath}: nested list is empty`)
    return null
  }

  return (
    <div id="table-of-contents" className="desktop-only">
      <h1 id="toc-title" className="h6">
        <button className="internal same-page-link">
          {formatTitle(fileData.frontmatter?.title || "Table of Contents")}
        </button>
      </h1>
      <div id="toc-content">
        <ol>{toc}</ol>
      </div>
    </div>
  )
}

/**
 * Recursively builds a nested list for the table of contents.
 *
 * @param entries - The TOC entries to process.
 * @param currentIndex - The current index in the entries array.
 * @param currentDepth - The current depth in the TOC hierarchy.
 * @returns A tuple containing an array of JSX elements and the next index to process.
 */
export function buildNestedList(
  entries: TocEntry[],
  currentIndex = 0,
  currentDepth = entries[0]?.depth || 0,
): [JSX.Element[], number] {
  const listItems: JSX.Element[] = []
  const totalEntries = entries.length
  let index = currentIndex

  while (index < totalEntries) {
    const entry = entries[index]

    if (entry.depth < currentDepth) {
      break
    } else if (entry.depth > currentDepth) {
      const [nestedListItems, nextIndex] = buildNestedList(entries, index, entry.depth)
      if (listItems.length > 0) {
        const lastItem = listItems[listItems.length - 1]
        listItems[listItems.length - 1] = (
          <li key={`li-${index}`}>
            {lastItem.props.children}
            <ol key={`ol-${index}`}>{nestedListItems}</ol>
          </li>
        )
      } else {
        listItems.push(
          <li key={`li-${index}`}>
            <ol key={`ol-${index}`}>{nestedListItems}</ol>
          </li>,
        )
      }
      index = nextIndex
    } else {
      listItems.push(<li key={`li-${index}`}>{toJSXListItem(entry)}</li>)
      index++
    }
  }

  return [listItems, index]
}

/**
 * Generates the table of contents as a nested list.
 *
 * @param entries - The TOC entries to process.
 * @returns A JSX element representing the nested TOC.
 */
export function addListItem(entries: TocEntry[]): JSX.Element {
  logger.debug(`addListItem called with ${entries.length} entries`)

  const [listItems] = buildNestedList(entries)
  logger.debug(`Returning ${listItems.length} JSX elements`)
  return <ol>{listItems}</ol>
}

/**
 * Converts a table of contents entry into a JSX list item link.
 * @param entry - The TocEntry object representing the entry to convert.
 * @returns A JSX.Element representing the link list item.
 */
export function toJSXListItem(entry: TocEntry): JSX.Element {
  const entryParent: Parent = processTocEntry(entry)
  return (
    <a href={`#${entry.slug}`} className="internal same-page-link" data-for={entry.slug}>
      {entryParent.children.map(elementToJsx)}
    </a>
  )
}

const arrowRegex = new RegExp(`(?<arrow>${arrowsToWrap.join("|")})`)
const latexRegex = /(?<latex>\$[^$]+\$)/u
const inlineCodeRegex = /(?<code>`[^`]+`)/u
const regexSource = [arrowRegex, latexRegex, inlineCodeRegex].map((r) => r.source).join("|")
/**
 * Processes small caps, LaTeX, arrows, and inline code in a TOC entry.
 *
 * @param entry - The TOC entry to process.
 * @returns A Parent object representing the processed entry.
 */
export function processTocEntry(entry: TocEntry): Parent {
  logger.debug(`Processing TOC entry: ${entry.text}`)
  const parent = { type: "element", tagName: "span", properties: {}, children: [] } as Parent

  const parts = entry.text.split(new RegExp(regexSource))
  parts.forEach((part) => {
    if (!part) {
      return
    }

    if (part.startsWith("$") && part.endsWith("$")) {
      // LaTeX expression
      const latex = part.slice(1, -1)
      processKatex(latex, parent)
    } else if (part.startsWith("`") && part.endsWith("`")) {
      // Inline code
      const code = part.slice(1, -1)
      processInlineCode(code, parent)
    } else if (arrowsToWrap.includes(part)) {
      processTextWithArrows(part, parent)
    } else {
      // Parse as HTML and process for things like leading numbers and smallcaps
      const htmlAst = fromHtml(part, { fragment: true })
      processHtmlAst(htmlAst, parent)
    }
  })

  return parent
}

/**
 * Processes the HTML AST, handling text nodes and elements recursively.
 *
 * @param htmlAst - The HTML AST to process.
 * @param parent - The parent node to add processed nodes to.
 */
export function processHtmlAst(htmlAst: Root | Element, parent: Parent): void {
  htmlAst.children.forEach((node: RootContent) => {
    if (node.type === "text") {
      const textValue = node.value
      let textToProcess = textValue

      const leadingNumberRegex = /^(?<numberPart>\d+:?\s*)(?<restText>.*)$/
      const match = textValue.match(leadingNumberRegex)
      if (match?.groups) {
        // Leading numbers and colon found
        const numberPart = match.groups.numberPart
        const restText = match.groups.restText

        // Create span for numberPart
        const numberSpan = {
          type: "element",
          tagName: "span",
          properties: { className: ["number-prefix"] },
          children: [{ type: "text", value: numberPart }],
        } as Element
        parent.children.push(numberSpan)

        textToProcess = restText
      }

      processSmallCaps(textToProcess, parent)
    } else if (node.type === "element") {
      const newElement = {
        type: "element",
        tagName: node.tagName,
        properties: { ...node.properties },
        children: [],
      } as Element
      parent.children.push(newElement)
      processHtmlAst(node as Element, newElement)
    }
  })
}

/**
 * Renders an abbreviation element (<abbr>) in the TOC with the appropriate class names and text content.
 */
const handleAbbr = (elt: Element): JSX.Element => {
  const abbrText = (elt.children[0] as { value: string }).value
  const className = (elt.properties?.className as string[])?.join(" ") || ""
  return <abbr className={className}>{abbrText}</abbr>
}

/**
 * Renders a span element in the TOC with the appropriate class names and text content.
 */
const handleSpan = (elt: Element): JSX.Element => {
  const classNames = (elt.properties?.className as string[]) || []

  if (classNames.includes("katex-toc")) {
    const katexChild = elt.children[0]
    const katexHtml = katexChild && "value" in katexChild ? katexChild.value : ""
    // skipcq: JS-0440 (katexHtml comes from our own build process)
    return <span className="katex-toc" dangerouslySetInnerHTML={{ __html: katexHtml }} />
  }

  if (classNames.includes("number-prefix")) {
    return <span className="number-prefix">{elt.children.map(elementToJsx)}</span>
  }

  if (classNames.includes("monospace-arrow")) {
    return <span className="monospace-arrow">{elt.children.map(elementToJsx)}</span>
  }

  if (classNames.includes("inline-code")) {
    return <code className="inline-code">{elt.children.map(elementToJsx)}</code>
  }

  return <span>{elt.children.map(elementToJsx)}</span>
}

// Convert HAST element to JSX element
export function elementToJsx(elt: RootContent): JSX.Element | null {
  switch (elt.type) {
    case "text":
      return elt.value as unknown as JSX.Element
    case "element":
      return elt.tagName === "abbr" ? handleAbbr(elt) : handleSpan(elt)
    default:
      return null
  }
}

CreateTableOfContents.css = modernStyle
CreateTableOfContents.afterDOMLoaded = `
document.addEventListener('nav', function() {
  // Scroll to top when TOC title is clicked
  const tocTitleButton = document.querySelector("#toc-title button");
  if (tocTitleButton) {
    tocTitleButton.addEventListener("click", () => {
      const url = new URL(window.location.pathname, window.location.origin);
      window.spaNavigate(url);
      // Make sure we scroll to the top
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }

  const sections = document.querySelectorAll("#center-content h1, #center-content h2");
  const navLinks = document.querySelectorAll("#toc-content a");

  function updateActiveLink() {
    let currentSection = "";
    const scrollPosition = window.scrollY + window.innerHeight / 4;

    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      if (scrollPosition >= sectionTop) {
        currentSection = section.id;
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove("active");
      const slug = link.getAttribute('href').split("#")[1];
      if (currentSection && slug === currentSection) {
        link.classList.add("active");
      }
    });
  }

  window.addEventListener("scroll", updateActiveLink);

  // Initial call to set active link on page load
  updateActiveLink();
});
`

export default ((): QuartzComponent => {
  logger.info("TableOfContents component initialized")
  return CreateTableOfContents
}) satisfies QuartzComponentConstructor
