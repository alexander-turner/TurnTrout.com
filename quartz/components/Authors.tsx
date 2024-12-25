import React from "react"

import { GlobalConfiguration } from "../cfg"
import { RenderPublicationInfo } from "./ContentMeta"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const Authors: QuartzComponent = ({ fileData, cfg }: QuartzComponentProps) => {
  if (fileData.frontmatter?.hide_metadata || fileData.frontmatter?.hide_authors) {
    return null
  }

  let authors = "Alex Turner"
  if (fileData.frontmatter?.authors) {
    authors = fileData.frontmatter.authors as string
  }
  authors = `By ${authors}`

  // Add the publication info
  const publicationInfo = RenderPublicationInfo(cfg as GlobalConfiguration, fileData)

  return (
    <div className="authors">
      <p style={{ textIndent: "-.2rem", paddingLeft: ".2rem", lineHeight: "1.25rem" }}>{authors}</p>
      {publicationInfo && <p>{publicationInfo}</p>}
    </div>
  )
}

export default (() => Authors) satisfies QuartzComponentConstructor
