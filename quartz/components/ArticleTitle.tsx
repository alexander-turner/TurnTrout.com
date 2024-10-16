import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { formatTag } from "./TagList"
import { formatTitle } from "./component_utils"
import React from "react"

const ArticleTitle: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  if (fileData.frontmatter?.hide_title) {
    return null
  }
  if (fileData.frontmatter?.title) {
    fileData.frontmatter.title = formatTitle(fileData.frontmatter.title)
  }
  const title = fileData.frontmatter?.title
  let titleContent = null

  if (title) {
    titleContent = <h1 className={classNames(displayClass, "article-title")}>{title}</h1>
    if (title.match("Tag: ")) {
      const tagText = formatTag(title.split("Tag: ")[1])
      titleContent = (
        <h1 className={classNames(displayClass, "article-title")}>
          Tag: <span style="font-family:var(--font-monospace); font-size: smaller">{tagText}</span>
        </h1>
      )
    }
  }

  return titleContent
}

ArticleTitle.css = `
.article-title {
  margin: -2rem 0 0 0;
}
`

export default (() => ArticleTitle) satisfies QuartzComponentConstructor
