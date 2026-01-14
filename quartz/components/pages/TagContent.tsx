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
  const pagesWithTag = allFiles.filter((file) =>
    (file.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes).includes(tag),
  )

  // Optional custom description/content for this tag page (from tags/tagname.md if it exists)
  const tagPageDescription =
    (tree as Root).children.length === 0
      ? fileData.description
      : htmlToJsx(fileData.filePath || ("" as FilePath), tree)

  const cssClasses: string[] = fileData.frontmatter?.cssclasses ?? []
  const articleClasses = ["previewable", ...cssClasses].join(" ")

  const pageListProps = {
    ...props,
    allFiles: pagesWithTag,
  }

  return (
    <article className={articleClasses} data-use-dropcap="false">
      {tagPageDescription && <div>{tagPageDescription as React.ReactNode}</div>}
      <div className="page-listing">
        <p>{uiStrings.pages.tagContent.itemsUnderTag(pagesWithTag.length)}</p>
        <div>
          <PageList {...pageListProps} />
        </div>
      </div>
    </article>
  )
}

TagContent.css = style
export default (() => TagContent) satisfies QuartzComponentConstructor
