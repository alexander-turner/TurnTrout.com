import React from "react"

import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

import { type GlobalConfiguration } from "../cfg"
import { RenderPublicationInfo } from "./ContentMeta"

// skipcq: JS-D1001
export function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return "Alex Turner"
  if (authors.length === 1) return authors[0]
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`
  return `${authors.slice(0, -1).join(", ")}, and ${authors.at(-1)}`
}

const Authors: QuartzComponent = ({ fileData, cfg }: QuartzComponentProps) => {
  if (fileData.frontmatter?.hide_metadata || fileData.frontmatter?.hide_authors) {
    return null
  }

  const authorList = fileData.frontmatter?.authors ?? ["Alex Turner"]
  const authorsText = `By ${formatAuthors(authorList)}`

  // Add the publication info
  const publicationInfo = RenderPublicationInfo(cfg as GlobalConfiguration, fileData)
  /* istanbul ignore next */
  const publicationInfoElement = publicationInfo ? <p>{publicationInfo}</p> : null

  return (
    <div className="authors">
      <p>{authorsText}</p>
      {publicationInfoElement}
    </div>
  )
}

export default (() => Authors) satisfies QuartzComponentConstructor
