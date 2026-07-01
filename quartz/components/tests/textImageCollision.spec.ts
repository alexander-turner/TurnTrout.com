import type { Page } from "@playwright/test"

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { FrontmatterData } from "../../plugins/vfile"

import { parseFrontmatter } from "../../util/frontmatter"
import { findGitRoot } from "../../util/log"
import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// Invariant: no content image may render on top of body text. A floated or
// absolutely-positioned image whose surrounding text doesn't know to wrap
// around it (e.g. because the two live in independent layout containers)
// leaves glyphs painted underneath the image instead of beside it — the
// bug looks fine in isolation but silently swallows a few words or a whole
// heading. Since a well-behaved float reflows sibling text around itself,
// genuine collisions are always a layout bug, not a false positive from
// normal CSS floats.

const CONTENT_DIR = join(findGitRoot(), "website_content")

/**
 * All published article permalinks, read straight from frontmatter. Reading
 * the source directly (rather than a running server's content index) keeps
 * the per-article test list available at spec-parse time, before any
 * webServer navigation happens.
 */
function getAllArticleSlugs(): readonly string[] {
  const slugs: string[] = []
  for (const entry of readdirSync(CONTENT_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue
    const raw = readFileSync(join(CONTENT_DIR, entry.name), "utf-8")
    const data = parseFrontmatter(raw) as FrontmatterData
    const permalink = data.permalink
    if (typeof permalink !== "string" || permalink === "") continue
    if (data.draft || data.avoidIndexing) continue
    slugs.push(permalink)
  }
  return slugs.sort()
}

const ARTICLE_SLUGS = getAllArticleSlugs()

// Small inline icons (favicons) intentionally use a slight negative margin
// for baseline alignment (quartz/styles/favicon.scss) and aren't the
// "content image obscures a paragraph" bug this test targets.
const MIN_IMAGE_SIZE_PX = 48

// A real collision hides several pixels of glyph under the image; a couple
// of px is subpixel rounding or an intentional icon nudge, not a bug.
const TOLERANCE_PX = 4

interface Offender {
  readonly text: string
  readonly tag: string
  readonly imgSrc: string
  readonly overlapPx: number
}

// Runs in the page. Compares every large `<img>`'s box against the actual
// painted rects of every text run (via Range.getClientRects, not element
// bounding boxes) so normally-wrapped float text — whose line boxes never
// enter the float's box — is never flagged, only text that is genuinely
// rendered underneath an image.
/* istanbul ignore next -- executed in the browser, not under Jest */
function collectTextImageCollisions([tolerance, minImageSize]: readonly [
  number,
  number,
]): Offender[] {
  const isVisible = (el: Element): boolean => {
    const style = getComputedStyle(el)
    return style.display !== "none" && style.visibility !== "hidden"
  }

  const images = Array.from(document.body.querySelectorAll<HTMLImageElement>("img")).filter(
    (img) => {
      if (!isVisible(img)) return false
      const rect = img.getBoundingClientRect()
      return rect.width >= minImageSize && rect.height >= minImageSize
    },
  )
  if (images.length === 0) return []

  const offenders: Offender[] = []
  const range = document.createRange()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(candidate) {
      if (!candidate.textContent?.trim()) return NodeFilter.FILTER_REJECT
      const parent = candidate.parentElement
      if (!parent || !isVisible(parent)) return NodeFilter.FILTER_REJECT
      // Captions render below their image by design; excluding them here
      // (rather than by DOM position) also covers any future caption markup.
      if (parent.closest("figcaption, script, style, noscript, template")) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let node = walker.nextNode()
  while (node) {
    const parentEl = node.parentElement
    const textNode = node
    node = walker.nextNode()
    if (!parentEl) continue

    range.selectNodeContents(textNode)
    const textRects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0)

    for (const img of images) {
      const imgRect = img.getBoundingClientRect()
      for (const textRect of textRects) {
        const overlapWidth =
          Math.min(textRect.right, imgRect.right) - Math.max(textRect.left, imgRect.left)
        const overlapHeight =
          Math.min(textRect.bottom, imgRect.bottom) - Math.max(textRect.top, imgRect.top)
        if (overlapWidth > tolerance && overlapHeight > tolerance) {
          offenders.push({
            text: textNode.textContent?.trim().slice(0, 80) ?? "",
            tag: parentEl.tagName.toLowerCase(),
            imgSrc: img.currentSrc || img.src,
            overlapPx: Math.round(Math.min(overlapWidth, overlapHeight)),
          })
          break
        }
      }
    }
  }
  return offenders
}

/* istanbul ignore next -- executed in the browser, not under Jest */
function pageSettled(): boolean {
  return !document.fonts || document.fonts.status === "loaded"
}

async function settle(page: Page, url: string) {
  await gotoPage(page, url)
  await page.waitForFunction(pageSettled, undefined, { timeout: 10_000 })
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

function describeOffenders(offenders: readonly Offender[]): string {
  return offenders
    .map((o) => `<${o.tag}> "${o.text}" is covered by ${o.imgSrc} (${o.overlapPx}px overlap)`)
    .join("\n  ")
}

for (const slug of ARTICLE_SLUGS) {
  test(`no text-image collisions on /${slug}`, async ({ page }, testInfo) => {
    // Collision geometry comes from the CSS box model, not the rendering
    // engine, so checking one engine per viewport avoids tripling the cost
    // of this O(articles) scan across all 3 configured browsers.
    test.skip(
      !testInfo.project.name.endsWith("Chrome"),
      "collision geometry doesn't vary by rendering engine",
    )
    // Article weight varies enormously (some embed several server-rendered
    // Mermaid diagrams), so the default 45s budget is too tight for the
    // heaviest pages under CI load.
    test.slow()
    await settle(page, `/${slug}`)
    const offenders = await page.evaluate(collectTextImageCollisions, [
      TOLERANCE_PX,
      MIN_IMAGE_SIZE_PX,
    ] as const)
    expect(
      offenders,
      `Text hidden behind image(s) on /${slug}:\n  ${describeOffenders(offenders)}`,
    ).toEqual([])
  })
}
