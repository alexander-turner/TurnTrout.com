import { type Element } from "hast"
import { toJsxRuntime, type Options } from "hast-util-to-jsx-runtime"
import { h } from "hastscript"
import { Fragment, jsx, jsxs } from "preact/jsx-runtime"

import { type GlobalConfiguration } from "../cfg"
import { type QuartzPluginData } from "../plugins/vfile"
import { type FullSlug, resolveRelative } from "../util/path"
import { formatTitle } from "./component_utils"
import { locale } from "./constants"
import { getDate } from "./Date"
import { formatTag } from "./TagList"
import { type QuartzComponent, type QuartzComponentProps } from "./types"

/**
 * Comparison function for sorting files by date and alphabetically
 *
 * @param cfg - Global configuration object containing locale settings
 * @returns A comparison function that:
 * 1. Prioritizes files with dates over files without dates
 * 2. For files with dates, sorts by date in descending order (newest first)
 * 3. For files without dates or with equal dates, sorts alphabetically by title
 */
export function byDateAndAlphabetical(
  cfg: GlobalConfiguration,
): (f1: QuartzPluginData, f2: QuartzPluginData) => number {
  return (f1, f2) => {
    if (f1.dates && f2.dates) {
      // sort descending
      const date1 = getDate(cfg, f1)
      const date2 = getDate(cfg, f2)
      if (!date1 || !date2) {
        return 0
      }
      return date2.getTime() - date1.getTime()
    } else if (f1.dates && !f2.dates) {
      // prioritize files with dates
      return -1
    } else if (!f1.dates && f2.dates) {
      return 1
    }

    // otherwise, sort lexographically by title
    const f1Title = f1.frontmatter?.title?.toLowerCase() ?? ""
    const f2Title = f2.frontmatter?.title?.toLowerCase() ?? ""
    return f1Title.localeCompare(f2Title, locale)
  }
}

type Props = {
  limit?: number
} & QuartzComponentProps

/**
 * Creates a page title element with a link to the page
 *
 * @param formattedTitle - The formatted title text to display
 * @param fileDataSlug - The slug of the current file (for relative path resolution)
 * @param pageSlug - The target page's slug
 * @returns A HAST Element containing the title and link
 */
export function createPageTitleElement(
  formattedTitle: string,
  fileDataSlug: FullSlug,
  pageSlug: FullSlug,
): Element {
  return h("p", { class: "page-listing-title" }, [
    h(
      "a.internal.can-trigger-popover",
      { href: resolveRelative(fileDataSlug, pageSlug) },
      formattedTitle,
    ),
  ])
}

/**
 * Creates a list of tag elements with links
 *
 * @param tags - Array of tag strings to create elements for
 * @param fileDataSlug - The slug of the current file (for relative path resolution)
 * @returns A HAST Element containing the list of tag links
 */
export function createTagsElement(tags: string[], fileDataSlug: FullSlug): Element {
  return h(
    "ul.tags",
    tags.map((tag) =>
      h("li", [
        h(
          "a.internal.tag-link.can-trigger-popover",
          { href: resolveRelative(fileDataSlug, `tags/${tag}` as FullSlug) },
          formatTag(tag),
        ),
      ]),
    ),
  )
}

/**
 * Creates a complete page item element including title, date, and tags
 *
 * @param page - The page data to create an element for
 * @param fileDataSlug - The slug of the current file (for relative path resolution)
 * @param cfg - Global configuration object
 * @returns A HAST Element representing the complete page item
 */
export function createPageItemElement(
  page: QuartzPluginData,
  fileDataSlug: FullSlug,
  cfg: GlobalConfiguration,
): Element {
  const title = page.frontmatter?.title
  const formattedTitle = title ? formatTitle(title) : ""
  let tags = page.frontmatter?.tags ?? []
  tags = tags.sort((a, b) => b.length - a.length)
  const date = getDate(cfg, page)?.toLocaleDateString(locale) || ""
  const pageSlug = page.slug || ("" as FullSlug)

  return h("div.section", [
    page.dates && h("time.meta", [date]),
    h("div.desc", [
      createPageTitleElement(formattedTitle, fileDataSlug, pageSlug),
      createTagsElement(tags, fileDataSlug),
    ]),
  ])
}

/**
 * Creates a HAST (Hypertext Abstract Syntax Tree) representation of a page list
 *
 * This function is the core of the PageList component, responsible for creating
 * the HTML structure that displays a list of pages with their metadata.
 *
 * @param cfg - Global configuration object containing site-wide settings
 * @param fileData - Data for the current file being processed
 * @param allFiles - Array of all files/pages in the site
 * @param limit - Optional maximum number of pages to include in the list
 * @returns Element - A HAST Element representing the page list
 *
 * The function performs the following steps:
 * 1. Sorts pages by date (newest first) and alphabetically
 * 2. Applies optional limit to number of pages shown
 * 3. Creates a hierarchical HTML structure for each page including:
 *    - Date (if available)
 *    - Page title with link
 *    - Tags with links
 *    - Dividers between pages
 *
 * The resulting HTML structure follows this pattern:
 * <div class="page-listing">
 *   <ul class="section-ul">
 *     <li class="section-li">
 *       <div class="section">
 *         <time class="meta">date</time>
 *         <div class="desc">
 *           <p class="page-listing-title"><a>title</a></p>
 *           <ul class="tags"><li><a>tag</a></li></ul>
 *         </div>
 *       </div>
 *       <hr class="page-divider" />
 *     </li>
 *     ...
 *   </ul>
 * </div>
 */
export function createPageListHast(
  cfg: GlobalConfiguration,
  fileData: QuartzPluginData,
  allFiles: QuartzPluginData[],
  limit?: number,
): Element {
  let list = allFiles.sort(byDateAndAlphabetical(cfg))
  if (limit) {
    list = list.slice(0, limit)
  }

  const fileDataSlug = fileData.slug || ("" as FullSlug)

  return h("div.page-listing", [
    h(
      "ul.section-ul",
      list
        .map((page: QuartzPluginData, index: number) => [
          h("li.section-li", [
            createPageItemElement(page, fileDataSlug, cfg),
            ...(index < list.length - 1 ? [h("hr.page-divider")] : []),
          ]),
        ])
        .flat()
        .filter(Boolean),
    ),
  ])
}

/**
 * A Quartz component that renders a list of pages with their metadata
 *
 * This component is used to display lists of pages throughout the site,
 * such as in folder views, tag pages, and recent posts sections.
 *
 * @param props - Component props including:
 *   - cfg: Global configuration
 *   - fileData: Current file data
 *   - allFiles: All available files
 *   - limit: Optional limit on number of pages to show
 * @returns A JSX element containing the rendered page list
 */
export const PageList: QuartzComponent = ({ cfg, fileData, allFiles, limit }: Props) => {
  const pageListHast = createPageListHast(cfg, fileData, allFiles, limit)
  return toJsxRuntime(pageListHast, { Fragment, jsx, jsxs } as Options)
}
