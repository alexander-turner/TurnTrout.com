import { popoverScrollOffset } from "../constants"
import {
  setPopoverPosition,
  attachPopoverEventListeners,
  PopoverOptions,
  escapeLeadingIdNumber,
  createPopover,
  footnoteForwardRefRegex,
} from "./popover_helpers"

// Module-level state
let activePopoverRemover: (() => void) | null = null
let pendingPopoverTimer: number | null = null
let linkListenerController: AbortController | null = null
// When true, the next popover created by mouseEnterHandler will be pinned
// (persist until explicitly closed via X or Escape). Set by click handlers.
let nextPopoverPinned = false
// Generation counter to detect stale async calls to mouseEnterHandler.
// Incremented synchronously at call start; checked after await to bail
// out if a newer call has started.
let popoverGeneration = 0

/**
 * Handles the mouse enter event for link elements
 */
async function mouseEnterHandler(this: HTMLLinkElement) {
  const parentOfPopover = document.getElementById("quartz-root")
  if (!parentOfPopover || this.dataset.noPopover === "true") {
    return
  }

  // Capture state synchronously before the await so concurrent calls
  // don't share or leak the pinned flag across popovers.
  const shouldPin = nextPopoverPinned
  nextPopoverPinned = false
  const thisGeneration = ++popoverGeneration

  const thisUrl = new URL(document.location.href)
  thisUrl.hash = ""
  thisUrl.search = ""
  const targetUrl = new URL(this.href)
  let hash = targetUrl.hash
  targetUrl.hash = ""
  targetUrl.search = ""

  const popoverOptions: PopoverOptions = {
    parentElement: parentOfPopover,
    targetUrl,
    linkElement: this,
  }

  const popoverElement = await createPopover(popoverOptions)

  // A newer call to mouseEnterHandler started while we were fetching —
  // discard this stale popover so we don't end up with duplicates.
  if (thisGeneration !== popoverGeneration) {
    return
  }

  if (!popoverElement) {
    throw new Error("Failed to create popover")
  }
  // Used by the click toggle logic to detect "is this popover already open for this link?"
  popoverElement.dataset.linkHref = this.href

  if (shouldPin) {
    popoverElement.dataset.pinned = "true"
  }

  parentOfPopover.prepend(popoverElement)

  const updatePosition = () => {
    setPopoverPosition(popoverElement, this)
  }

  updatePosition()

  // Pinned popovers persist through scroll (dismissed only via X or Escape);
  // unpinned (hover-triggered) popovers close on scroll since they're ephemeral.
  const handleScroll = () => {
    if (activePopoverRemover && !popoverElement.dataset.pinned) {
      activePopoverRemover()
    }
  }

  const onPopoverRemove = () => {
    activePopoverRemover = null
    window.removeEventListener("resize", updatePosition)
    window.removeEventListener("scroll", handleScroll)
  }

  const popoverCleanup = attachPopoverEventListeners(popoverElement, this, onPopoverRemove)
  activePopoverRemover = popoverCleanup

  window.addEventListener("resize", updatePosition)
  window.addEventListener("scroll", handleScroll)

  // skipcq: JS-0098 - Force reflow to ensure CSS transition
  void popoverElement.offsetWidth

  popoverElement.classList.add("popover-visible")

  // Wire up close button for footnote popovers
  const closeBtn = popoverElement.querySelector(".popover-close")
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      if (activePopoverRemover) {
        activePopoverRemover()
      }
    })
  }

  // Handle hash scrolling
  if (hash !== "") {
    hash = `${hash}-popover`
    hash = escapeLeadingIdNumber(hash)
    const heading = popoverElement.querySelector(hash) as HTMLElement | null
    if (heading) {
      const popoverInner = popoverElement.querySelector(".popover-inner") as HTMLElement

      // Need to scroll the inner container
      popoverInner.scroll({ top: heading.offsetTop - popoverScrollOffset, behavior: "instant" })
    }
  }
}

document.addEventListener("nav", () => {
  // On page navigation, clean up any existing popovers and timers
  if (activePopoverRemover) {
    activePopoverRemover()
  }
  // and pending popovers
  if (pendingPopoverTimer) {
    clearTimeout(pendingPopoverTimer)
    pendingPopoverTimer = null
  }

  // Abort previous link listeners to prevent accumulation on morphed-in-place elements
  if (linkListenerController) {
    linkListenerController.abort()
  }
  linkListenerController = new AbortController()
  const { signal } = linkListenerController

  // Close pinned popovers on Escape key
  document.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && activePopoverRemover) {
        const popover = document.querySelector(".popover") as HTMLElement | null
        if (popover?.dataset.pinned) {
          activePopoverRemover()
        }
      }
    },
    { signal },
  )

  // Click outside dismisses footnote popovers
  document.addEventListener(
    "click",
    (e: MouseEvent) => {
      const popover = document.querySelector(".popover.footnote-popover") as HTMLElement | null
      if (!popover || !activePopoverRemover) return

      const target = e.target as HTMLElement
      if (popover.contains(target)) return

      activePopoverRemover()
    },
    { signal },
  )

  // Re-attach event listeners to all links that can trigger a popover
  const links = [...document.getElementsByClassName("can-trigger-popover")] as HTMLLinkElement[]
  for (const link of links) {
    const href = link.getAttribute("href") || ""
    const isFootnoteLink = footnoteForwardRefRegex.test(href)

    // Footnote links are click-only: no hover listeners
    if (!isFootnoteLink) {
      const handleMouseEnter = () => {
        // Clear any pending timer to show a popover for another link
        if (pendingPopoverTimer) {
          clearTimeout(pendingPopoverTimer)
          pendingPopoverTimer = null
        }

        // Don't do anything if hovering over the link for the currently visible popover
        const existingPopover = document.querySelector(".popover") as HTMLElement | null
        if (existingPopover && existingPopover.dataset.linkHref === link.href) {
          return
        }

        pendingPopoverTimer = window.setTimeout(() => {
          // Don't let hover replace a pinned (click-triggered) popover
          const currentPopover = document.querySelector(".popover") as HTMLElement | null
          if (currentPopover?.dataset.pinned) {
            pendingPopoverTimer = null
            return
          }

          if (activePopoverRemover) {
            activePopoverRemover()
          }
          mouseEnterHandler.call(link) // Show the new popover
          pendingPopoverTimer = null
        }, 300)
      }

      const handleMouseLeave = () => {
        if (pendingPopoverTimer) {
          clearTimeout(pendingPopoverTimer)
          pendingPopoverTimer = null
        }
      }

      link.addEventListener("mouseenter", handleMouseEnter, { signal })
      link.addEventListener("mouseleave", handleMouseLeave, { signal })
    }

    // Click toggle for footnote reference links
    if (isFootnoteLink) {
      link.addEventListener(
        "click",
        (e: MouseEvent) => {
          e.preventDefault()
          // Stop propagation so the SPA router's document-level click handler
          // doesn't intercept this and navigate to the hash (which scrolls the
          // page and dispatches a nav event that would clean up the popover).
          // Also prevents the click-outside handler from immediately closing.
          e.stopPropagation()

          // Toggle: if popover for this link is already showing, close it
          const existingPopover = document.querySelector(".popover") as HTMLElement | null
          if (existingPopover && existingPopover.dataset.linkHref === link.href) {
            if (activePopoverRemover) {
              activePopoverRemover()
            }
            return
          }

          // Close any existing popover and show new one
          if (activePopoverRemover) {
            activePopoverRemover()
          }
          nextPopoverPinned = true
          mouseEnterHandler.call(link)
        },
        { signal },
      )
    }
  }
})
