// skipcq: JS-W1028
import React from "react"

import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

import { formatTitle } from "./component_utils"
import { formatTag } from "./TagList"

// skipcq: JS-D1001
const ArticleTitle: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  if (fileData.frontmatter?.hide_title) {
    return null
  }

  const title = fileData.frontmatter?.title ? formatTitle(fileData.frontmatter.title) : undefined
  // skipcq: JS-0424
  let tagContent = <>{title}</>

  // Tags are styled like inline code
  if (title?.match("Tag: ")) {
    const tagText = title.split("Tag: ")[1]
    tagContent = (
      <>
        Tag: <span className="tag-text">{formatTag(tagText)}</span>
      </>
    )
  }

  return <h1 id="article-title">{tagContent}</h1>
}

export default (() => ArticleTitle) satisfies QuartzComponentConstructor
