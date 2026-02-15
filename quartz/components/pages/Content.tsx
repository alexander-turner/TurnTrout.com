import { h } from "hastscript"
// skipcq: JS-W1028
import { JSX } from "preact"
// skipcq: JS-C1003
import * as React from "react"

import type { FilePath } from "../../util/path"
import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

import { insertFavicon } from "../../plugins/transformers/linkfavicons"
import { htmlToJsx } from "../../util/jsx"
import { specialFaviconPaths } from "../constants"
import { buildNestedList } from "../TableOfContents"

export function createLinkWithFavicon(
  text: string,
  href: string,
  faviconPath: string,
  props: Record<string, unknown> = {},
): JSX.Element {
  const linkNode = h("a", { href, ...props }, text)
  insertFavicon(faviconPath, linkNode)
  return htmlToJsx("" as FilePath, linkNode) as JSX.Element
}

const WarningLink = createLinkWithFavicon(
  "Reward is not the optimization target",
  "./reward-is-not-the-optimization-target",
  specialFaviconPaths.turntrout,
  {
    class: "internal can-trigger-popover",
    "data-slug": "reward-is-not-the-optimization-target",
  },
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

const RewardTargetLink = createLinkWithFavicon(
  "Reward Is Not The Optimization Target,",
  "/reward-is-not-the-optimization-target",
  specialFaviconPaths.turntrout,
  {
    class: "internal can-trigger-popover",
    "data-slug": "reward-is-not-the-optimization-target",
  },
)

const rewardPostWarning = (
  <blockquote className="admonition warning" data-admonition="warning">
    <WarningTitle />
    <p>
      This post treats reward functions as &ldquo;specifying goals&rdquo;, in some sense. As I
      explained in {RewardTargetLink} this is a misconception that can seriously damage your ability
      to understand how AI works. Rather than &ldquo;incentivizing&rdquo; behavior, reward signals
      are (in many cases) akin to a per-datapoint learning rate. Reward chisels circuits into the
      AI. That&rsquo;s it!
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
  const classString = ["previewable", ...classes].join(" ")
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

// istanbul ignore next
function lessWrongQuestion(url: string): JSX.Element {
  const lessWrongLink = createLinkWithFavicon(
    "originally posted as a question on LessWrong.",
    url,
    specialFaviconPaths.lesswrong,
    {
      class: "external",
      target: "_blank",
      rel: "noopener noreferrer",
    },
  )

  return (
    <blockquote className="admonition question" data-admonition="question">
      <div className="admonition-title">
        <span className="admonition-title-inner">
          <span className="admonition-icon"></span>
          Question
        </span>
      </div>
      <p>This was {lessWrongLink}</p>
    </blockquote>
  )
}

export default (() => Content) satisfies QuartzComponentConstructor
