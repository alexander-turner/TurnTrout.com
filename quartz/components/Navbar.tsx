// (For the spa-preserve attribute)

// skipcq: JS-W1028
import React from "react"

import { type FullSlug, pathToRoot, resolveRelative } from "../util/path"
import { pondVideoId } from "./component_utils"
import { defaultTitle } from "./constants"
// @ts-expect-error Not a module but a script
// skipcq: JS-W1028
import script from "./scripts/navbar.inline"
import navbarStyle from "./styles/navbar.scss"
import {
  type QuartzComponent,
  type QuartzComponentConstructor,
  type QuartzComponentProps,
} from "./types"

const lightSvg = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    version="1.1"
    id="day-icon"
    x="0px"
    y="0px"
    viewBox="0 0 35 35"
    xmlSpace="preserve"
  >
    <path d="M6,17.5C6,16.672,5.328,16,4.5,16h-3C0.672,16,0,16.672,0,17.5    S0.672,19,1.5,19h3C5.328,19,6,18.328,6,17.5z M7.5,26c-0.414,0-0.789,0.168-1.061,0.439l-2,2C4.168,28.711,4,29.086,4,29.5    C4,30.328,4.671,31,5.5,31c0.414,0,0.789-0.168,1.06-0.44l2-2C8.832,28.289,9,27.914,9,27.5C9,26.672,8.329,26,7.5,26z M17.5,6    C18.329,6,19,5.328,19,4.5v-3C19,0.672,18.329,0,17.5,0S16,0.672,16,1.5v3C16,5.328,16.671,6,17.5,6z M27.5,9    c0.414,0,0.789-0.168,1.06-0.439l2-2C30.832,6.289,31,5.914,31,5.5C31,4.672,30.329,4,29.5,4c-0.414,0-0.789,0.168-1.061,0.44    l-2,2C26.168,6.711,26,7.086,26,7.5C26,8.328,26.671,9,27.5,9z M6.439,8.561C6.711,8.832,7.086,9,7.5,9C8.328,9,9,8.328,9,7.5    c0-0.414-0.168-0.789-0.439-1.061l-2-2C6.289,4.168,5.914,4,5.5,4C4.672,4,4,4.672,4,5.5c0,0.414,0.168,0.789,0.439,1.06    L6.439,8.561z M33.5,16h-3c-0.828,0-1.5,0.672-1.5,1.5s0.672,1.5,1.5,1.5h3c0.828,0,1.5-0.672,1.5-1.5S34.328,16,33.5,16z     M28.561,26.439C28.289,26.168,27.914,26,27.5,26c-0.828,0-1.5,0.672-1.5,1.5c0,0.414,0.168,0.789,0.439,1.06l2,2    C28.711,30.832,29.086,31,29.5,31c0.828,0,1.5-0.672,1.5-1.5c0-0.414-0.168-0.789-0.439-1.061L28.561,26.439z M17.5,29    c-0.829,0-1.5,0.672-1.5,1.5v3c0,0.828,0.671,1.5,1.5,1.5s1.5-0.672,1.5-1.5v-3C19,29.672,18.329,29,17.5,29z M17.5,7    C11.71,7,7,11.71,7,17.5S11.71,28,17.5,28S28,23.29,28,17.5S23.29,7,17.5,7z M17.5,25c-4.136,0-7.5-3.364-7.5-7.5    c0-4.136,3.364-7.5,7.5-7.5c4.136,0,7.5,3.364,7.5,7.5C25,21.636,21.636,25,17.5,25z" />
  </svg>
)

const darkSvg = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    version="1.1"
    id="night-icon"
    x="0px"
    y="0px"
    viewBox="0 0 100 100"
    xmlSpace="preserve"
  >
    <path d="M96.76,66.458c-0.853-0.852-2.15-1.064-3.23-0.534c-6.063,2.991-12.858,4.571-19.655,4.571  C62.022,70.495,50.88,65.88,42.5,57.5C29.043,44.043,25.658,23.536,34.076,6.47c0.532-1.08,0.318-2.379-0.534-3.23  c-0.851-0.852-2.15-1.064-3.23-0.534c-4.918,2.427-9.375,5.619-13.246,9.491c-9.447,9.447-14.65,22.008-14.65,35.369  c0,13.36,5.203,25.921,14.65,35.368s22.008,14.65,35.368,14.65c13.361,0,25.921-5.203,35.369-14.65  c3.872-3.871,7.064-8.328,9.491-13.246C97.826,68.608,97.611,67.309,96.76,66.458z" />
  </svg>
)

const playIcon = (
  <svg
    id="play-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ display: "none" }}
  >
    <path d="M8 5v14l11-7z" />
  </svg>
)

const pauseIcon = (
  <svg
    id="pause-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ display: "block" }}
  >
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
)

const videoToggle = (
  <span id="video-toggle-span" className="no-select">
    <button id="video-toggle" type="button" aria-label="Disable video autoplay">
      {playIcon}
      {pauseIcon}
    </button>
  </span>
)

const darkMode = (
  <span id="darkmode-span" className="no-select">
    <button id="theme-toggle" type="button" aria-label="Toggle theme">
      {lightSvg}
      {darkSvg}
    </button>
    <p id="theme-label" />
  </span>
)

const searchHTML = (
  <div className="search" id="nav-searchbar">
    <div className="no-select" id="search-icon">
      <svg
        tabIndex={0}
        aria-labelledby="title desc"
        role="img"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 19.9 19.7"
      >
        <title id="title">Search</title>
        <desc id="desc">Search</desc>
        <g className="search-path" fill="none">
          <path strokeLinecap="square" d="M18.5 18.3l-5.4-5.4" />
          <circle cx="8" cy="8" r="7" />
        </g>
      </svg>
      <p>Search</p>
    </div>
  </div>
)

type Page = {
  slug: string
  title: string
}

/**
 * Renders the navigation bar based on provided configuration and file data.
 *
 * @param props - The properties for the navbar component.
 * @param props.cfg - The component configuration object containing navbar settings.
 * @param props.fileData - The file metadata including slug information.
 * @returns The rendered navigation bar component.
 */
const NavbarComponent: QuartzComponent = ({ cfg, fileData }: QuartzComponentProps) => {
  const pages: Page[] = "pages" in cfg.navbar ? (cfg.navbar.pages as Page[]) : []
  const currentSlug = fileData.slug || ("" as FullSlug)

  const links = pages.map((page: Page) => (
    <li key={page.slug}>
      <a href={resolveRelative(currentSlug, page.slug as FullSlug)} className="internal">
        {page.title}
      </a>
    </li>
  ))

  const headerVideoSpan = (
    <span id="header-video-container" className="video-container" data-persist-video="true">
      <video
        id={pondVideoId}
        className="no-select no-vsc"
        loop
        muted
        playsInline
        data-persist
        preload="auto"
        poster="https://assets.turntrout.com/static/pond_frame.avif"
        aria-label="A goose and a trout play in a pond in front of a castle."
      >
        <source src="https://assets.turntrout.com/static/pond.mov" type="video/mp4; codecs=hvc1" />
        <source src="https://assets.turntrout.com/static/pond.webm" type="video/webm" />
      </video>
    </span>
  )
  const title = cfg?.pageTitle ?? defaultTitle
  const baseDir = pathToRoot(fileData.slug || ("" as FullSlug))

  const pageLinks = (
    <nav className="menu">
      <ul>
        {links}
        <li>
          <a
            href="https://turntrout.substack.com/subscribe"
            className="external"
            target="_blank"
            rel="noopener noreferrer"
          >
            Subscribe
          </a>
        </li>
      </ul>
    </nav>
  )
  return (
    <div id="navbar" className="navbar">
      <div id="navbar-left">
        {headerVideoSpan}
        <h2>
          <a href={baseDir} className="internal">
            {title}
          </a>
        </h2>
        {videoToggle}
        {darkMode}
      </div>
      <div id="navbar-right">
        {searchHTML}
        <button
          id="menu-button"
          type="button"
          className="mobile-only"
          aria-label="Opens menu for key site links."
        >
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </button>
        {pageLinks}
      </div>
    </div>
  )
}

const Navbar = (() => {
  NavbarComponent.css = navbarStyle
  NavbarComponent.afterDOMLoaded = script
  return NavbarComponent
}) satisfies QuartzComponentConstructor

export default Navbar
