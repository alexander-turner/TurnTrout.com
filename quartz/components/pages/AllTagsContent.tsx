import type { Element } from "hast"

import { h } from "hastscript"
import { JSX } from "preact"
// skipcq: JS-C1003 (react is used for the table component)
import * as React from "react"

import type { QuartzComponent, QuartzComponentProps } from "../types"

import { htmlToJsx } from "../../util/jsx"
import { type FilePath, type FullSlug } from "../../util/path"
import { locale, PREVIEWABLE_CLASS } from "../constants"
import style from "../styles/listPage.scss"
import { formatTag } from "../TagList"

export const allTagsSlug = "all-tags" as FullSlug
export const allTagsTitle = "All Tags"
export const allTagsDescription = "All tags used in this site"
export const allTagsListing = "all-tags-listing"

/**
 * Generates a HAST element listing all tags extracted from the provided files.
 * @param props Quartz component properties including allFiles and cfg.
 * @returns A HAST Element representing the tags listing.
 */
export function generateAllTagsHast(props: QuartzComponentProps): Element {
  const { allFiles } = props

  // Get all unique tags and their counts
  const tagMap = new Map<string, number>()
  allFiles.forEach((file) => {
    const tags = file.frontmatter?.tags ?? []
    tags.forEach((tag) => {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1)
    })
  })

  // Convert to array and sort alphabetically
  const sortedTags = Array.from(tagMap.entries()).sort((a, b) => a[0].localeCompare(b[0], locale))

  // Create tag elements using hastscript
  const tagElements = sortedTags.map(([tag, count]) =>
    h("div.tag-container", [
      h("a.internal.tag-link.can-trigger-popover", { href: `../tags/${tag}` }, formatTag(tag)),
      h("span.tag-count", `(${count})`),
    ]),
  )

  return h(
    "span",
    {
      id: allTagsListing,
      "data-url": allTagsListing,
      "data-block": allTagsListing,
    },
    [h("div.all-tags", tagElements)],
  )
}

// Component for direct rendering (uses JSX)
const AllTagsContent: QuartzComponent = (props: QuartzComponentProps) => {
  const { fileData } = props
  const cssClasses: string[] = fileData.frontmatter?.cssclasses ?? []
  const classes = [PREVIEWABLE_CLASS, ...cssClasses].join(" ")

  // Convert HAST to JSX for component rendering
  const tagsListing = generateAllTagsBlock(props)

  return (
    <div className={classes}>
      <article data-use-dropcap="false">{tagsListing}</article>
    </div>
  )
}

// Generate JSX block (used by the component)
function generateAllTagsBlock(props: QuartzComponentProps): JSX.Element | undefined {
  const hast = generateAllTagsHast(props)
  return htmlToJsx(props.fileData.filePath || ("" as FilePath), hast)
}

AllTagsContent.css = style
export default AllTagsContent
