/* eslint-disable react/no-unknown-property */
// (For the spa-preserve attribute)

import { pathToRoot } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"
import React from "react"
const altText = "A goose and a trout play in a pond in front of a castle."
export const headerVideoContainer = (
  <span id="header-video-container">
    <img
      src="https://assets.turntrout.com/static/pond.gif"
      id="header-gif"
      className="header-img no-select no-vsc"
      alt={altText}
      spa-preserve
    />
  </span>
)

const PageTitle: QuartzComponent = ({ fileData, cfg, displayClass }: QuartzComponentProps) => {
  const title = cfg?.pageTitle ?? i18n(cfg.locale).propertyDefaults.title
  const baseDir = pathToRoot(fileData.slug!)

  return (
    <div className={classNames(displayClass, "page-title")}>
      <a href={baseDir}>{headerVideoContainer}</a>
      <h2 className="page-title-text">
        <a href={baseDir} id="page-title-text">
          {title}
        </a>
      </h2>
    </div>
  )
}

PageTitle.css = `
.page-title {
  margin: 0;
}
`

export default (() => PageTitle) satisfies QuartzComponentConstructor
