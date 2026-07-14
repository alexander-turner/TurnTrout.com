// skipcq: JS-W1028
import React from "react"

// @ts-expect-error Not a module but a script
// skipcq: JS-W1028
import accurateInvertScript from "./scripts/accurateInvert.inline"
// @ts-expect-error Not a module but a script
// skipcq: JS-W1028
import clipboardScript from "./scripts/clipboard.inline"
// @ts-expect-error Not a module but a script
// skipcq: JS-W1028
import elvishToggleScript from "./scripts/elvish-toggle.inline"
// @ts-expect-error Not a module but a script
// skipcq: JS-W1028
import punctilioDemoScript from "./scripts/punctilio-demo.inline"
// @ts-expect-error Not a module but a script
// skipcq: JS-W1028
import scrollIndicatorScript from "./scripts/scroll-indicator.inline"
// @ts-expect-error Not a module but a script
// skipcq: JS-W1028
import smallCapsCopyScript from "./scripts/smallcaps-copy.inline"
// @ts-expect-error Not a module but a script
// skipcq: JS-W1028
import spoilerScript from "./scripts/spoiler.inline"
// @ts-expect-error Not a module but a script
// skipcq: JS-W1028
import tweetMediaFadeScript from "./scripts/tweet-media-fade.inline"
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
          role="combobox"
          aria-label="Search"
          aria-expanded="false"
          aria-autocomplete="list"
          aria-controls="results-container"
          placeholder="Search"
        />
        <div id="search-layout" data-preview />
      </div>
    </div>
  </div>
)

// SVG filter that inverts lightness while keeping hues closer to the
// original than CSS `invert() hue-rotate(180deg)` — the CSS form
// approximates hue rotation as an RGB-space matrix, which mangles
// yellows and cyans. feComponentTransfer flips each channel, then the
// matrix rotates 180° around the neutral-gray axis to recover hue.
// Still an sRGB-space approximation (not perceptual HSL).
// Mobile Firefox skips layout for `<svg width="0" height="0">` and drops
// referenced `<filter>`s along with it, so `filter: url(#accurate-invert)`
// renders as blank on `<img>` elements at iPhone-sized viewports. Give the
// SVG a 1×1 box and hide it via `overflow: hidden` + offscreen positioning
// so the filter stays referenceable everywhere.
const accurateInvertFilter = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1"
    height="1"
    style={{
      position: "absolute",
      left: "-9999px",
      width: "1px",
      height: "1px",
      overflow: "hidden",
    }}
    aria-hidden="true"
    focusable="false"
  >
    <filter id="accurate-invert" colorInterpolationFilters="sRGB">
      <feComponentTransfer>
        <feFuncR type="table" tableValues="1 0" />
        <feFuncG type="table" tableValues="1 0" />
        <feFuncB type="table" tableValues="1 0" />
      </feComponentTransfer>
      <feColorMatrix
        type="matrix"
        values="-0.333  0.667  0.667  0  0
                 0.667 -0.333  0.667  0  0
                 0.667  0.667 -0.333  0  0
                 0      0      0      1  0"
      />
    </filter>
  </svg>
)

const PageShell: QuartzComponent = ({ children }: QuartzComponentProps) => {
  // The page-columns children are the three main sections of the page: left, center, and right bars
  return (
    <>
      {accurateInvertFilter}
      {searchInterface}
      <div id="page-columns">{children}</div>
    </>
  )
}

PageShell.afterDOMLoaded = [
  clipboardScript,
  elvishToggleScript,
  smallCapsCopyScript,
  scrollIndicatorScript,
  punctilioDemoScript,
  spoilerScript,
  tweetMediaFadeScript,
]
// Runs synchronously in `<head>` before any `<img>` is parsed — required so
// the capture-phase `load` listener catches every img load before first paint.
PageShell.beforeDOMLoaded = accurateInvertScript
PageShell.css = clipboardStyle

export default (() => PageShell) satisfies QuartzComponentConstructor
