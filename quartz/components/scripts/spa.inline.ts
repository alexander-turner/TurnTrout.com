// This file implements a client-side router for Single Page Applications (SPA)
// It handles navigation between pages without full page reloads

import micromorph from "micromorph"

import {
  type FullSlug,
  type RelativeURL,
  getFullSlug,
  normalizeRelativeURLs,
} from "../../util/path"

declare global {
  interface Window {
    __hasRemovedCriticalCSS?: boolean
    __routerInitialized?: boolean
  }
}

// adapted from `micromorph`
// https://github.com/natemoo-re/micromorph
const NODE_TYPE_ELEMENT = 1
const announcer = document.createElement("route-announcer")

// TODO test
function locationToStorageKey(location: Location) {
  // Remove hash from location
  const url = new URL(location.toString())
  url.hash = ""
  return `scrollPos:${url.toString()}`
}

// Override browser's native scroll restoration
// This allows the page to restore the previous scroll position on refresh
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual"
  const key = locationToStorageKey(window.location)
  const savedScroll = sessionStorage.getItem(key)

  // Only restore scroll if there's no hash in the URL
  if (savedScroll && !window.location.hash) {
    window.scrollTo({ top: parseInt(savedScroll), behavior: "instant" })
    // Clean up immediately after restoring
    sessionStorage.removeItem(key)
  }
}

/**
 * Type guard to check if a target is an Element
 */
const isElement = (target: EventTarget | null): target is Element =>
  (target as Node)?.nodeType === NODE_TYPE_ELEMENT

// TODO split off into a separate file to test
/**
 * Checks if a URL is local (same origin as current window)
 */
const isLocalUrl = (href: string): boolean => {
  try {
    const url = new URL(href)
    if (window.location.origin === url.origin) {
      return true
    }
  } catch {
    // ignore
  }
  return false
}

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

/**
 * Saves the current scroll position to session storage
 */
function saveScrollPosition(): void {
  const scrollPos = Math.round(window.scrollY)
  const key = locationToStorageKey(window.location)
  console.debug(`Saving scroll position: ${scrollPos} for ${key}`)
  sessionStorage.setItem(key, scrollPos.toString())
}

let parser: DOMParser
/**
 * Core navigation function that:
 * 1. Fetches new page content
 * 2. Updates the DOM using micromorph
 * 3. Handles scroll position
 * 4. Updates browser history
 * 5. Manages page title and announcements
 */
async function navigate(url: URL) {
  parser = parser || new DOMParser()

  // Clean up any existing popovers
  const existingPopovers = document.querySelectorAll(".popover")
  existingPopovers.forEach((popover) => popover.remove())

  // TODO test
  saveScrollPosition()

  // TODO test
  // Don't push to history if it's just a hash change on the same page
  const isSamePageAnchor =
    url.pathname === window.location.pathname && url.hash !== window.location.hash

  if (!isSamePageAnchor) {
    history.pushState({}, "", url)
  } else {
    // Update URL without pushing to history for anchor changes
    history.replaceState({}, "", url)
  }

  let contents: string | undefined

  try {
    const res = await fetch(url.toString())
    const contentType = res.headers.get("content-type")
    if (contentType?.startsWith("text/html")) {
      contents = await res.text()
    } else {
      window.location.href = url.toString()
      return
    }
  } catch {
    window.location.href = url.toString()
    return
  }

  if (!contents) return

  const html = parser.parseFromString(contents, "text/html")
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
  html.body.appendChild(announcer)

  // Morph body
  await micromorph(document.body, html.body)

  // Patch head
  const elementsToRemove = document.head.querySelectorAll(":not([spa-preserve])")
  elementsToRemove.forEach((el) => el.remove())
  const elementsToAdd = html.head.querySelectorAll(":not([spa-preserve])")
  elementsToAdd.forEach((el) => document.head.appendChild(el.cloneNode(true)))

  // Scroll to the anchor AFTER the content has been updated
  if (url.hash) {
    scrollToHash(url.hash)
  }

  // Smooth scroll for anchors; else jump instantly
  const isSamePageNavigation = url.pathname === window.location.pathname
  if (isSamePageNavigation && url.hash) {
    // Normal anchor link behavior
    const el = document.getElementById(decodeURIComponent(url.hash.substring(1)))
    el?.scrollIntoView({ behavior: "smooth" })
  } else {
    // Restore scroll position on back navigation
    const key = locationToStorageKey(window.location)
    const savedScroll = sessionStorage.getItem(key)
    // Go to 0 if no scroll position is saved
    window.scrollTo({
      top: savedScroll ? parseInt(savedScroll) : 0,
      behavior: "instant",
    })
  }

  notifyNav(getFullSlug(window))
}

window.spaNavigate = navigate
/**
 * Creates and configures the router instance
 * - Sets up click event listeners for link interception
 * - Handles browser back/forward navigation
 * - Provides programmatic navigation methods (go, back, forward)
 */
function createRouter() {
  if (typeof window !== "undefined" && !window.__routerInitialized) {
    window.__routerInitialized = true

    document.addEventListener("click", async (event) => {
      const { url } = getOpts(event) ?? {}
      // dont hijack behaviour, just let browser act normally
      if (!url || (event as MouseEvent).ctrlKey || (event as MouseEvent).metaKey) return
      event.preventDefault()

      try {
        await navigate(url)
      } catch {
        window.location.assign(url)
      }
    })
    window.addEventListener("popstate", async () => {
      try {
        console.info("popstate", window.location.toString())
        // Get the scroll position before navigation
        const key = locationToStorageKey(window.location)
        const savedScroll = sessionStorage.getItem(key)

        // First navigate to update the content
        await navigate(new URL(window.location.toString()))

        // Then restore scroll position after content is updated
        if (savedScroll) {
          window.scrollTo({ top: parseInt(savedScroll), behavior: "instant" })
          sessionStorage.removeItem(key)
        }
      } catch (error) {
        console.error("Navigation error:", error)
        window.location.reload()
      }
    })

    // Remove the load event listener and just call scrollToHash directly
    if (window.location.hash) {
      scrollToHash(window.location.hash)
    }
  }

  return {
    go(pathname: RelativeURL) {
      const url = new URL(pathname, window.location.toString())
      return navigate(url)
    },
    back() {
      return window.history.back()
    },
    forward() {
      return window.history.forward()
    },
  }
}

// Only initialize if not already done
if (typeof window !== "undefined" && !window.__routerInitialized) {
  // Restore scroll only once
  setupScrollRestoration()

  // Proceed with creating the router
  createRouter()
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

function setupScrollRestoration(): void {
  // Only run this logic if "scrollRestoration" is supported and we haven't done it already.
  if ("scrollRestoration" in history && !window.__hasRemovedCriticalCSS) {
    // Mark that we've run this setup so it doesn't happen again
    window.__hasRemovedCriticalCSS = true
    history.scrollRestoration = "manual"

    // Wait for network idle (when all resources are loaded)
    if (document.readyState === "complete") {
      restoreScroll()
    } else {
      window.addEventListener("networkidle", restoreScroll)
    }

    window.addEventListener("beforeunload", saveScrollPosition)
  }
}

function restoreScroll(): void {
  const key = locationToStorageKey(window.location)
  const savedScroll = sessionStorage.getItem(key)

  if (savedScroll && !window.location.hash) {
    const scrollPos = parseInt(savedScroll, 10)
    console.warn(`Restoring scroll position: ${scrollPos} for ${key}`)
    window.scrollTo({ top: scrollPos, behavior: "instant" })
    // Clear the saved position immediately after restoring
    sessionStorage.removeItem(key)
  }
}
