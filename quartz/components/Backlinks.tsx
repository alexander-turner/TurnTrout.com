import type { JSX } from "preact"

import { RootContent, Parent, Text, Element, Root, Data } from "hast"
import { fromHtml } from "hast-util-from-html"
import React from "react"

import { replaceSCInNode } from "../plugins/transformers/tagSmallcaps"
import { resolveRelative, simplifySlug } from "../util/path"
import { FullSlug } from "../util/path"
import { formatTitle } from "./component_utils"
import { QuartzComponent, QuartzComponentProps } from "./types"

function processSmallCaps(text: string, parent: Parent): void {
  const textNode = { type: "text", value: text } as Text
  parent.children.push(textNode)
  replaceSCInNode(textNode, [parent])
}

function processBacklinkTitle(title: string): Parent {
  // Apply formatTitle before processing
  const formattedTitle = formatTitle(title)
  const parent = { type: "element", tagName: "span", properties: {}, children: [] } as Parent
  const htmlAst = fromHtml(formattedTitle, { fragment: true })
  processHtmlAst(htmlAst, parent)
  return parent
}

function processHtmlAst(htmlAst: Root | Element, parent: Parent): void {
  htmlAst.children.forEach((node: RootContent) => {
    if (node.type === "text") {
      processSmallCaps(node.value, parent)
    } else if (node.type === "element") {
      const newElement = {
        type: "element",
        tagName: node.tagName,
        properties: { ...node.properties },
        children: [],
      } as Element
      parent.children.push(newElement)
      processHtmlAst(node, newElement)
    }
  })
}

function elementToJsx(elt: RootContent): JSX.Element {
  switch (elt.type) {
    case "text":
      // skipcq: JS-0424 want to cast as JSX element
      return <>{elt.value}</>
    case "element":
      if (elt.tagName === "abbr") {
        const abbrText = (elt.children[0] as Text).value
        const className = (elt.properties?.className as string[])?.join(" ") || ""
        return <abbr className={className}>{abbrText}</abbr>
      } else {
        return <span>{elt.children.map(elementToJsx)}</span>
      }
    default:
      // skipcq: JS-0424 want to cast as JSX element
      return <></>
  }
}

const BacklinksList = ({
  backlinkFiles,
  currentSlug,
}: {
  backlinkFiles: Data[]
  currentSlug: FullSlug
}): JSX.Element => (
  <ul className="backlinks-list" id="backlinks">
    {backlinkFiles.map((f) => {
      if (!("frontmatter" in f) || !("slug" in f)) {
        return null
      }
      const processedTitle = processBacklinkTitle(
        (f.frontmatter as Record<string, unknown>).title as string,
      )
      return (
        <li key={f.slug}>
          <a href={resolveRelative(currentSlug, f.slug as FullSlug)} className="internal">
            {processedTitle.children.map(elementToJsx)}
          </a>
        </li>
      )
    })}
  </ul>
)

export const Backlinks: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  const slug = simplifySlug(fileData.slug || ("" as FullSlug))
  const backlinkFiles = allFiles.filter((file) => file.links?.includes(slug))

  if (backlinkFiles.length === 0) return null

  return (
    <blockquote
      className="callout callout-metadata is-collapsible is-collapsed"
      data-callout="link"
      data-callout-fold=""
    >
      <div className="callout-title">
        <div className="callout-icon"></div>
        <div className="callout-title-inner">
          <p>Links to this page</p>
        </div>
        <div className="fold-callout-icon"></div>
      </div>
      <div className="callout-content" id="backlinks-callout">
        <BacklinksList backlinkFiles={backlinkFiles} currentSlug={fileData.slug as FullSlug} />
      </div>
    </blockquote>
  )
}

// TODO apply tag-acronyms
