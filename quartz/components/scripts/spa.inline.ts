// SPA Inline Module
// Handles navigation between pages without full page reloads

// @ts-expect-error: micromorph types not properly exported with bundler resolution
import micromorph from "micromorph"
import { escape } from "validator"

import { type FullSlug, getFullSlug, normalizeRelativeURLs } from "../../util/path"
import {
  simpleConstants,
  debounceWaitMs,
  instantScrollRestoreKey,
  sessionStoragePondVideoKey,
} from "../constants"
import { debounce } from "./component_script_utils"
import { isPrinting } from "./printState"
import {
  extractMetaRefreshUrl,
  getNavigationOpts,
  handleNavigationScroll,
  saveScrollToLocalStorage,
  scrollToUrlTarget,
  updateHeadElements,
} from "./spa_utils"

const { pondVideoId, spaFetchTimeoutMs } = simpleConstants

// SPA accessibility announcement for screen readers
const announcer = document.createElement("route-announcer")

declare global {
  interface Window {
    __routerInitialized?: boolean
    spaNavigate: (url: URL, opts?: { scroll?: boolean; fetch?: boolean }) => Promise<void>
  }
}

// FUNCTIONS

/**
 * Returns the current scroll position as an integer.
 */
function getScrollPosition(): number {
  return Math.round(window.scrollY)
}

const updateScrollState = debounce(
  (() => {
    if (isPrinting()) return

    const currentScroll = getScrollPosition()
    console.debug(
      `[updateScrollState] replaceState scroll: ${currentScroll}, current state:`,
      history.state,
    )
    history.replaceState({ ...history.state, scroll: currentScroll }, "")

    // Firefox fallback: also save to sessionStorage for reload cases
    if (typeof Storage !== "undefined") {
      sessionStorage.setItem(instantScrollRestoreKey, currentScroll.toString())
    }

    // Persist to localStorage for cross-session restoration
    saveScrollToLocalStorage(window.location.pathname, currentScroll)
  }) as () => void,
  debounceWaitMs,
)

/** Dispatches the `nav` CustomEvent so listeners can react to client-side navigation. */
function dispatchNavEvent(url: FullSlug) {
  const event: CustomEventMap["nav"] = new CustomEvent("nav", { detail: { url } })
  document.dispatchEvent(event)
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

  // Clean up non-video siblings in both old and new containers so micromorph
  // compares them positionally as [video] vs [video] → MODIFY (preserves the
  // existing loaded element).  Without this, whitespace text nodes or
  // extension-injected elements cause a position mismatch that REPLACEs the
  // video, losing its readyState/currentTime.
  const videoElement = document.getElementById(pondVideoId)
  if (videoElement?.parentElement) {
    const containerId = videoElement.parentElement.id
    for (const root of [document, html]) {
      const container = root.getElementById(containerId)
      const video = container?.querySelector(`#${pondVideoId}`)
      if (container && video) {
        Array.from(container.childNodes).forEach((node) => {
          if (node !== video) container.removeChild(node)
        })
      }
    }
  }

  console.debug(`[updatePage] Starting DOM update for ${url.pathname}`)
  try {
    // Only morph the body to preserve spa-preserve elements in head
    await micromorph(document.body, html.body)
    // Update head elements AFTER morphing to ensure browser recognizes changes
    // This is especially important for Safari/Firefox which cache head state
    updateHeadElements(html)
    console.debug(`[updatePage] DOM update finished for ${url.pathname}`)
  } catch (e) {
    console.error(`[updatePage] DOM update error for ${url.pathname}:`, e)
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

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), spaFetchTimeoutMs)

  try {
    const res = await fetch(url.toString(), { signal: controller.signal })
    clearTimeout(timeoutId)
    responseStatus = res.status
    const contentType = res.headers.get("content-type")

    if (res.ok && contentType?.startsWith("text/html")) {
      const content = await res.text()
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
    clearTimeout(timeoutId)
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

  const redirectTargetRaw = extractMetaRefreshUrl(initialContent)
  if (redirectTargetRaw) {
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

/** Removes any rendered popover elements from the page. */
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

let lastKnownPathname = window.location.pathname
/**
 * Handles navigation triggered by clicking a link or programmatic call.
 * Updates history, maybe fetches new content, updates DOM, and handles scrolling.
 */
async function navigate(url: URL, opts?: { scroll?: boolean; fetch?: boolean }): Promise<void> {
  removePopovers()

  // Save video timestamp before DOM morph so it survives navigation.
  // The timeupdate listener in navbar.inline.ts saves periodically, but if the
  // video is paused the last saved value may be stale.
  const videoElement = document.getElementById(pondVideoId) as HTMLVideoElement | null
  if (videoElement) {
    sessionStorage.setItem(sessionStoragePondVideoKey, videoElement.currentTime.toString())
  }

  // 1. Persist the current scroll position in the *existing* history entry so that
  // navigating back restores the correct position (e.g., top-of-page before an
  // in-page anchor navigation).
  const currentScroll = getScrollPosition()
  history.replaceState({ ...history.state, scroll: currentScroll }, "")

  // Firefox fallback: also save to sessionStorage for reload cases
  if (typeof Storage !== "undefined") {
    sessionStorage.setItem(instantScrollRestoreKey, currentScroll.toString())
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

    // Safari/WebKit fires its own native hash-scroll after our restoration when
    // the URL contains a hash, overriding the saved position. Monitor for drift
    // and re-apply for several frames to win the race.
    if (targetUrl.hash) {
      guardScrollAgainstHashDrift(scrollTarget)
    }
  } else if (targetUrl.hash) {
    console.debug(`[restoreScrollPosition] Scrolling to hash: ${targetUrl.hash}`)
    scrollToUrlTarget(targetUrl.hash)
  }
}

/**
 * Monitors scroll position for a number of frames and corrects any drift caused
 * by the browser's native hash-scroll overriding our programmatic restoration.
 * Cancels immediately if the user interacts (wheel/touch/pointer/key).
 */
function guardScrollAgainstHashDrift(targetPos: number): void {
  let frameCount = 0
  const MAX_FRAMES = 60
  let cancelled = false

  const cancelEvents = ["wheel", "touchstart", "pointerdown", "keydown"] as const

  const cancel = () => {
    cancelled = true
    for (const event of cancelEvents) {
      window.removeEventListener(event, cancel)
    }
  }
  for (const event of cancelEvents) {
    window.addEventListener(event, cancel, { passive: true, once: true })
  }

  const monitor = () => {
    if (cancelled || frameCount >= MAX_FRAMES) {
      cancel()
      return
    }
    if (Math.abs(window.scrollY - targetPos) > 2) {
      window.scrollTo({ top: targetPos, behavior: "instant" })
    }
    frameCount++
    requestAnimationFrame(monitor)
  }
  requestAnimationFrame(monitor)
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
    window.addEventListener(
      "scroll",
      () => {
        if (isPrinting()) return
        console.debug("Scroll event fired")
        updateScrollState()
      },
      { passive: true },
    )

    document.addEventListener("click", async (event) => {
      // Use getNavigationOpts to check for valid local links ignoring modifiers/targets
      const opts = getNavigationOpts(event)
      if (
        !opts ||
        !opts.url ||
        event.defaultPrevented ||
        (event as MouseEvent).ctrlKey ||
        (event as MouseEvent).metaKey
      ) {
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

    window.__routerInitialized = true
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
      /** Applies the visually-hidden ARIA-live attributes when the announcer mounts. */
      connectedCallback() {
        for (const [key, value] of Object.entries(attrs)) {
          this.setAttribute(key, value)
        }
      }
    },
  )
}
