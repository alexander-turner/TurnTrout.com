import type { JSX } from "preact"

// skipcq: JS-W1028
import React from "react"
import readingTime from "reading-time"

import { type GlobalConfiguration } from "../cfg"
import { type QuartzPluginData } from "../plugins/vfile"
import { Backlinks } from "./Backlinks"
import { formatTitle } from "./component_utils"
import { DateElement } from "./Date"
import style from "./styles/contentMeta.scss"
import { TagList } from "./TagList"
import { type QuartzComponentConstructor, type QuartzComponentProps } from "./types"

const TagListComponent = TagList(undefined)

// Render publication information including original URL and date
export function RenderPublicationInfo(
  cfg: GlobalConfiguration,
  fileData: QuartzPluginData,
): JSX.Element | null {
  const frontmatter = fileData.frontmatter
  const datePublished = frontmatter?.date_published as Date
  if (!datePublished || frontmatter?.hide_metadata) {
    return null
  }

  const dateElement = (
    <DateElement
      cfg={cfg}
      date={datePublished}
      monthFormat="long"
      includeOrdinalSuffix
      formatOrdinalSuffix
    />
  )

  // If there's an original URL, show "Originally published on" with favicon
  const originalUrl = frontmatter?.original_url
  if (typeof originalUrl === "string") {
    const url = new URL(originalUrl)

    return (
      <span className="publication-str">
        <a href={url.toString()} className="external" target="_blank" rel="noopener noreferrer">
          Published
        </a>
        {" on "}
        {dateElement}
      </span>
    )
  }

  return <span className="publication-str">Published on {dateElement}</span>
}

// Add new function to render last updated info
export function renderLastUpdated(
  cfg: GlobalConfiguration,
  fileData: QuartzPluginData,
): JSX.Element | null {
  const frontmatter = fileData.frontmatter
  if (!frontmatter?.date_updated || frontmatter?.hide_metadata) {
    return null
  }
  const dateUpdated = new Date(frontmatter.date_updated as string)

  const githubStem = "https://github.com/alexander-turner/TurnTrout.com/blob/main/website_content/"
  const githubUrl = `${githubStem}${fileData.relativePath}`
  const githubLink = (
    <a href={githubUrl} className="external" target="_blank" rel="noopener noreferrer">
      Updated
    </a>
  )
  const date = (
    <DateElement
      cfg={cfg}
      date={dateUpdated}
      monthFormat="long"
      includeOrdinalSuffix
      formatOrdinalSuffix
    />
  )
  return (
    <span className="last-updated-str">
      {githubLink} on {date}
    </span>
  )
}

/**
 * Formats reading time into a human-readable string.
 *
 * @param minutes - The total number of minutes to format.
 * @returns A formatted string representing hours and/or minutes.
 *
 * Examples:
 * - 30 minutes -> "30 minutes"
 * - 60 minutes -> "1 hour"
 * - 90 minutes -> "1 hour 30 minutes"
 * - 120 minutes -> "2 hours"
 * - 150 minutes -> "2 hours 30 minutes"
 */
export function processReadingTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = Math.ceil(minutes % 60)

  let timeString = ""

  if (hours > 0) {
    timeString += `${hours} hour${hours > 1 ? "s" : ""}` // Pluralize 'hour' if > 1
    if (remainingMinutes > 0) {
      timeString += " " // Add separator if we also have minutes
    }
  }

  if (remainingMinutes > 0) {
    timeString += `${remainingMinutes} minute${remainingMinutes > 1 ? "s" : ""}` // Pluralize 'minute' if > 1
  }

  return timeString
}

/**
 * Renders the reading time for a post.
 *
 * @param fileData - The data for the file.
 * @returns The reading time as a JSX element.
 */
export const renderReadingTime = (fileData: QuartzPluginData): JSX.Element => {
  if (fileData.frontmatter?.hide_reading_time) {
    // skipcq: JS-0424
    return <></>
  }

  const text = fileData.text as string
  const { minutes } = readingTime(text)
  const displayedTime = processReadingTime(Math.ceil(minutes))

  return <span className="reading-time">Read time: {displayedTime}</span>
}

// Modify renderLinkpostInfo function
export const renderLinkpostInfo = (fileData: QuartzPluginData): JSX.Element | null => {
  const linkpostUrl = fileData.frontmatter?.["lw-linkpost-url"]
  if (typeof linkpostUrl !== "string") return null

  let displayText = linkpostUrl

  const url = new URL(linkpostUrl)
  displayText = url.hostname.replace(/^(https?:\/\/)?(www\.)?/, "")

  return (
    <span className="linkpost-info">
      Originally linked to{" "}
      {
        <a href={linkpostUrl} className="external" target="_blank" rel="noopener noreferrer">
          <code>{displayText}</code>
        </a>
      }
    </span>
  )
}

// an admonition that displays the tags for the post
export const renderTags = (props: QuartzComponentProps): JSX.Element => {
  // Check if there are any tags
  const tags = props.fileData.frontmatter?.tags
  if (!tags || tags.length === 0) {
    // skipcq: JS-0424
    return <></>
  }

  return (
    <blockquote className="admonition admonition-metadata" data-admonition="tag">
      <div className="admonition-title">
        <div className="admonition-icon" />
        <div className="admonition-title-inner">Tags</div>
      </div>
      <div className="admonition-content" id="tags">
        <TagListComponent {...props} />
      </div>
    </blockquote>
  )
}

/**
 * Renders the sequence title as a JSX element.
 */
export const renderSequenceTitleJsx = (fileData: QuartzPluginData) => {
  const sequence = fileData.frontmatter?.["lw-sequence-title"]
  if (!sequence) return null
  const sequenceLink: string = fileData.frontmatter?.["sequence-link"] as string

  return (
    <div>
      <b>Sequence:</b>{" "}
      <a href={sequenceLink} className="internal can-trigger-popover" style={{ cursor: "pointer" }}>
        {sequence}
      </a>
    </div>
  )
}
/**
 * Renders the previous post in a sequence as a JSX element.
 */
export const renderPreviousPostJsx = (fileData: QuartzPluginData) => {
  const prevPostSlug: string = (fileData.frontmatter?.["prev-post-slug"] as string) || ""
  const prevPostTitle: string = (fileData.frontmatter?.["prev-post-title"] as string) || ""
  const prevPostTitleFormatted = formatTitle(prevPostTitle)
  if (!prevPostSlug) return null

  return (
    <p style={{ margin: 0 }}>
      <b>Previous:</b>{" "}
      <a href={prevPostSlug} className="internal can-trigger-popover">
        {prevPostTitleFormatted}
      </a>
    </p>
  )
}

/**
 * Renders the next post in a sequence as a JSX element.
 */
export const renderNextPostJsx = (fileData: QuartzPluginData) => {
  const nextPostSlug: string = (fileData.frontmatter?.["next-post-slug"] as string) || ""
  const nextPostTitle: string = (fileData.frontmatter?.["next-post-title"] as string) || ""
  const nextPostTitleFormatted = formatTitle(nextPostTitle)
  if (!nextPostSlug) return null

  return (
    <p style={{ marginTop: ".5rem" }}>
      <b>Next:</b>{" "}
      <a href={nextPostSlug} className="internal can-trigger-popover">
        {nextPostTitleFormatted}
      </a>
    </p>
  )
}

/**
 * Renders sequence information, including title, previous, and next posts.
 */
export const renderSequenceInfo = (fileData: QuartzPluginData): JSX.Element | null => {
  const sequenceTitle = renderSequenceTitleJsx(fileData)
  if (!sequenceTitle) return null

  const sequenceTitleJsx = renderSequenceTitleJsx(fileData)
  const previousPostJsx = renderPreviousPostJsx(fileData)
  const nextPostJsx = renderNextPostJsx(fileData)

  return (
    <blockquote className="admonition admonition-metadata" data-admonition="example">
      <div className="admonition-title">
        <div className="admonition-icon" />
        {sequenceTitleJsx}
      </div>
      <div className="admonition-content">
        {previousPostJsx}
        {nextPostJsx}
      </div>
    </blockquote>
  )
}

/**
 * Renders post statistics, including reading time, linkpost info, publication info, and last updated date.
 */
export function renderPostStatistics(props: QuartzComponentProps): JSX.Element | null {
  const readingTime = renderReadingTime(props.fileData)
  const linkpostInfo = renderLinkpostInfo(props.fileData)
  const publicationInfo = RenderPublicationInfo(props.cfg, props.fileData)
  const lastUpdated = renderLastUpdated(props.cfg, props.fileData)

  return (
    <blockquote
      id="post-statistics"
      className="admonition admonition-metadata"
      data-admonition="info"
    >
      <div className="admonition-title">
        <div className="admonition-icon" />
        <div className="admonition-title-inner">About this post</div>
      </div>
      <div className="admonition-content">
        <ul>
          {readingTime && <li>{readingTime}</li>}
          {linkpostInfo && <li>{linkpostInfo}</li>}
          {publicationInfo && <li>{publicationInfo}</li>}
          {lastUpdated && <li>{lastUpdated}</li>}
        </ul>
      </div>
    </blockquote>
  )
}

/**
 * Renders the content metadata section, including sequence info, tags, post statistics, and backlinks.
 */
export const ContentMetadata = (props: QuartzComponentProps) => {
  if (props.fileData.frontmatter?.hide_metadata) {
    return <div id="content-meta" />
  }

  let metadataElements: Array<JSX.Element | null>
  const text = props.fileData.text
  if (text) {
    metadataElements = [
      renderSequenceInfo(props.fileData),
      renderTags(props),
      renderPostStatistics(props),
    ]
  } else {
    metadataElements = []
  }
  // Remove any null or undefined elements
  const filteredElements = metadataElements.filter(Boolean)

  const backlinkProps = text ? <Backlinks {...props} /> : null

  return (
    <div id="content-meta">
      {filteredElements}
      {backlinkProps}
    </div>
  )
}

ContentMetadata.css = style

export default (() => ContentMetadata) satisfies QuartzComponentConstructor
