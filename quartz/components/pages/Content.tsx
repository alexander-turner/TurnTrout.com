import { htmlToJsx } from "../../util/jsx"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { buildNestedList } from "../TableOfContents"
import {
  TURNTROUT_FAVICON_PATH,
  LESSWRONG_FAVICON_PATH,
} from "../../plugins/transformers/linkfavicons"
import React from "react"

const turntroutFavicon = <img src={TURNTROUT_FAVICON_PATH} className="favicon" alt="" />

const rewardPostWarning = (
  <blockquote className="callout warning" data-callout="warning">
    <div className="callout-title">
      <div className="callout-icon"></div>
      <div className="callout-title-inner">
        <p>
          {" "}
          <a
            href="/reward-is-not-the-optimization-target"
            className="internal alias"
            data-slug="reward-is-not-the-optimization-target"
          >
            Reward is not the optimization ta
            <span style="white-space:nowrap;">
              rget
              {turntroutFavicon}
            </span>
          </a>
        </p>
      </div>
    </div>
    <p>
      This post treats reward functions as “specifying goals”, in some sense. As I explained in{" "}
      <a
        href="/reward-is-not-the-optimization-target"
        className="internal alias"
        data-slug="reward-is-not-the-optimization-target"
      >
        Reward Is Not The Optimization Tar
        <span style="white-space:nowrap;">
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
  const useDropcap = !fileData?.frontmatter?.no_dropcap
  const showWarning = fileData.frontmatter?.["lw-reward-post-warning"] === "true"
  const isQuestion = fileData?.frontmatter?.["lw-is-question"] === "true"
  const originalURL = fileData?.frontmatter?.["original_url"]

  const content = htmlToJsx(fileData.filePath!, tree)
  const classes: string[] = fileData.frontmatter?.cssclasses ?? []
  const classString = ["popover-hint", ...classes].join(" ")
  const toc = renderTableOfContents(fileData)
  return (
    <article className={classString} data-use-dropcap={useDropcap}>
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
  return (
    <blockquote
      className="callout example is-collapsible is-collapsed"
      data-callout="example"
      data-callout-fold=""
    >
      <div className="callout-title">
        <div className="callout-icon"></div>
        <div className="callout-title-inner">
          <p>Table of contents</p>
        </div>
        <div className="fold-callout-icon"></div>
      </div>
      <div id="toc-content-mobile" className="callout-content">
        <ul style="padding-left: 1rem !important;">{toc}</ul>
      </div>
    </blockquote>
  )
}

const lessWrongFavicon = <img src={LESSWRONG_FAVICON_PATH} className="favicon" alt="" />

function lessWrongQuestion(url: string): JSX.Element {
  return (
    <blockquote className="callout question" data-callout="question">
      <div className="callout-title">
        <div className="callout-icon"></div>
        <div className="callout-title-inner">
          <p>Question</p>
        </div>
      </div>
      <p>
        This was{" "}
        <a href={url} className="external alias" target="_blank" rel="noopener noreferrer">
          originally posted as a question on LessWrong.
        </a>
        {lessWrongFavicon}
      </p>
    </blockquote>
  )
}

export default (() => Content) satisfies QuartzComponentConstructor
