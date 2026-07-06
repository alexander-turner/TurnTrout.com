// skipcq: JS-W1028
import React from "react"

import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

import { formatTitle, renderTitleJsx } from "./component_utils"
import { formatTag } from "./TagList"

/** Renders the page `<h1>` from frontmatter `title`, with tag-page styling when applicable. */
const ArticleTitle: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  if (fileData.frontmatter?.hide_title) {
    return null
  }

  const title = fileData.frontmatter?.title ? formatTitle(fileData.frontmatter.title) : undefined
  // Tags are styled like inline code; other titles render Twemoji and inline
  // markup through the shared title pipeline.
  // skipcq: JS-0424
  let tagContent = <>{title ? renderTitleJsx(title) : title}</>

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
