import { pathToRoot, slugTag } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

export const formatTag = (tag: string): string => {
  // Ensure input is a string (using optional chaining for safety)
  tag = tag?.replace(/-/g, " ").toLowerCase() ?? ""

  // Capitalize the first letter, but only if there are characters
  tag = tag.length > 0 ? tag.charAt(0).toUpperCase() + tag.slice(1) : ""

  // Handle special case for "ai" (case-insensitive)
  if (tag.toLowerCase() === "ai") {
    return "AI"
  }

  return tag
}

export const getTags = (fileData: any) => {
  let tags = fileData.frontmatter?.tags || []
  tags = tags.map(formatTag)
  return tags.sort((a: string, b: string) => b.length - a.length)
}

const TagList: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  // Sort by string lenth, descending
  let tags = getTags(fileData)
  const baseDir = pathToRoot(fileData.slug!)
  if (tags && tags.length > 0) {
    return (
      <>
        <div>
          <ul class={classNames(displayClass, "tags")}>
            {tags.map((tag: any) => {
              const linkDest = baseDir + `/tags/${slugTag(tag)}`
              return (
                <a href={linkDest} class="internal tag-link">
                  {tag}
                </a>
              )
            })}
          </ul>
        </div>
      </>
    )
  } else {
    return null
  }
}

export default (() => TagList) satisfies QuartzComponentConstructor
