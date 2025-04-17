import type { JSX } from "preact"

import { type RootContent, type Parent, type Text, type Element, type Root } from "hast"
import { fromHtml } from "hast-util-from-html"
import React from "react"

import { type QuartzPluginData } from "../plugins/vfile"
import { type FullSlug, type SimpleSlug, resolveRelative, simplifySlug } from "../util/path"
import { formatTitle, processSmallCaps } from "./component_utils"
import { type QuartzComponent, type QuartzComponentProps } from "./types"

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
  backlinkFiles: QuartzPluginData[]
  currentSlug: FullSlug
}): JSX.Element => (
  <ul>
    {backlinkFiles.map((f) => {
      if (!("frontmatter" in f) || !("slug" in f) || !f.frontmatter?.title) {
        return null
      }
      const processedTitle = processBacklinkTitle(f.frontmatter.title)
      return (
        <li key={f.slug}>
          <a
            href={resolveRelative(currentSlug, f.slug as FullSlug)}
            className="internal can-trigger-popover"
          >
            {processedTitle.children.map(elementToJsx)}
          </a>
        </li>
      )
    })}
  </ul>
)

export const getBacklinkFiles = (
  allFiles: QuartzPluginData[],
  currentFile: QuartzPluginData,
): QuartzPluginData[] => {
  const slug = simplifySlug(currentFile.slug as FullSlug)
  return allFiles.filter((otherFile) => {
    const otherFileSlug = simplifySlug(otherFile.slug as FullSlug)
    return (
      otherFile.links?.some((link: SimpleSlug) => {
        // Remove anchor from link before comparison
        const linkWithoutAnchor = link.toString().split("#")[0]
        return linkWithoutAnchor === slug && otherFileSlug !== slug
      }) ?? false
    )
  })
}

export const Backlinks: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  const backlinkFiles: QuartzPluginData[] = getBacklinkFiles(allFiles, fileData)
  if (backlinkFiles.length === 0) return null

  return (
    <blockquote
      className="admonition admonition-metadata is-collapsible is-collapsed"
      id="backlinks"
      data-admonition="link"
      data-admonition-fold=""
    >
      <div className="admonition-title">
        <div className="admonition-icon"></div>
        <div className="admonition-title-inner">
          <p>Links to this page</p>
        </div>
        <div className="fold-admonition-icon"></div>
      </div>
      <div className="admonition-content" id="backlinks-admonition">
        <BacklinksList backlinkFiles={backlinkFiles} currentSlug={fileData.slug as FullSlug} />
      </div>
    </blockquote>
  )
}
