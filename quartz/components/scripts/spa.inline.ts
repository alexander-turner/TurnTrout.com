// This file implements a client-side router for Single Page Applications (SPA)
// It handles navigation between pages without full page reloads

import micromorph from "micromorph"

import {
  type FullSlug,
  type RelativeURL,
  getFullSlug,
  normalizeRelativeURLs,
} from "../../util/path"
import { videoId, sessionStoragePondVideoKey } from "../component_utils"

declare global {
  interface Window {
    __routerInitialized?: boolean
  }
}

// adapted from `micromorph`
// https://github.com/natemoo-re/micromorph
const NODE_TYPE_ELEMENT = 1
const announcer = document.createElement("route-announcer")

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

function saveVideoTimestamp() {
  const video = document.getElementById("pond-video") as HTMLVideoElement | null
  if (video) {
    sessionStorage.setItem(sessionStoragePondVideoKey, String(video.currentTime))
  }
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

  // Clean up potential extension-injected siblings around the video
  // Prevents reloading the video when navigating between pages
  const videoElement = document.getElementById(videoId)
  if (videoElement && videoElement.parentElement) {
    const parent = videoElement.parentElement
    Array.from(parent.childNodes).forEach((node) => {
      if (node !== videoElement) {
        parent.removeChild(node)
      }
    })
  }

  // Morph body
  await micromorph(document.body, html.body)

  // Patch head
  const elementsToRemove = document.head.querySelectorAll(":not([spa-preserve])")
  elementsToRemove.forEach((el) => el.remove())
  const elementsToAdd = html.head.querySelectorAll(":not([spa-preserve])")
  elementsToAdd.forEach((el) => document.head.appendChild(el.cloneNode(true)))

  // Handle scroll behavior based on navigation type
  const isSamePageNavigation = url.pathname === window.location.pathname
  if (isSamePageNavigation && url.hash) {
    // For same-page anchor navigation, scroll to the target element
    const el = document.getElementById(decodeURIComponent(url.hash.substring(1)))
    el?.scrollIntoView({ behavior: "smooth" })
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
        saveVideoTimestamp()

        // Push state here before navigation
        const state = {
          hash: url.hash,
          pathname: url.pathname,
          timestamp: Date.now(),
        }
        window.history.pushState(state, document.title, url.toString())

        // Then navigate to update content
        await navigate(url)
      } catch {
        window.location.assign(url)
      }
    })

    window.addEventListener("popstate", async () => {
      try {
        saveVideoTimestamp()

        // Navigate to update the content
        await navigate(new URL(window.location.toString()))
      } catch (error) {
        console.error("Navigation error:", error)
        window.location.reload()
      }
    })

    // Handle hash-based scrolling on initial load
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
  // Set scroll restoration to auto to use browser's native behavior
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "auto"
  }

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
