/**
 * This file implements the TableOfContents component for Quartz.
 * It renders a table of contents based on the headings in the current page,
 * supporting small caps and LaTeX rendering.
 */

import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import React from "react"
import { createLogger } from "../plugins/transformers/logger_utils"
import modernStyle from "./styles/toc.scss"
import { RootContent, Parent, Text, Element, Root } from "hast"
import { replaceSCInNode } from "../plugins/transformers/tagacronyms"
import { TocEntry } from "../plugins/transformers/toc"
import katex from "katex"
import { fromHtml } from "hast-util-from-html"

/**
 * Processes small caps in the given text and adds it to the parent node.
 * @param text - The text to process.
 * @param parent - The parent node to add the processed text to.
 */
export function processSmallCaps(text: string, parent: Parent): void {
  const insertIndex = parent.children.length
  const textNode = { type: "text", value: text } as Text
  parent.children.push(textNode)
  replaceSCInNode(textNode, insertIndex, parent)
}

/**
 * Processes LaTeX content and adds it to the parent node as a KaTeX-rendered span.
 * @param latex - The LaTeX content to process.
 * @param parent - The parent node to add the processed LaTeX to.
 */
export function processKatex(latex: string, parent: Parent): void {
  const html = katex.renderToString(latex, { throwOnError: false })
  const katexNode = {
    type: "element",
    tagName: "span",
    properties: { className: ["katex-toc"] },
    children: [{ type: "raw", value: html }],
  } as Element
  parent.children.push(katexNode)
}

const logger = createLogger("TableOfContents")
/**
 * TableOfContents component for rendering a table of contents.
 *
 * @param props - The component props.
 * @param props.fileData - Data for the current file.
 * @returns The rendered table of contents or null if disabled.
 */
export const CreateTableOfContents: QuartzComponent = ({ fileData }: QuartzComponentProps): JSX.Element | null => {
  logger.info(`Rendering TableOfContents for file: ${fileData.filePath}`)

  if (!fileData.toc || fileData.frontmatter?.toc === "false") {
    logger.info(
      `TableOfContents skipped for ${fileData.filePath}: no TOC data or disabled in frontmatter`,
    )
    return null
  }

  const toc = buildNestedList(fileData.toc, 0, 0)[0]

  return (
    <div id="table-of-contents" className="desktop-only">
      <h6 className="toc-title">
        <a href="#">Table of Contents</a>
      </h6>
      <div id="toc-content">
        <ul className="overflow">{toc}</ul>
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
            <ul key={`ul-${index}`}>{nestedListItems}</ul>
          </li>
        )
      } else {
        listItems.push(
          <li key={`li-${index}`}>
            <ul key={`ul-${index}`}>{nestedListItems}</ul>
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
  return <ul>{listItems}</ul>
}

/**
 * Converts a TocEntry to a JSX list item element.
 */
export function toJSXListItem(entry: TocEntry): JSX.Element {
  const entryParent: Parent = processTocEntry(entry)
  return (
    <a href={`#${entry.slug}`} data-for={entry.slug}>
      {entryParent.children.map(elementToJsx)}
    </a>
  )
}

/**
 * Processes small caps and LaTeX in a TOC entry.
 *
 * @param entry - The TOC entry to process.
 * @returns A Parent object representing the processed entry.
 */
export function processTocEntry(entry: TocEntry): Parent {
  logger.debug(`Processing TOC entry: ${entry.text}`)
  const parent = { type: "element", tagName: "span", properties: {}, children: [] } as Parent

  // Split the text by LaTeX delimiters
  const parts = entry.text.split(/(\$[^$]+\$)/g)

  parts.forEach((part) => {
    if (part.startsWith("$") && part.endsWith("$")) {
      // LaTeX expression
      const latex = part.slice(1, -1)
      processKatex(latex, parent)
    } else {
      // Parse as HTML and process
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
      const regex = /^(\d+:\s*)(.*)$/
      const match = textValue.match(regex)
      if (match) {
        // Leading numbers and colon found
        const numberPart = match[1]
        const restText = match[2]

        // Create span for numberPart
        const numberSpan = {
          type: "element",
          tagName: "span",
          properties: { className: ["number-prefix"] },
          children: [{ type: "text", value: numberPart }],
        } as Element
        parent.children.push(numberSpan)

        // Process the rest of the text
        if (restText) {
          processSmallCaps(restText, parent)
        }
      } else {
        // No leading numbers, process as usual
        processSmallCaps(textValue, parent)
      }
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
 * Converts a HAST element to a JSX element.
 *
 * @param elt - The HAST element to convert.
 * @returns The converted JSX element.
 */
export function elementToJsx(elt: RootContent): JSX.Element {
  logger.debug(`Converting element to JSX: ${JSON.stringify(elt)}`)

  switch (elt.type) {
    case "text":
      return <>{elt.value}</>
    case "element":
      if (elt.tagName === "abbr") {
        const abbrText = (elt.children[0] as Text).value
        const className = (elt.properties?.className as string[])?.join(" ") || ""
        return <abbr className={className}>{abbrText}</abbr>
      } else if (elt.tagName === "span") {
        const classNames = (elt.properties?.className as string[]) || []
        if (classNames.includes("katex-toc")) {
          return (
            <span
              className="katex-toc"
              dangerouslySetInnerHTML={{ __html: (elt.children[0] as { value: string }).value }}
            />
          )
        } else if (classNames.includes("number-prefix")) {
          // Render the number-prefix span
          return <span className="number-prefix">{elt.children.map(elementToJsx)}</span>
        } else {
          // Handle other spans
          return <span>{elt.children.map(elementToJsx)}</span>
        }
      }
      // Handle other element types if needed
      break

    case "comment":
    case "doctype":
      // Ignore these types in rendering
      return <></>

    default:
      logger.warn(`Unexpected node type encountered: ${elt.type}`)
      return <></>
  }

  return <></>
}


CreateTableOfContents.css = modernStyle
CreateTableOfContents.afterDOMLoaded = `
document.addEventListener('nav', function() {
  const sections = document.querySelectorAll(".center h1, .center h2");
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
