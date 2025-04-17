import {
  setPopoverPosition,
  attachPopoverEventListeners,
  PopoverOptions,
  escapeLeadingIdNumber,
  createPopover,
  POPOVER_SCROLL_OFFSET,
} from "./popover_helpers"

// Module-level state
let activePopoverRemover: (() => void) | null = null
let pendingPopoverTimer: number | null = null

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

  // Set initial position
  updatePosition()

  // Define cleanup actions
  const onPopoverRemove = () => {
    activePopoverRemover = null
    window.removeEventListener("resize", updatePosition)
  }

  const popoverCleanup = attachPopoverEventListeners(popoverElement, this, onPopoverRemove)
  activePopoverRemover = popoverCleanup

  window.addEventListener("resize", updatePosition)

  // skipcq: JS-0098 - Force reflow to ensure CSS transition
  void popoverElement.offsetWidth

  popoverElement.classList.add("popover-visible")

  // Handle hash scrolling
  if (hash !== "") {
    hash = `${hash}-popover`
    hash = escapeLeadingIdNumber(hash)
    const heading = popoverElement.querySelector(hash) as HTMLElement | null
    if (heading) {
      const popoverInner = popoverElement.querySelector(".popover-inner") as HTMLElement

      // Need to scroll the inner container
      popoverInner.scroll({ top: heading.offsetTop - POPOVER_SCROLL_OFFSET, behavior: "instant" })
    }
  }
}

document.addEventListener("nav", () => {
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

    link.addEventListener("mouseenter", handleMouseEnter)
    link.addEventListener("mouseleave", handleMouseLeave)
  }
})
