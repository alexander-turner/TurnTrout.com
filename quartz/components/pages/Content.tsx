import { htmlToJsx } from "../../util/jsx"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { buildNestedList } from "../TableOfContents"
import {
  TURNTROUT_FAVICON_PATH,
  LESSWRONG_FAVICON_PATH,
} from "../../plugins/transformers/linkfavicons"

const turntroutFavicon = <img src={TURNTROUT_FAVICON_PATH} class="favicon" alt="" />

const rewardPostWarning = (
  <blockquote class="callout warning" data-callout="warning">
    <div class="callout-title">
      <div class="callout-icon"></div>
      <div class="callout-title-inner">
        <p>
          {" "}
          <a
            href="/reward-is-not-the-optimization-target"
            class="internal alias"
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
        class="internal alias"
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
    <article class={classString} data-use-dropcap={useDropcap}>
      <span class="mobile-only">{toc}</span>
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
  const [toc, _] = buildNestedList(fileData.toc, 0, 0)
  return (
    <blockquote
      class="callout example is-collapsible is-collapsed"
      data-callout="example"
      data-callout-fold=""
      style="max-height: 75px;" // prevent flashes of unstyled content
    >
      <div class="callout-title">
        <div class="callout-icon"></div>
        <div class="callout-title-inner">
          <p>Table of contents</p>
        </div>
        <div class="fold-callout-icon"></div>
      </div>
      <div id="toc-content-mobile" class="callout-content">
        <ul style="padding-left: 1rem !important;">{toc}</ul>
      </div>
    </blockquote>
  )
}

const lessWrongFavicon = <img src={LESSWRONG_FAVICON_PATH} class="favicon" alt="" />

function lessWrongQuestion(url: string): JSX.Element {
  return (
    <blockquote class="callout question" data-callout="question">
      <div class="callout-title">
        <div class="callout-icon"></div>
        <div class="callout-title-inner">
          <p>Question</p>
        </div>
      </div>
      <p>
        This was{" "}
        <a href={url} class="external alias" target="_blank" rel="noopener noreferrer">
          originally posted as a question on LessWrong.
        </a>
        {lessWrongFavicon}
      </p>
    </blockquote>
  )
}

export default (() => Content) satisfies QuartzComponentConstructor
