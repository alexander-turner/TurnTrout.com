// SPA Inline Module
// Handles navigation between pages without full page reloads

import micromorph from "micromorph"
import { escape } from "validator"

import { type FullSlug, getFullSlug, normalizeRelativeURLs } from "../../util/path"
import { pondVideoId } from "../component_utils"
import { debounce } from "./component_script_utils"
import { isLocalUrl, DEBOUNCE_WAIT_MS } from "./spa_utils"

// SPA accessibility announcement for screen readers
const announcer = document.createElement("route-announcer")

declare global {
  interface Window {
    __routerInitialized?: boolean
    spaNavigate: (url: URL, opts?: { scroll?: boolean; fetch?: boolean }) => Promise<void>
  }
}

// FUNCTIONS

const NODE_TYPE_ELEMENT = 1

/**
 * Returns the current scroll position as an integer.
 */
function getScrollPosition(): number {
  return Math.round(window.scrollY)
}

const updateScrollState = debounce(
  (() => {
    const currentScroll = getScrollPosition()
    console.debug(
      `[updateScrollState] replaceState scroll: ${currentScroll}, current state:`,
      history.state,
    )
    history.replaceState({ ...history.state, scroll: currentScroll }, "")

    // Firefox fallback: also save to sessionStorage for reload cases
    if (typeof Storage !== "undefined") {
      sessionStorage.setItem("instantScrollRestore", currentScroll.toString())
    }
  }) as () => void,
  DEBOUNCE_WAIT_MS,
)

/**
 * Typeguard to check if a target is an Element
 */
const isElement = (target: EventTarget | null): target is Element =>
  (target as Node)?.nodeType === NODE_TYPE_ELEMENT

/**
 * Extracts navigation options from a click event
 * Returns URL and scroll behavior settings
 */
const getOpts = ({ target }: Event): { url: URL; scroll?: boolean } | undefined => {
  if (!target || !isElement(target)) return undefined

  const attributes = target.attributes
  if (!attributes) return undefined

  const targetAttr = attributes.getNamedItem("target")
  if (targetAttr?.value === "_blank") return undefined

  const closestLink = target.closest("a")
  if (!closestLink) return undefined

  const dataset = closestLink.dataset
  if (!dataset || "routerIgnore" in dataset) return undefined

  const href = closestLink.href
  if (!href || !isLocalUrl(href)) return undefined

  return {
    url: new URL(href),
    scroll: dataset && "routerNoScroll" in dataset ? false : undefined,
  }
}

// skipcq: JS-D1001
function dispatchNavEvent(url: FullSlug) {
  const event: CustomEventMap["nav"] = new CustomEvent("nav", { detail: { url } })
  document.dispatchEvent(event)
}

// skipcq: JS-D1001
function scrollToHash(hash: string): void {
  if (!hash) return

  const id = decodeURIComponent(hash.substring(1))
  const elt = document.getElementById(id)
  if (elt) {
    const targetPos = elt.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: targetPos, behavior: "instant" })
  }
}

/**
 * Fetches page content and updates the DOM, head, title, etc.
 */
async function updatePage(html: Document, url: URL): Promise<void> {
  normalizeRelativeURLs(html, url)

  // Extract title for accessibility announcer
  const title =
    html.querySelector("title")?.textContent ??
    html.querySelector("h1")?.textContent ??
    url.pathname

  if (announcer.textContent !== title) {
    announcer.textContent = title
  }
  announcer.dataset.persist = ""
  // Append announcer to the *new* body before morph
  // micromorph will merge it into the existing DOM structure
  html.body.appendChild(announcer)

  // Clean up potential extension-injected siblings around the video
  const videoElement = document.getElementById(pondVideoId)
  if (videoElement?.parentElement) {
    const parent = videoElement.parentElement
    Array.from(parent.childNodes).forEach((node) => {
      if (node !== videoElement) {
        parent.removeChild(node)
      }
    })
  }

  console.debug(`[updatePage] Starting micromorph for ${url.pathname}`)
  try {
    await micromorph(document.documentElement, html.documentElement)
    console.debug(`[updatePage] Micromorph finished for ${url.pathname}`)
  } catch (e) {
    console.error(`[updatePage] Micromorph error for ${url.pathname}:`, e)
  }
}

interface FetchResult {
  status: "success" | "error" | "fallback"
  content?: string
  finalUrl: URL
  responseStatus?: number
  contentType?: string | null
}

/**
 * Fetches content from the specified URL and returns the result or triggers a fallback.
 * @param url The URL to fetch content from.
 * @returns A promise that resolves to a FetchResult indicating success with content or fallback.
 */
async function fetchContent(url: URL): Promise<FetchResult> {
  let responseStatus: number | undefined
  let contentType: string | null = null
  let content: string | undefined

  try {
    const res = await fetch(url.toString())
    responseStatus = res.status
    contentType = res.headers.get("content-type")

    if (res.ok && contentType?.startsWith("text/html")) {
      content = await res.text()
      return { status: "success", content, finalUrl: url, responseStatus, contentType }
    } else {
      const sanitizedContentType = contentType ? escape(contentType) : "unknown"
      const sanitizedResponseStatus = responseStatus ? escape(responseStatus.toString()) : "unknown"
      console.warn(
        `[fetchContent] Fetch failed or non-HTML. Status: ${sanitizedResponseStatus}, Type: ${sanitizedContentType}. Triggering fallback.`,
      )
      window.location.href = url.toString()
      return { status: "fallback", finalUrl: url }
    }
  } catch (e) {
    console.error(`[fetchContent] Fetch error for ${url.toString()}:`, e)
    window.location.href = url.toString()
    return { status: "fallback", finalUrl: url }
  }
}

/**
 * Handles potential meta-refresh redirects found in the fetched content.
 */
async function handleRedirect(initialFetchResult: FetchResult): Promise<FetchResult> {
  if (initialFetchResult.status !== "success" || typeof initialFetchResult.content !== "string") {
    return initialFetchResult
  }

  const { content: initialContent, finalUrl: initialUrl } = initialFetchResult
  let finalContent = initialContent
  let finalUrl = initialUrl

  const metaRefreshRegex =
    /<meta[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["']?\d+;\s*url=([^"'>\s]+)["']?/i
  const match = initialContent.match(metaRefreshRegex)

  if (match?.[1]) {
    const redirectTargetRaw = match[1]
    try {
      const redirectUrl = new URL(redirectTargetRaw, initialUrl)
      const redirectFetchResult = await fetchContent(redirectUrl)

      if (
        redirectFetchResult.status !== "success" ||
        typeof redirectFetchResult.content !== "string"
      ) {
        console.warn(
          `[handleRedirect] Failed to fetch redirect target ${redirectUrl.toString()}. Propagating fallback.`,
        )
        return redirectFetchResult
      }

      finalContent = redirectFetchResult.content
      finalUrl = redirectFetchResult.finalUrl
    } catch (e) {
      console.error(
        `[handleRedirect] Error processing meta refresh from ${initialUrl.pathname} to ${redirectTargetRaw}:`,
        e,
      )
      window.location.href = initialUrl.toString()
      return { status: "fallback", finalUrl: initialUrl }
    }
  }

  return { status: "success", content: finalContent, finalUrl }
}

// skipcq: JS-D1001
function removePopovers() {
  const existingPopovers = document.querySelectorAll(".popover")
  existingPopovers.forEach((popover) => popover.remove())
}

/**
 * Fetches content for a given URL, handling potential redirects.
 * Returns the final content and URL, or null if fetching/redirect fails.
 */
async function fetchAndProcessContent(
  url: URL,
): Promise<{ content: string; finalUrl: URL } | null> {
  const initialFetch = await fetchContent(url)
  if (initialFetch.status !== "success") {
    console.debug(
      `[fetchAndProcessContent] Initial fetch failed or triggered fallback for ${url.toString()}.`,
    )
    // Fallback (window.location set) happened in fetchContent
    return null
  }

  const redirectResult = await handleRedirect(initialFetch)
  if (redirectResult.status !== "success" || typeof redirectResult.content !== "string") {
    console.debug(
      `[fetchAndProcessContent] Redirect handling failed or triggered fallback for ${url.toString()}.`,
    )
    // Fallback (window.location set) happened in handleRedirect or fetchContent
    return null
  }

  return { content: redirectResult.content, finalUrl: redirectResult.finalUrl }
}

let parser: DOMParser
/**
 * Parses HTML content and updates the DOM using micromorph.
 * Returns true on success, false on failure (triggering fallback).
 */
async function updateDOM(htmlContent: string, originalUrl: URL): Promise<boolean> {
  parser = parser || new DOMParser()
  let html: Document
  try {
    html = parser.parseFromString(htmlContent, "text/html")
  } catch (e) {
    console.error(`[updateDOM] Error parsing HTML for ${originalUrl.toString()}:`, e)
    window.location.href = originalUrl.toString() // Fallback to original requested URL
    return false
  }

  console.debug(`[updateDOM] Calling updatePage for ${originalUrl.pathname}`)
  try {
    await updatePage(html, originalUrl) // Pass original URL for consistency
    console.debug(`[updateDOM] updatePage finished for ${originalUrl.pathname}`)
    return true
  } catch (e) {
    console.error(`[updateDOM] Error during updatePage for ${originalUrl.pathname}:`, e)
    window.location.href = originalUrl.toString() // Fallback to original requested URL
    return false
  }
}

/**
 * Handles scrolling after navigation based on options and final URL hash.
 *  Doesn't use scroll position from history state.
 */
function handleNavigationScroll(finalUrl: URL, opts?: { scroll?: boolean }): void {
  if (opts?.scroll === false) {
    // explicitly skip scroll
    console.debug("[handleNavigationScroll] Skipping scroll due to data-router-no-scroll")
  } else if (finalUrl.hash) {
    // Check hash on the final URL
    console.debug(`[handleNavigationScroll] Scrolling to hash on final URL: ${finalUrl.hash}`)
    scrollToHash(finalUrl.hash)
  } else {
    console.debug("[handleNavigationScroll] Scrolling to top")
    window.scrollTo({ top: 0, behavior: "instant" })
  }
}

let lastKnownPathname = window.location.pathname
/**
 * Handles navigation triggered by clicking a link or programmatic call.
 * Updates history, maybe fetches new content, updates DOM, and handles scrolling.
 */
async function navigate(url: URL, opts?: { scroll?: boolean; fetch?: boolean }): Promise<void> {
  removePopovers()

  // 1. Persist the current scroll position in the *existing* history entry so that
  // navigating back restores the correct position (e.g., top-of-page before an
  // in-page anchor navigation).
  const currentScroll = getScrollPosition()
  history.replaceState({ ...history.state, scroll: currentScroll }, "")

  // Firefox fallback: also save to sessionStorage for reload cases
  if (typeof Storage !== "undefined") {
    sessionStorage.setItem("instantScrollRestore", currentScroll.toString())
  }

  // Only push a new history entry if the URL is actually changing. The new
  // entry intentionally starts without a scroll position; it will be updated
  // via `updateScrollState` after any subsequent scrolling.
  if (url.toString() !== window.location.href) {
    history.pushState({}, "", url)
  }

  // 2. Fetch content, handling redirects
  let finalUrl = url
  const doFetch = opts?.fetch ?? true
  if (doFetch) {
    const fetchResult = await fetchAndProcessContent(url)
    if (!fetchResult) {
      // Fetching or redirect handling failed and triggered a fallback (full page load)
      return
    }
    const { content, finalUrl: redirectedUrl } = fetchResult
    finalUrl = redirectedUrl

    // 3. Parse and update the DOM
    const updateSuccess = await updateDOM(content, url)
    if (!updateSuccess) {
      // DOM update failed and triggered a fallback (full page load)
      return
    }
    lastKnownPathname = finalUrl.pathname
  }

  // 4. Handle scrolling *after* DOM update, based on the FINAL URL
  handleNavigationScroll(finalUrl, opts)

  // 5. Notify other components of navigation
  dispatchNavEvent(getFullSlug(window))
}
window.spaNavigate = navigate

/**
 * Restores scroll position based on PopStateEvent state or URL hash.
 * Fallbacks to reloading the page on error.
 * @returns true if scroll was restored successfully, false on error/fallback.
 */
function restoreScrollPosition(targetUrl: URL): void {
  // Some browsers may deliver null event.state on popstate in headless/mobile modes.
  // Use history.state as the source of truth.
  const historyState = history.state as { scroll?: number } | null | undefined
  const scrollTarget = historyState?.scroll

  if (typeof scrollTarget === "number") {
    console.debug(`[restoreScrollPosition] Restoring scroll from state: ${scrollTarget}`)
    window.scrollTo({ top: scrollTarget, behavior: "instant" })
  } else if (targetUrl.hash) {
    console.debug(`[restoreScrollPosition] Scrolling to hash: ${targetUrl.hash}`)
    scrollToHash(targetUrl.hash)
  }
}

/**
 * Handles the popstate event triggered by browser back/forward buttons.
 * Fetches content for the target URL, updates DOM, and restores scroll position from state.
 */
async function handlePopstate(event: PopStateEvent): Promise<void> {
  // Cancel any pending scroll state updates
  updateScrollState.cancel()

  const targetUrl = new URL(window.location.toString())
  console.debug(
    `[handlePopstate] Navigating to ${targetUrl.pathname}, received state:`,
    event.state,
  )

  // If we are on the same page, we don't need to fetch anything, just scroll
  const newPathname = targetUrl.pathname
  if (newPathname !== lastKnownPathname) {
    const fetchResult = await fetchAndProcessContent(targetUrl)
    if (!fetchResult) {
      // Fetching or redirect handling failed and triggered a fallback (full page load)
      return
    }
    const { content } = fetchResult

    // Update DOM and head
    const updateSuccess = await updateDOM(content, targetUrl)
    if (!updateSuccess) {
      // DOM update failed and triggered a fallback (full page load)
      return
    }
    lastKnownPathname = newPathname
  }

  // Restore scroll position *after* DOM update
  restoreScrollPosition(targetUrl)
  dispatchNavEvent(getFullSlug(window))
}

/**
 * Creates and configures the router instance
 * - Sets up click event listeners for link interception
 * - Handles browser back/forward navigation (popstate)
 * - Sets up state saving
 */
function createRouter() {
  if (typeof window !== "undefined" && !window.__routerInitialized) {
    window.__routerInitialized = true

    window.addEventListener(
      "scroll",
      () => {
        console.debug("Scroll event fired")
        updateScrollState()
      },
      { passive: true },
    )

    document.addEventListener("click", async (event) => {
      // Use getOpts to check for valid local links ignoring modifiers/targets
      const opts = getOpts(event)
      if (!opts || !opts.url || (event as MouseEvent).ctrlKey || (event as MouseEvent).metaKey) {
        return // Let browser handle normal links, external links, or modified clicks
      }

      event.preventDefault() // Prevent default link behavior

      const targetUrl = opts.url
      const currentUrl = new URL(window.location.toString())
      const shouldFetch =
        targetUrl.pathname !== currentUrl.pathname || targetUrl.search !== currentUrl.search

      try {
        console.debug(`[Router] Click navigation to ${opts.url.toString()}`)
        await navigate(opts.url, { scroll: opts.scroll, fetch: shouldFetch })
      } catch (e) {
        console.error("Click navigation error:", e)
        // Fallback to standard navigation if spa navigation fails
        window.location.assign(opts.url)
      }
    })

    // Listener for back/forward navigation
    window.addEventListener("popstate", handlePopstate)
  }
}

// INLINE MODULE CODE

if (typeof window !== "undefined" && !window.__routerInitialized) {
  createRouter()

  // Handle initial nav event after DOM is loaded
  // Note: Scroll restoration is now handled by instantScrollRestoration.js in <head>
  const onReady = () => {
    dispatchNavEvent(getFullSlug(window))
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady)
  } else {
    onReady()
  }
}

if (!customElements.get("route-announcer")) {
  const attrs = {
    "aria-live": "assertive", // Announce changes immediately
    "aria-atomic": "true", // Read entirety of changes
    style:
      "position: absolute; left: 0; top: 0; clip: rect(0 0 0 0); clip-path: inset(50%); overflow: hidden; white-space: nowrap; width: 1px; height: 1px",
  }

  customElements.define(
    "route-announcer",
    class RouteAnnouncer extends HTMLElement {
      // skipcq: JS-D1001
      connectedCallback() {
        for (const [key, value] of Object.entries(attrs)) {
          this.setAttribute(key, value)
        }
      }
    },
  )
}
