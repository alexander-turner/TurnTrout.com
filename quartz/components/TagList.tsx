import { slugTag } from "../util/path"
import React from "react"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { QuartzPluginData } from "../plugins/vfile"

// For rendering the tags for a user
export const formatTag = (tag: string): string => {
  if (tag.toLowerCase() === "ai") return "AI"

  // Ensure input is a string (using optional chaining for safety)
  tag = tag?.replace(/-/g, " ").toLowerCase() ?? ""
  tag = tag?.replaceAll("power seeking", "power-seeking")

  return tag
}

export const getTags = (fileData: QuartzPluginData) => {
  let tags = fileData.frontmatter?.tags || []
  tags = tags.map(formatTag)
  return tags.sort((a: string, b: string) => b.length - a.length)
}

export const TagList: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const tags = getTags(fileData)
  if (tags && tags.length > 0) {
    return (
      <ul className={classNames(displayClass, "tags")}>
        {tags.map((tag: string) => {
          const tagSlug = slugTag(tag)
          const linkDest = `/tags/${tagSlug}`
          return (
            <li key={tag}>
              <a href={linkDest} className="internal tag-link">
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

export default (() => TagList) satisfies QuartzComponentConstructor
