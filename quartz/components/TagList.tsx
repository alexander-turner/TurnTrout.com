// skipcq: JS-W1028
import React from "react"

import { type QuartzPluginData } from "../plugins/vfile"
import { slugTag } from "../util/path"
import {
  type QuartzComponent,
  type QuartzComponentConstructor,
  type QuartzComponentProps,
} from "./types"

// For rendering the tags for a user
export const formatTag = (tag: string): string => {
  if (!tag) {
    return ""
  }
  if (tag.toLowerCase() === "ai") return "AI"

  // Ensure input is a string (using optional chaining for safety)
  tag = tag.replace(/-/g, " ").toLowerCase()
  tag = tag.replaceAll("power seeking", "power-seeking")

  return tag
}

/**
 * Gets the tags from the file data and formats them.
 */
export const getTags = (fileData: QuartzPluginData): string[] => {
  if (!fileData.frontmatter) {
    return []
  }
  let tags = fileData.frontmatter.tags ?? []
  tags = tags.map(formatTag)
  return tags.sort((a: string, b: string) => b.length - a.length)
}

// skipcq: JS-D1001
const TagListComponent: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const tags = getTags(fileData)
  if (tags && tags.length > 0) {
    return (
      <ul>
        {tags.map((tag: string) => {
          const tagSlug = slugTag(tag)
          const linkDest = `/tags/${tagSlug}`
          return (
            <li key={tag}>
              <a href={linkDest} className="can-trigger-popover tag-link">
                {tag}
              </a>
            </li>
          )
        })}
      </ul>
    )
  } else {
    return null
  }
}

// skipcq: JS-D1001
export const TagList: QuartzComponentConstructor = () => TagListComponent
export default TagList satisfies QuartzComponentConstructor
