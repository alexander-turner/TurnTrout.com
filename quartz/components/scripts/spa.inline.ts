// This file implements a client-side router for Single Page Applications (SPA)
// It handles navigation between pages without full page reloads

import micromorph from "micromorph"

import {
  type FullSlug,
  type RelativeURL,
  getFullSlug,
  normalizeRelativeURLs,
} from "../../util/path"
import { videoId } from "../component_utils"
import { debounce } from "./component_script_utils"
import { isLocalUrl } from "./spa_utils"

declare global {
  interface Window {
    __routerInitialized?: boolean
    spaNavigate: (url: URL, opts?: { scroll?: boolean }) => Promise<void>
  }
}

const NODE_TYPE_ELEMENT = 1
const announcer = document.createElement("route-announcer")

function getScrollPosition(): number {
  return Math.round(window.scrollY)
}

// Debounced function to update scroll state in history
const updateScrollState = debounce(
  (() => {
    const currentScroll = getScrollPosition()
    // Add logging for replaceState
    console.debug(
      `[updateScrollState] replaceState scroll: ${currentScroll}, current state:`,
      history.state,
    )
    history.replaceState({ ...history.state, scroll: currentScroll }, "")
  }) as () => void,
  100,
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

/**
 * Dispatches a custom navigation event
 */
function notifyNav(url: FullSlug) {
  const event: CustomEventMap["nav"] = new CustomEvent("nav", { detail: { url } })
  document.dispatchEvent(event)
}

/**
 * Handles scrolling to specific elements when hash is present in URL
 */
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

let parser: DOMParser

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
  const videoElement = document.getElementById(videoId)
  if (videoElement && videoElement.parentElement) {
    const parent = videoElement.parentElement
    Array.from(parent.childNodes).forEach((node) => {
      if (node !== videoElement) {
        parent.removeChild(node)
      }
    })
  }

  await micromorph(document.body, html.body)

  // Patch head
  const elementsToRemove = document.head.querySelectorAll(":not([spa-preserve])")
  elementsToRemove.forEach((el) => el.remove())
  const elementsToAdd = html.head.querySelectorAll(":not([spa-preserve])")
  elementsToAdd.forEach((el) => document.head.appendChild(el.cloneNode(true)))
}

/**
 * Handles navigation triggered by clicking a link.
 * Fetches new content, updates history, updates DOM, and handles scrolling.
 */
async function navigate(url: URL, opts?: { scroll?: boolean }): Promise<void> {
  parser = parser || new DOMParser()

  // Clean up any existing popovers
  const existingPopovers = document.querySelectorAll(".popover")
  existingPopovers.forEach((popover) => popover.remove())

  // Store the current scroll position in history state *before* navigating
  const currentScroll = getScrollPosition()
  // Remove unused state properties hash/pathname
  const state = { scroll: currentScroll }

  let contents: string | undefined
  try {
    const res = await fetch(url.toString())
    const contentType = res.headers.get("content-type")
    if (contentType?.startsWith("text/html")) {
      contents = await res.text()
    } else {
      // Non-HTML response, fallback to full page load
      window.location.href = url.toString()
      return
    }
  } catch (e) {
    console.error("Fetch error:", e)
    // Network error, fallback to full page load
    window.location.href = url.toString()
    return
  }

  if (!contents) return

  // Push state *before* updating page to associate state with the *new* URL
  // Add logging for pushState
  console.debug(`[navigate] pushState scroll: ${currentScroll}, state obj:`, state)
  history.pushState(state, "", url)

  const html = parser.parseFromString(contents, "text/html")
  await updatePage(html, url)

  // Handle scrolling *after* DOM update
  if (opts?.scroll === false) {
    // explicitly skip scroll
    console.debug("Skipping scroll restoration due to data-router-no-scroll")
  } else if (url.hash) {
    console.debug(`Scrolling to hash: ${url.hash}`)
    scrollToHash(url.hash)
  } else {
    console.debug("Scrolling to top")
    window.scrollTo({ top: 0, behavior: "instant" })
  }

  notifyNav(getFullSlug(window))
}
window.spaNavigate = navigate

/**
 * Handles the popstate event triggered by browser back/forward buttons.
 * Fetches content for the target URL, updates DOM, and restores scroll position from state.
 */
async function handlePopstate(event: PopStateEvent): Promise<void> {
  parser = parser || new DOMParser()

  const targetUrl = new URL(window.location.toString())
  // Add logging for received popstate event state
  console.debug(
    `[handlePopstate] Navigating to ${targetUrl.pathname}, received state:`,
    event.state,
  )

  try {
    const res = await fetch(targetUrl.toString())
    const contentType = res.headers.get("content-type")
    if (!res.ok || !contentType?.startsWith("text/html")) {
      // If fetch fails or not HTML, trigger full page load
      window.location.reload()
      return
    }
    const contents = await res.text()
    const html = parser.parseFromString(contents, "text/html")

    // Update DOM and head
    await updatePage(html, targetUrl)

    // Restore scroll position *after* DOM update
    const scrollTarget = event.state?.scroll as number | undefined
    if (typeof scrollTarget === "number") {
      // Add logging for popstate scroll restoration
      console.debug(`[handlePopstate] Restoring scroll from state: ${scrollTarget}`)
      window.scrollTo({ top: scrollTarget, behavior: "instant" })
    } else if (targetUrl.hash) {
      console.debug(`[handlePopstate] Scrolling to hash: ${targetUrl.hash}`)
      scrollToHash(targetUrl.hash)
    } else {
      console.debug("popstate: Scrolling to top (no state/hash)")
      window.scrollTo({ top: 0, behavior: "instant" })
    }

    notifyNav(getFullSlug(window))
  } catch (error) {
    console.error("Popstate navigation error:", error)
    // Fallback to full reload on error
    window.location.reload()
  }
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
      // Add listener to update scroll state in history during user scrolling
      window.addEventListener("scroll", updateScrollState)
      console.debug("Manual scroll restoration enabled.")
    } else {
      console.warn("Manual scroll restoration not supported.")
    }

    // Add click listener for SPA navigation
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

    // Handle hash scrolling on initial page load
    if (window.location.hash) {
      // Needs slight delay for elements to be ready after initial render
      setTimeout(() => scrollToHash(window.location.hash), 0)
    }
  }

  // Return router API (optional, kept for potential future use)
  return {
    // The main navigation is now spaNavigate attached to window
    go(pathname: RelativeURL) {
      const url = new URL(pathname, window.location.toString())
      return window.spaNavigate(url) // Use the global navigate function
    },
    back() {
      return window.history.back()
    },
    forward() {
      return window.history.forward()
    },
  }
}

if (typeof window !== "undefined" && !window.__routerInitialized) {
  createRouter()

  // Restore scroll position on initial load/reload if available in state
  // Do this *before* potentially scrolling to a hash
  // Add logging for initial state check
  console.debug(`[Initial Load] Checking history state:`, history.state)
  const initialScroll = history.state?.scroll as number | undefined
  if (typeof initialScroll === "number") {
    // Add logging for initial scroll restoration
    console.debug(`[Initial Load] Restoring scroll from state: ${initialScroll}`)
    window.scrollTo({ top: initialScroll, behavior: "instant" })
  } else if (window.location.hash) {
    // Fallback to hash scrolling if no state scroll is found
    console.debug(`Initial load: Scrolling to hash: ${window.location.hash}`)
    // Needs slight delay for elements to be ready after initial render
    setTimeout(() => scrollToHash(window.location.hash), 0)
  }

  notifyNav(getFullSlug(window))
}

/**
 * Registers the RouteAnnouncer custom element if not already defined
 * Sets up necessary ARIA attributes and styling for accessibility
 */
if (!customElements.get("route-announcer")) {
  const attrs = {
    "aria-live": "assertive",
    "aria-atomic": "true",
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
