import { QuartzComponent, QuartzComponentProps } from "../types"
import style from "../styles/listPage.scss"
import { formatTag } from "../TagList"
import { getAllSegmentPrefixes, FullSlug } from "../../util/path"
import React from "react"
import { h } from "hastscript"
import { Element } from "hast"
import { htmlToJsx } from "../../util/jsx"

export const allTagsSlug = "all-tags" as FullSlug
export const allTagsTitle = "All Tags"
export const allTagsDescription = "All tags used in this site"
export const allTagsListing: string = "all-tags-listing"

export function generateAllTagsHast(props: QuartzComponentProps): Element {
  const { allFiles, cfg } = props

  // Get all unique tags and their counts
  const tagMap = new Map<string, number>()
  allFiles.forEach((file) => {
    const tags = (file.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes)
    tags.forEach((tag) => {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1)
    })
  })

  // Convert to array and sort alphabetically
  const sortedTags = Array.from(tagMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], cfg.locale),
  )

  // Create tag elements using hastscript
  const tagElements = sortedTags.map(([tag, count]) =>
    h("div.tag-container", [
      h("a.internal.tag-link", { href: `../tags/${tag}` }, formatTag(tag)),
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
  const classes = ["popover-hint", ...cssClasses].join(" ")

  // Convert HAST to JSX for component rendering
  const tagsListing = generateAllTagsBlock(props)

  return (
    <div className={classes}>
      <article>{tagsListing}</article>
    </div>
  )
}

// Helper function to generate JSX block (used by the component)
function generateAllTagsBlock(props: QuartzComponentProps): JSX.Element | undefined {
  const hast = generateAllTagsHast(props)
  return htmlToJsx(props.fileData.filePath!, hast)
}

AllTagsContent.css = style
export default AllTagsContent