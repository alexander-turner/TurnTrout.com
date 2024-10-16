// @ts-expect-error Not a module but a script
import clipboardScript from "./scripts/clipboard.inline"
import clipboardStyle from "./styles/clipboard.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import React from "react"

const Body: QuartzComponent = ({ children }: QuartzComponentProps) => {
  // The children are the three main sections of the page: left, center, and right bars
  return (
    <>
      {searchInterface}
      <div id="quartz-body">{children}</div>
    </>
  )
}

const searchInterface = (
  <div className="search" alt="Displays search results.">
    <div id="search-container">
      <div id="search-space">
        <input
          autoComplete="off"
          id="search-bar"
          name="search"
          type="text"
          aria-label="Search"
          placeholder="Search"
        />
        <div id="search-layout" data-preview={true}></div>
      </div>
    </div>
  </div>
)

Body.afterDOMLoaded = clipboardScript
Body.css = clipboardStyle

export default (() => Body) satisfies QuartzComponentConstructor
