import type { JSX } from "preact"

import { type Element, type Parent, type RootContent } from "hast"
import { fromHtml } from "hast-util-from-html"
// skipcq: JS-W1028
import React from "react"

import { type QuartzPluginData } from "../plugins/vfile"
import { type FullSlug, resolveRelative, type SimpleSlug, simplifySlug } from "../util/path"
import { applyInlineFormattingTransforms, formatTitle } from "./component_utils"
import { type QuartzComponent, type QuartzComponentProps } from "./types"

function processBacklinkTitle(title: string): Parent {
  const formattedTitle = formatTitle(title)
  // Titles may contain inline HTML (e.g. <abbr>), so parse before transforming.
  const htmlAst = fromHtml(formattedTitle, { fragment: true })
  applyInlineFormattingTransforms(htmlAst)
  return htmlAst as unknown as Parent
}

/** Joins a hast `className` (an array, or absent) into a class string. */
function classNameString(properties: Element["properties"]): string {
  const className = properties?.className
  return Array.isArray(className) ? className.map(String).join(" ") : ""
}

function elementToJsx(elt: RootContent): JSX.Element {
  switch (elt.type) {
    case "text":
      // skipcq: JS-0424 want to cast as JSX element
      return <>{elt.value}</>
    case "element":
      if (elt.tagName === "abbr") {
        const firstChild = elt.children[0]
        const abbrText = firstChild?.type === "text" ? firstChild.value : ""
        return <abbr className={classNameString(elt.properties)}>{abbrText}</abbr>
      }
      if (elt.tagName === "img") {
        return (
          <img
            className={classNameString(elt.properties) || undefined}
            src={elt.properties?.src as string}
            alt={elt.properties?.alt as string}
            draggable={elt.properties?.draggable === "false" ? false : undefined}
          />
        )
      }
      return (
        <span className={classNameString(elt.properties) || undefined}>
          {elt.children.map(elementToJsx)}
        </span>
      )
    default:
      // skipcq: JS-0424 want to cast as JSX element
      return <></>
  }
}

/**
 * @param backlinkFiles - The list of files that link to the current file
 * @param currentSlug - The slug of the current file
 * @returns A list of links to the current file
 */
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

/**
 * @param allFiles - The list of all files in the site
 * @param currentFile - The file that we are getting backlinks for
 * @returns A list of quartz plugin data for the files that link to the current file
 */
export const getBacklinkFileData = (
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

/** Collapsible "Links to this page" block listing pages whose links resolve to this slug. */
export const Backlinks: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  const backlinkFiles: QuartzPluginData[] = getBacklinkFileData(allFiles, fileData)
  if (backlinkFiles.length === 0) return null

  return (
    <blockquote
      className="admonition link admonition-metadata is-collapsible is-collapsed"
      id="backlinks"
      data-admonition="link"
      data-admonition-fold=""
    >
      <div className="admonition-title">
        <span className="admonition-title-inner">
          <span className="admonition-icon" />
          Links to this page
        </span>
        <div className="fold-admonition-icon" />
      </div>
      <div className="admonition-content" id="backlinks-admonition">
        <BacklinksList backlinkFiles={backlinkFiles} currentSlug={fileData.slug as FullSlug} />
      </div>
    </blockquote>
  )
}

export { elementToJsx }
