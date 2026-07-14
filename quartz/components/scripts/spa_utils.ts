import { type SpaNavigateOptions } from "../../../globals"
import {
  nodeTypeElement,
  scrollPositionKeyPrefix,
  scrollPositionMinThreshold,
  scrollPositionTimestampKeyPrefix,
  SEARCH_MATCH_CLASS,
} from "../constants"
import { matchHTML } from "./search"

/**
 * Checks if a URL is local (same origin as the current window).
 *
 * @param href - The URL string to check.
 * @returns True if the URL has the same origin as the current window, false otherwise.
 */
export function isLocalUrl(href: string): boolean {
  try {
    // Base URL resolves protocol-relative and relative inputs against the current page
    const url = new URL(href, window.location.href)
    return window.location.origin === url.origin
  } catch {
    return false
  }
}

/**
 * Typeguard to check if a target is an Element.
 */
export const isElement = (target: EventTarget | null): target is Element =>
  (target as Node)?.nodeType === nodeTypeElement

/**
 * Extracts navigation options from a click event.
 * Returns URL and scroll behavior settings, or `undefined` when the click
 * should not be intercepted by the SPA router (e.g. external links,
 * `target="_blank"` anchors, or anchors with `data-router-ignore`).
 */
export const getNavigationOpts = ({
  target,
}: Event): { url: URL; scroll?: boolean } | undefined => {
  if (!target || !isElement(target)) return undefined

  const closestLink = target.closest("a")
  if (!closestLink) return undefined

  // Check target="_blank" on the ancestor anchor, not just the clicked node,
  // so clicks on nested children (e.g. <span> inside <a target="_blank">) still
  // open in a new tab.
  if (closestLink.getAttribute("target") === "_blank") return undefined

  const dataset = closestLink.dataset
  if ("routerIgnore" in dataset) return undefined

  const href = closestLink.href
  if (!href || !isLocalUrl(href)) return undefined

  return {
    url: new URL(href),
    scroll: "routerNoScroll" in dataset ? false : undefined,
  }
}

/**
 * Persists the current scroll position for the given pathname in localStorage,
 * alongside a save timestamp so positions older than scrollPositionMaxAgeMs can
 * be evicted when a returning reader loads the page. Positions below
 * {@link scrollPositionMinThreshold} (i.e. near the top) are removed so
 * returning readers scroll to the top rather than a tiny offset.
 */
export function saveScrollToLocalStorage(pathname: string, scrollY: number): void {
  /* istanbul ignore next -- Storage is always defined in jsdom */
  if (typeof Storage === "undefined") return

  const key = `${scrollPositionKeyPrefix}${pathname}`
  const timestampKey = `${scrollPositionTimestampKeyPrefix}${pathname}`
  if (scrollY < scrollPositionMinThreshold) {
    localStorage.removeItem(key)
    localStorage.removeItem(timestampKey)
    return
  }

  localStorage.setItem(key, scrollY.toString())
  localStorage.setItem(timestampKey, Date.now().toString())
}

/**
 * Scroll to the first in-page match for a search query by injecting
 * `.search-match` spans into the article and (optionally) the `#article-title`.
 *
 * Returns `true` if the article was updated to show a match, `false` if no
 * matches were found or there is no `<article>` element to search in.
 *
 * If the match lives in the article title, the page stays scrolled to the top
 * (the title is already visible).
 */
export function scrollToMatch(searchText: string): boolean {
  const article = document.querySelector("article") as HTMLElement | null
  if (!article) return false

  const matchedArticle = matchHTML(searchText, article)
  article.replaceWith(matchedArticle)

  const titleEl = document.getElementById("article-title")
  let hasTitleMatch = false
  if (titleEl) {
    const matchedTitle = matchHTML(searchText, titleEl)
    hasTitleMatch = matchedTitle.querySelectorAll(`.${SEARCH_MATCH_CLASS}`).length > 0
    titleEl.replaceWith(matchedTitle)
  }

  const bodyMatches = matchedArticle.querySelectorAll(`.${SEARCH_MATCH_CLASS}`)
  if (bodyMatches.length === 0 && !hasTitleMatch) return false

  // If the search term matched in the article title, stay at the top of the page
  // — the title is already visible and scrolling down would be disorienting.
  if (hasTitleMatch) return true

  const firstMatch = bodyMatches[0] as HTMLElement
  const targetPos =
    firstMatch.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.25
  window.scrollTo({ top: targetPos, behavior: "instant" })
  return true
}

/**
 * Standard `#<id>` hash navigation: scroll the element with the given ID into view.
 *
 * @param urlTarget - The raw `location.hash` value, including the leading `#`.
 */
export function scrollToUrlTarget(urlTarget: string): void {
  if (!urlTarget) return

  const id = decodeURIComponent(urlTarget.substring(1))
  const elt = document.getElementById(id)
  if (elt) {
    const targetPos = elt.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: targetPos, behavior: "instant" })
  }
}

/**
 * Handles scrolling after navigation based on options and final URL hash.
 * Does not use scroll positions from history state.
 *
 * When `opts.searchTerm` is supplied (in-site search result navigation), the
 * destination page is highlighted and scrolled to that term directly.
 */
export function handleNavigationScroll(
  finalUrl: URL,
  opts?: Pick<SpaNavigateOptions, "scroll" | "searchTerm">,
): void {
  if (opts?.scroll === false) return
  if (opts?.searchTerm && scrollToMatch(opts.searchTerm)) return
  if (finalUrl.hash) {
    scrollToUrlTarget(finalUrl.hash)
    return
  }
  window.scrollTo({ top: 0, behavior: "instant" })
}

/**
 * Extracts the `url=` target from a `<meta http-equiv="refresh">` tag, if any.
 * Returns `null` when no meta refresh is present in the input HTML.
 */
export function extractMetaRefreshUrl(html: string): string | null {
  const match = html.match(
    /<meta[^>]*http-equiv\s*=\s*["']?refresh[^>]*content\s*=\s*["']?\d+;\s*url=(?<url>[^"'>\s]+)["']?/i,
  )
  return match?.groups?.url ?? null
}

/**
 * Replaces head meta tags in the current document to match the tags from a
 * freshly-fetched document, preserving any element with a `spa-preserve`
 * attribute. The document title is updated alongside.
 *
 * We drive head updates manually (rather than using micromorph) because we
 * need the `spa-preserve` escape hatch and because Safari/Firefox otherwise
 * cache head state inconsistently.
 */
export function updateHeadElements(html: Document): void {
  const newHead = html.head
  const currentHead = document.head

  const newTitle = newHead.querySelector("title")?.textContent
  if (newTitle) {
    document.title = newTitle
  }

  const metaTags = Array.from(newHead.querySelectorAll("meta")).filter(
    (meta) => !meta.hasAttribute("spa-preserve"),
  )

  for (const newMeta of metaTags) {
    // A charset meta (<meta charset="utf-8">) is page-invariant and carries no
    // name/property/http-equiv key, so it can't be matched against the existing
    // head. Syncing it would append a keyless <meta content=""> on every SPA
    // navigation that the removal pass never reclaims, so skip it.
    if (newMeta.hasAttribute("charset")) continue

    const name = newMeta.getAttribute("name")
    const property = newMeta.getAttribute("property")
    const httpEquiv = newMeta.getAttribute("http-equiv")
    const content = newMeta.getAttribute("content") || ""

    let existingMeta: HTMLMetaElement | null = null
    let selector = ""
    if (name) {
      selector = `meta[name="${name}"]`
    } else if (property) {
      selector = `meta[property="${property}"]`
    } else if (httpEquiv) {
      selector = `meta[http-equiv="${httpEquiv}"]`
    }

    if (selector) {
      const candidates = currentHead.querySelectorAll(selector)
      for (const candidate of Array.from(candidates)) {
        if (!candidate.hasAttribute("spa-preserve")) {
          existingMeta = candidate as HTMLMetaElement
          break
        }
      }
    }
    if (existingMeta) {
      existingMeta.setAttribute("content", content)
    } else {
      const newMetaElement = document.createElement("meta")
      if (name) newMetaElement.name = name
      if (property) newMetaElement.setAttribute("property", property)
      if (httpEquiv) newMetaElement.httpEquiv = httpEquiv
      newMetaElement.setAttribute("content", content)
      currentHead.appendChild(newMetaElement)
    }
  }

  // Remove old meta tags that are no longer present in the new head,
  // except for any tagged spa-preserve.
  const currentMetas = currentHead.querySelectorAll("meta")
  for (const currentMeta of Array.from(currentMetas)) {
    if (currentMeta.hasAttribute("spa-preserve")) continue

    const name = currentMeta.getAttribute("name")
    const property = currentMeta.getAttribute("property")
    const httpEquiv = currentMeta.getAttribute("http-equiv")

    let selector: string
    if (name) {
      selector = `meta[name="${name}"]`
    } else if (property) {
      selector = `meta[property="${property}"]`
    } else if (httpEquiv) {
      selector = `meta[http-equiv="${httpEquiv}"]`
    } else {
      continue
    }
    if (!newHead.querySelector(selector)) {
      currentMeta.remove()
    }
  }
}
