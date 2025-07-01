import { JSX } from "preact"
import * as React from "react"

import type { QuartzComponent, QuartzComponentProps } from "../types"

import { type FullSlug } from "../../util/path"
import { PageList } from "../PageList"
import style from "../styles/listPage.scss"

export const allSlug = "all-posts" as FullSlug
export const allTitle = "All Posts"
export const allDescription = "A listing of all posts on turntrout.com."
export const allPostsListing = "all-posts-listing"

export function generateAllPostsBlock(props: QuartzComponentProps): JSX.Element {
  const pageListing = (
    <span id={allPostsListing} data-url={allPostsListing} data-block={allPostsListing}>
      <PageList {...props} />
    </span>
  )
  return pageListing
}

export const AllPosts: QuartzComponent = (props: QuartzComponentProps) => {
  const { fileData, allFiles } = props
  const cssClasses: string[] = fileData.frontmatter?.cssclasses ?? []
  const classes = ["popover-hint", ...cssClasses].join(" ")
  const pageListing = generateAllPostsBlock(props)

  return (
    <div className={classes}>
      <article>
        <p>This site has {allFiles.length} blog posts.</p>
        {pageListing}
      </article>
    </div>
  )
}

AllPosts.css = style
export default AllPosts
