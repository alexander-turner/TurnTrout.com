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

/**
 * Handles the mouse enter event for link elements
 */
async function mouseEnterHandler(this: HTMLLinkElement) {
  const parentOfPopover = document.getElementById("quartz-root")
  if (!parentOfPopover || this.dataset.noPopover === "true") {
    return
  }

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
  if (!popoverElement) {
    throw new Error("Failed to create popover")
  }
  popoverElement.dataset.linkHref = this.href // Mark the popover with its source link TODO why

  parentOfPopover.prepend(popoverElement)

  const updatePosition = () => {
    setPopoverPosition(popoverElement, this)
  }

  updatePosition()

  // Footnote popovers persist through scroll (dismissed only via X button);
  // regular popovers close on scroll since they're hover-triggered and ephemeral.
  const handleScroll = () => {
    if (activePopoverRemover && !popoverElement.classList.contains("footnote-popover")) {
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

  // Re-attach event listeners to all links that can trigger a popover
  const links = [...document.getElementsByClassName("can-trigger-popover")] as HTMLLinkElement[]
  for (const link of links) {
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

    // Add click toggle for footnote reference links
    const href = link.getAttribute("href") || ""
    if (footnoteForwardRefRegex.test(href)) {
      link.addEventListener(
        "click",
        (e: MouseEvent) => {
          e.preventDefault()
          // Stop propagation so the SPA router's document-level click handler
          // doesn't intercept this and navigate to the hash (which scrolls the
          // page and dispatches a nav event that would clean up the popover).
          e.stopPropagation()

          // Clear any pending hover timer
          if (pendingPopoverTimer) {
            clearTimeout(pendingPopoverTimer)
            pendingPopoverTimer = null
          }

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
          mouseEnterHandler.call(link)
        },
        { signal },
      )
    }
  }
})
