// skipcq: JS-W1028
import React from "react"

// @ts-expect-error Not a module but a script
// skipcq: JS-W1028
import clipboardScript from "./scripts/clipboard.inline"
// @ts-expect-error Not a module but a script
// skipcq: JS-W1028
import elvishToggleScript from "./scripts/elvish-toggle.inline"
// @ts-expect-error Not a module but a script
// skipcq: JS-W1028
import smallCapsCopyScript from "./scripts/smallcaps-copy.inline"
import clipboardStyle from "./styles/clipboard.scss"
import {
  type QuartzComponent,
  type QuartzComponentConstructor,
  type QuartzComponentProps,
} from "./types"

const searchInterface = (
  <div className="search" role="region" aria-label="Displays search results.">
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
        <div id="search-layout" data-preview />
      </div>
    </div>
  </div>
)

const Body: QuartzComponent = ({ children }: QuartzComponentProps) => {
  // The quartz-body children are the three main sections of the page: left, center, and right bars
  return (
    <>
      {searchInterface}
      <div id="quartz-body">{children}</div>
    </>
  )
}

// Each script must be wrapped in its own IIFE to prevent minified variable name
// collisions when they share a scope (componentResources wraps the whole string in one IIFE)
Body.afterDOMLoaded = [clipboardScript, elvishToggleScript, smallCapsCopyScript]
  .map((s) => `(function(){${s}})();`)
  .join("\n")
Body.css = clipboardStyle

export default (() => Body) satisfies QuartzComponentConstructor
