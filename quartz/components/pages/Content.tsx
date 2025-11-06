// skipcq: JS-W1028
import { JSX } from "preact"
// skipcq: JS-C1003
import * as React from "react"

import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

import {
  TURNTROUT_FAVICON_PATH,
  LESSWRONG_FAVICON_PATH,
} from "../../plugins/transformers/linkfavicons"
import { htmlToJsx } from "../../util/jsx"
import { buildNestedList } from "../TableOfContents"

const turntroutFavicon = <img src={TURNTROUT_FAVICON_PATH} className="favicon" alt="" />

const WarningLink = (
  <a
    href="./reward-is-not-the-optimization-target"
    className="internal can-trigger-popover"
    data-slug="reward-is-not-the-optimization-target"
  >
    Reward is not the optimization ta
    <span className="favicon-span">
      rget
      {turntroutFavicon}
    </span>
  </a>
)

// istanbul ignore next
const WarningTitle = () => (
  <div className="admonition-title">
    <span className="admonition-title-inner">
      <span className="admonition-icon"></span>
      {WarningLink}
    </span>
  </div>
)

const rewardPostWarning = (
  <blockquote className="admonition warning" data-admonition="warning">
    <WarningTitle />
    <p>
      This post treats reward functions as “specifying goals”, in some sense. As I explained in{" "}
      <a
        href="/reward-is-not-the-optimization-target"
        className="internal can-trigger-popover"
        data-slug="reward-is-not-the-optimization-target"
      >
        Reward Is Not The Optimization Tar
        <span className="favicon-span">
          get,
          {turntroutFavicon}
        </span>
      </a>{" "}
      this is a misconception that can seriously damage your ability to understand how AI works.
      Rather than “incentivizing” behavior, reward signals are (in many cases) akin to a
      per-datapoint learning rate. Reward chisels circuits into the AI. That’s it!
    </p>
  </blockquote>
)

const Content: QuartzComponent = ({ fileData, tree }: QuartzComponentProps) => {
  const useDropcap =
    fileData?.frontmatter?.no_dropcap !== true && fileData?.frontmatter?.no_dropcap !== "true"
  const showWarning = fileData.frontmatter?.["lw-reward-post-warning"] === "true"
  const isQuestion = fileData?.frontmatter?.["lw-is-question"] === "true"
  const originalURL = fileData?.frontmatter?.["original_url"]
  if (fileData.filePath === undefined) return null

  const content = htmlToJsx(fileData.filePath, tree)
  const classes: string[] = fileData.frontmatter?.cssclasses ?? []
  const classString = ["popover-hint", ...classes].join(" ")
  const toc = renderTableOfContents(fileData)
  return (
    <article id="top" className={classString} data-use-dropcap={useDropcap}>
      <span className="mobile-only">{toc}</span>
      {isQuestion && originalURL && lessWrongQuestion(originalURL as string)}
      {showWarning && rewardPostWarning}
      {content}
    </article>
  )
}

function renderTableOfContents(fileData: QuartzComponentProps["fileData"]): JSX.Element | null {
  if (!fileData.toc || fileData.frontmatter?.toc === "false") {
    return null
  }
  const toc = buildNestedList(fileData.toc, 0, 0)[0]
  if (!toc || toc.length === 0) {
    return null
  }
  return (
    <blockquote
      className="admonition example is-collapsible"
      data-admonition="example"
      data-admonition-fold=""
    >
      <div className="admonition-title">
        <span className="admonition-title-inner">
          <span className="admonition-icon"></span>
          Table of Contents
        </span>
        <div className="fold-admonition-icon"></div>
      </div>
      <div id="toc-content-mobile" className="admonition-content">
        <ol>{toc}</ol>
      </div>
    </blockquote>
  )
}

const lessWrongFavicon = <img src={LESSWRONG_FAVICON_PATH} className="favicon" alt="" />

// istanbul ignore next
function lessWrongQuestion(url: string): JSX.Element {
  return (
    <blockquote className="admonition question" data-admonition="question">
      <div className="admonition-title">
        <span className="admonition-title-inner">
          <span className="admonition-icon"></span>
          Question
        </span>
      </div>
      <p>
        This was{" "}
        <a href={url} className="external" target="_blank" rel="noopener noreferrer">
          originally posted as a question on LessWr
          <span className="favicon-span">ong.{lessWrongFavicon}</span>
        </a>
      </p>
    </blockquote>
  )
}

export default (() => Content) satisfies QuartzComponentConstructor
