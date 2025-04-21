// SPA Inline Module
// Handles navigation between pages without full page reloads

import micromorph from "micromorph"

import { type FullSlug, getFullSlug, normalizeRelativeURLs } from "../../util/path"
import { pondVideoId } from "../component_utils"
import { debounce } from "./component_script_utils"
import { isLocalUrl, DEBOUNCE_WAIT_MS } from "./spa_utils"

declare global {
  interface Window {
    __routerInitialized?: boolean
    spaNavigate: (url: URL, opts?: { scroll?: boolean }) => Promise<void>
  }
}

// INLINE MODULE CODE

if (typeof window !== "undefined" && !window.__routerInitialized) {
  createRouter()

  // Restore scroll position on initial load/reload if available in state
  // Do this *before* potentially scrolling to a hash
  console.debug(`[Initial Load] Checking history state:`, history.state)
  const initialScroll = history.state?.scroll as number | undefined
  if (typeof initialScroll === "number") {
    console.debug(`[Initial Load] Restoring scroll from state: ${initialScroll}`)
    window.scrollTo({ top: initialScroll, behavior: "instant" })
  } else if (window.location.hash) {
    // Fallback to hash scrolling if no state scroll is found
    console.debug(`Initial load: Scrolling to hash: ${window.location.hash}`)
    scrollToHash(window.location.hash)
  }

  dispatchNavEvent(getFullSlug(window))
}

// SPA accessibility announcement for screen readers
const announcer = document.createElement("route-announcer")

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
      connectedCallback() {
        for (const [key, value] of Object.entries(attrs)) {
          this.setAttribute(key, value)
        }
      }
    },
  )
}

// FUNCTIONS

const NODE_TYPE_ELEMENT = 1

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

function dispatchNavEvent(url: FullSlug) {
  const event: CustomEventMap["nav"] = new CustomEvent("nav", { detail: { url } })
  document.dispatchEvent(event)
}

function scrollToHash(hash: string) {
  if (!hash) return
  try {
    const el = document.getElementById(decodeURIComponent(hash.substring(1)))
    if (!el) return
    el.scrollIntoView({ behavior: "instant" })
  } catch {
    // Ignore malformed URI
  }
}

/**
 * Fetches page content and updates the DOM, head, title, etc.
 */
async function updatePage(html: Document, url: URL): Promise<void> {
  normalizeRelativeURLs(html, url)

  let title = html.querySelector("title")?.textContent
  if (title) {
    document.title = title
  } else {
    const h1 = document.querySelector("h1")
    title = h1?.innerText ?? h1?.textContent ?? url.pathname
  }

  if (announcer.textContent !== title) {
    announcer.textContent = title
  }
  announcer.dataset.persist = ""
  // Append announcer to the *new* body before morph
  // micromorph will merge it into the existing DOM structure
  html.body.appendChild(announcer)

  // Clean up potential extension-injected siblings around the video
  const videoElement = document.getElementById(pondVideoId)
  if (videoElement && videoElement.parentElement) {
    const parent = videoElement.parentElement
    Array.from(parent.childNodes).forEach((node) => {
      if (node !== videoElement) {
        parent.removeChild(node)
      }
    })
  }

  console.debug(`[updatePage] Starting micromorph for ${url.pathname}`)
  try {
    await micromorph(document.body, html.body)
    console.debug(`[updatePage] Micromorph finished for ${url.pathname}`)
  } catch (e) {
    console.error(`[updatePage] Micromorph error for ${url.pathname}:`, e)
  }

  // Patch head
  const elementsToRemove = document.head.querySelectorAll(":not([spa-preserve])")
  elementsToRemove.forEach((el) => el.remove())
  const elementsToAdd = html.head.querySelectorAll(":not([spa-preserve])")
  elementsToAdd.forEach((el) => document.head.appendChild(el.cloneNode(true)))
}

interface FetchResult {
  status: "success" | "error" | "fallback"
  content?: string
  finalUrl: URL
  responseStatus?: number
  contentType?: string | null
}

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
      console.warn(
        `[fetchContent] Fetch failed or non-HTML. Status: ${responseStatus}, Type: ${contentType}. Triggering fallback.`,
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

  if (match && match[1]) {
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

/**
 * Handles navigation triggered by clicking a link or programmatic call.
 * Fetches new content, updates history, updates DOM, and handles scrolling.
 */
async function navigate(url: URL, opts?: { scroll?: boolean }): Promise<void> {
  removePopovers()

  // Store the current scroll position *before* fetching/navigating
  const currentScroll = getScrollPosition()
  const state = { scroll: currentScroll }

  // 1. Fetch content, handling redirects
  const fetchResult = await fetchAndProcessContent(url)
  if (!fetchResult) {
    // Fetching or redirect handling failed and triggered a fallback (full page load)
    return
  }
  const { content, finalUrl } = fetchResult

  // 2. Push state *before* updating page
  //    Original URL ensures the browser's address bar reflects the URL the user intended to navigate to.
  console.debug(
    `[navigate] pushState scroll: ${currentScroll}, state obj:`,
    state,
    ` for original URL: ${url.toString()}`,
  )
  history.pushState(state, "", url)

  // 3. Parse and update the DOM
  //    Pass original URL to resolve relative paths in the fetched content against the intended URL.
  const updateSuccess = await updateDOM(content, url)
  if (!updateSuccess) {
    // DOM update failed and triggered a fallback (full page load)
    return
  }

  // 4. Handle scrolling *after* DOM update, based on the FINAL URL
  handleNavigationScroll(finalUrl, opts)

  // 5. Notify other components of navigation
  dispatchNavEvent(getFullSlug(window))
}
window.spaNavigate = navigate

/**
 * Handles the popstate event triggered by browser back/forward buttons.
 * Fetches content for the target URL, updates DOM, and restores scroll position from state.
 */
async function handlePopstate(event: PopStateEvent): Promise<void> {
  const targetUrl = new URL(window.location.toString())
  console.debug(
    `[handlePopstate] Navigating to ${targetUrl.pathname}, received state:`,
    event.state,
  )

  const resource = await fetch(targetUrl.toString())
  const contentType = resource.headers.get("content-type")
  if (!resource.ok || !contentType?.startsWith("text/html")) {
    window.location.reload()
    console.debug("popstate: Reloading due to non-HTML response")
    return
  }

  // Update DOM and head
  const contents = await resource.text()
  parser = parser || new DOMParser()
  const html = parser.parseFromString(contents, "text/html")
  await updatePage(html, targetUrl)

  // Restore scroll position *after* DOM update
  const scrollTarget = event.state?.scroll as number | undefined
  try {
    if (typeof scrollTarget === "number") {
      console.debug(`[handlePopstate] Restoring scroll from state: ${scrollTarget}`)
      window.scrollTo({ top: scrollTarget, behavior: "instant" })
    } else if (targetUrl.hash) {
      console.debug(`[handlePopstate] Scrolling to hash: ${targetUrl.hash}`)
      scrollToHash(targetUrl.hash)
    } else {
      console.debug("popstate: Scrolling to top (no state/hash)")
      window.scrollTo({ top: 0, behavior: "instant" })
    }
  } catch (error) {
    console.error("Popstate navigation error:", error)
    window.location.reload()
    return
  }
  dispatchNavEvent(getFullSlug(window))
}

/**
 * Creates and configures the router instance
 * - Sets up click event listeners for link interception
 * - Handles browser back/forward navigation (popstate)
 * - Sets up manual scroll restoration and state saving
 */
function createRouter() {
  if (typeof window !== "undefined" && !window.__routerInitialized) {
    window.__routerInitialized = true

    // Setup manual scroll restoration and state saving
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual"

      window.addEventListener("scroll", () => {
        console.debug("Scroll event fired")
        updateScrollState()
      })
      console.debug("Manual scroll restoration enabled.")
    } else {
      console.warn("Manual scroll restoration not supported.")
    }

    document.addEventListener("click", async (event) => {
      // Use getOpts to check for valid local links ignoring modifiers/targets
      const opts = getOpts(event)
      if (!opts || !opts.url || (event as MouseEvent).ctrlKey || (event as MouseEvent).metaKey) {
        return // Let browser handle normal links, external links, or modified clicks
      }

      event.preventDefault() // Prevent default link behavior

      try {
        console.debug(`[Router] Click navigation to ${opts.url.toString()}`)
        // Pass scroll option from dataset (e.g., data-router-no-scroll)
        await navigate(opts.url, { scroll: opts.scroll })
      } catch (e) {
        console.error("Click navigation error:", e)
        // Fallback to standard navigation if spa navigation fails
        window.location.assign(opts.url)
      }
    })

    // Add popstate listener for back/forward navigation
    window.addEventListener("popstate", handlePopstate)

    // Handle hash scrolling on initial page load, unless scroll will be restored from history
    if (window.location.hash && typeof history.state?.scroll !== "number") {
      console.debug("Initial load: Scrolling to hash")
      scrollToHash(window.location.hash)
    }
  }
}
