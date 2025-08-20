import type { Root } from "hast"

import React from "react"

import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

import { htmlToJsx } from "../../util/jsx"
import { type FilePath, type FullSlug, getAllSegmentPrefixes, simplifySlug } from "../../util/path"
import { uiStrings } from "../constants"
import { PageList } from "../PageList"
import style from "../styles/listPage.scss"

const TagContent: QuartzComponent = (props: QuartzComponentProps) => {
  const { tree, fileData, allFiles } = props
  const slug = fileData.slug

  if (!(slug?.startsWith("tags/") || slug === "tags")) {
    throw new Error(`Component "TagContent" tried to render a non-tag page: ${slug}`)
  }

  const tag = simplifySlug(slug.slice("tags/".length) as FullSlug)
  const allPagesWithTag = (tag: string) =>
    allFiles.filter((file) =>
      (file.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes).includes(tag),
    )

  const content =
    (tree as Root).children.length === 0
      ? fileData.description
      : htmlToJsx(fileData.filePath || ("" as FilePath), tree)
  const cssClasses: string[] = fileData.frontmatter?.cssclasses ?? []
  const classes = ["popover-hint", ...cssClasses].join(" ")

  const pages = allPagesWithTag(tag)
  const listProps = {
    ...props,
    allFiles: pages,
  }

  return (
    <div className={classes}>
      <article>{content as React.ReactNode}</article>
      <div className="page-listing">
        <p>{uiStrings.pages.tagContent.itemsUnderTag(pages.length)}</p>
        <div>
          <PageList {...listProps} />
        </div>
      </div>
    </div>
  )
}

TagContent.css = style + PageList.css
export default (() => TagContent) satisfies QuartzComponentConstructor
