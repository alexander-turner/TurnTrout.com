import { debounce, animate } from "./component_script_utils"
import {
  createPopover,
  setPopoverPosition,
  attachPopoverEventListeners,
  PopoverOptions,
  escapeLeadingIdNumber,
} from "./popover_helpers"

/**
 * Handles the mouse enter event for link elements
 * @returns A cleanup function to remove event listeners and timeout
 */
async function mouseEnterHandler(this: HTMLLinkElement) {
  const parentOfPopover = document.getElementById("quartz-root")
  if (!parentOfPopover || this.dataset.noPopover === "true") {
    return
  }

  // Remove any existing popover to avoid multiple popovers
  const existingPopover = document.querySelector(".popover")
  if (existingPopover) {
    existingPopover.remove()
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

  const showPopover = async () => {
    const popoverElement = await createPopover(popoverOptions)
    if (!popoverElement) {
      throw new Error("Failed to create popover")
    }

    parentOfPopover.prepend(popoverElement)

    const updatePosition = () => {
      setPopoverPosition(popoverElement, this)
    }

    updatePosition()

    window.addEventListener("resize", updatePosition)

    const cleanup = attachPopoverEventListeners(popoverElement, this)

    void popoverElement.offsetWidth

    popoverElement.classList.add("popover-visible")

    if (hash !== "") {
      hash = `${hash}-popover`
      hash = escapeLeadingIdNumber(hash)
      const heading = popoverElement.querySelector(hash) as HTMLElement | null
      if (heading) {
        const popoverInner = popoverElement.querySelector(".popover-inner") as HTMLElement

        popoverInner.scroll({ top: heading.offsetTop - 12, behavior: "instant" })
      }
    }

    return () => {
      cleanup()
      window.removeEventListener("resize", updatePosition)
    }
  }

  // Use requestAnimationFrame to delay showing the popover
  const cleanupShow = () => {
    return animate(
      300,
      () => {},
      async () => {
        await showPopover()
      },
    )
  }

  const cleanup = cleanupShow()

  // Return an enhanced cleanup function
  return () => {
    cleanup()
    window.removeEventListener("resize", showPopover)
  }
}

// Add event listeners to all internal links
document.addEventListener("nav", () => {
  const links = [...document.getElementsByClassName("internal")] as HTMLLinkElement[]
  for (const link of links) {
    // Define handlers outside to ensure they can be removed
    let cleanup: (() => void) | undefined

    const handleMouseEnter = async () => {
      if (cleanup) cleanup()
      cleanup = await mouseEnterHandler.call(link)
    }

    const handleMouseLeave = () => {
      if (cleanup) cleanup()
    }

    // Remove existing event listeners to prevent duplicates
    link.removeEventListener("mouseenter", handleMouseEnter)
    link.removeEventListener("mouseleave", handleMouseLeave)

    // Add event listeners
    const debouncedMouseEnter = debounce(handleMouseEnter, 200, true)
    link.addEventListener("mouseenter", debouncedMouseEnter)
    link.addEventListener("mouseleave", handleMouseLeave)
  }
})
