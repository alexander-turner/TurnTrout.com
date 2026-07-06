import { CAN_TRIGGER_POPOVER_CLASS, popoverRemovalDelayMs, popoverScrollOffset } from "../constants"
import {
  attachPopoverEventListeners,
  createPopover,
  escapeLeadingIdNumber,
  focusableSelector,
  footnoteForwardRefRegex,
  PopoverOptions,
  setPopoverPosition,
  trapFocusInPopover,
} from "./popover_helpers"
import { wrapScrollables } from "./scroll-indicator-utils"

// After SPA navigation, Safari fires spurious mouseenter events because the
// DOM morphs under a stationary cursor. We suppress these by tracking whether
// the mouse has actually moved since the last navigation.
let mouseMovedSinceNav = true

// Module-level state
let activePopoverRemover: (() => void) | null = null
let pendingPopoverTimer: number | null = null
let linkListenerController: AbortController | null = null
// Timestamp of last SPA navigation. Used to suppress spurious mouseenter
// events that Safari fires immediately after DOM morphing.
// When true, the next popover created by mouseEnterHandler will be pinned
// (persist until explicitly closed via X or Escape). Set by click handlers.
let nextPopoverPinned = false
// Aborted to cancel in-flight async popover creation. A fresh controller is
// installed synchronously at the start of each mouseEnterHandler call (and on
// nav), so a stale call's signal is already aborted by the time its fetch
// resolves and it discards its result.
let popoverFetchController: AbortController | null = null

/**
 * Handles the mouse enter event for link elements
 */
async function mouseEnterHandler(this: HTMLLinkElement) {
  const parentOfPopover = document.getElementById("site-root")
  if (!parentOfPopover || this.dataset.noPopover === "true") {
    return
  }

  // Capture state synchronously before the await so concurrent calls
  // don't share or leak the pinned flag across popovers.
  const shouldPin = nextPopoverPinned
  nextPopoverPinned = false
  // Abort any previous in-flight creation so its stale result is discarded,
  // then install a fresh controller for this call.
  popoverFetchController?.abort()
  popoverFetchController = new AbortController()
  const { signal } = popoverFetchController

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
  if (signal.aborted) {
    return
  }

  // Hover popovers are dismissed by mouseleave on the link or the popover, so
  // they must only attach while the pointer is still over the link: attaching
  // after the pointer left would leave a popover with no dismissal path.
  if (!shouldPin && !this.matches(":hover")) {
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

  // Wrap any scrollable tables/katex in the popover with fade indicators
  const popoverObservers = wrapScrollables(popoverElement)

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

  // Set up focus trap for pinned popovers; track the cleanup function
  // and the element that triggered the popover so we can restore focus on close.
  let removeFocusTrap: (() => void) | null = null
  const triggerElement = this as HTMLElement

  const onPopoverRemove = () => {
    activePopoverRemover = null
    for (const obs of popoverObservers) obs.disconnect()
    window.removeEventListener("resize", updatePosition)
    window.removeEventListener("scroll", handleScroll)
    if (removeFocusTrap) {
      removeFocusTrap()
      removeFocusTrap = null
    }
    // Return focus to the link that triggered a pinned popover
    if (shouldPin) {
      triggerElement.focus()
    }
  }

  const popoverCleanup = attachPopoverEventListeners(popoverElement, this, onPopoverRemove)
  activePopoverRemover = popoverCleanup

  window.addEventListener("resize", updatePosition)
  window.addEventListener("scroll", handleScroll, { passive: true })

  // skipcq: JS-0098 - Force reflow to ensure the browser commits the
  // initial hidden state before the dropin animation class is added.
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

  // For pinned popovers, trap focus and move it into the popover
  if (shouldPin) {
    removeFocusTrap = trapFocusInPopover(popoverElement)
    // Focus the close button if available, otherwise the first focusable element
    const initialFocus = closeBtn ?? popoverElement.querySelector<HTMLElement>(focusableSelector)
    if (initialFocus) {
      ;(initialFocus as HTMLElement).focus()
    }
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
  // Invalidate any in-flight async mouseEnterHandler calls so they
  // discard their result instead of creating an orphaned popover.
  popoverFetchController?.abort()

  // Mark that the mouse hasn't moved yet since this navigation.
  // Safari fires spurious mouseenter events after DOM morphing under a
  // stationary cursor; we suppress those until a real mousemove occurs.
  mouseMovedSinceNav = false
  document.addEventListener(
    "mousemove",
    () => {
      mouseMovedSinceNav = true
    },
    { once: true },
  )

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
  const links = [...document.getElementsByClassName(CAN_TRIGGER_POPOVER_CLASS)] as HTMLLinkElement[]
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
          // Suppress popovers triggered by spurious mouseenter events that
          // Safari fires after SPA navigation morphs the DOM under a
          // stationary cursor. We check at timer-fire time (not at mouseenter
          // time) because mousemove may fire slightly after mouseenter when
          // the pointer teleports to an element.
          if (!mouseMovedSinceNav) {
            pendingPopoverTimer = null
            return
          }

          // Don't let hover replace a pinned (click-triggered) popover
          const currentPopover = document.querySelector(".popover") as HTMLElement | null
          if (currentPopover?.dataset.pinned) {
            pendingPopoverTimer = null
            return
          }

          if (activePopoverRemover) {
            activePopoverRemover()
          }
          // skipcq: JS-0098 — fire-and-forget; void marks the intentionally floating promise
          void mouseEnterHandler.call(link) // Show the new popover
          pendingPopoverTimer = null
        }, popoverRemovalDelayMs)
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
          // skipcq: JS-0098 — fire-and-forget; void marks the intentionally floating promise
          void mouseEnterHandler.call(link)
        },
        { signal },
      )
    }
  }
})
