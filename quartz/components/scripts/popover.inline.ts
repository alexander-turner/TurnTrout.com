import {
  createPopover,
  setPopoverPosition,
  attachPopoverEventListeners,
  PopoverOptions,
  escapeLeadingIdNumber,
} from "./popover_helpers"

/**
 * Handles the mouse enter event for link elements
 * @returns A cleanup function to remove event listeners
 */
async function mouseEnterHandler(this: HTMLLinkElement) {
  // Find the root element where the popover will be added
  const parentOfPopover = document.getElementById("quartz-root")
  // Exit if there's no parent or if the link is marked to not have a popover
  if (!parentOfPopover || this.dataset.noPopover === "true") {
    return
  }

  // Remove any existing popover to avoid multiple popovers
  const existingPopover = document.querySelector(".popover")
  if (existingPopover) {
    existingPopover.remove()
  }

  // Prepare URLs for comparison and content fetching
  const thisUrl = new URL(document.location.href)
  thisUrl.hash = ""
  thisUrl.search = ""
  const targetUrl = new URL(this.href)
  let hash = targetUrl.hash
  targetUrl.hash = ""
  targetUrl.search = ""

  // Create options for the popover
  const popoverOptions: PopoverOptions = {
    parentElement: parentOfPopover,
    targetUrl,
    linkElement: this,
  }

  // Create the popover element
  const popoverElement = await createPopover(popoverOptions)

  // Append the popover to the DOM before setting its position
  parentOfPopover.prepend(popoverElement)

  // Function to update popover position
  const updatePosition = () => {
    setPopoverPosition(popoverElement, this)
  }

  // Initial position setting
  updatePosition()

  // Add resize event listener
  window.addEventListener("resize", updatePosition)

  // Attach event listeners
  const cleanup = attachPopoverEventListeners(popoverElement, this)

  // Force a reflow to ensure the popover is added to the DOM
  void popoverElement.offsetWidth

  // Add the 'popover-visible' class to trigger the animation
  popoverElement.classList.add("popover-visible")

  // Handle scrolling to a specific heading if a hash is present
  if (hash !== "") {
    hash = `${hash}-popover`
    hash = escapeLeadingIdNumber(hash)
    const heading = popoverElement.querySelector(hash) as HTMLElement | null
    if (heading) {
      const popoverInner = popoverElement.querySelector(".popover-inner") as HTMLElement

      // leave ~12px of buffer when scrolling to a heading
      popoverInner.scroll({ top: heading.offsetTop - 12, behavior: "instant" })
    }
  }

  // Return an enhanced cleanup function
  return () => {
    cleanup()
    window.removeEventListener("resize", updatePosition)
  }
}

// Add event listeners to all internal links
document.addEventListener("nav", () => {
  // Select all internal links
  const links = [...document.getElementsByClassName("internal")] as HTMLLinkElement[]
  for (const link of links) {
    let cleanup: (() => void) | undefined

    // Create a mouseenter handler for each link
    const handleMouseEnter = async () => {
      // If there's an existing cleanup function, call it to remove old listeners
      if (cleanup) cleanup()
      // Call mouseEnterHandler and store its cleanup function
      cleanup = await mouseEnterHandler.call(link)
    }

    // Add the mouseenter event listener to the link
    link.addEventListener("mouseenter", handleMouseEnter)

    // Add a cleanup function to the global cleanup queue
    window.addCleanup(() => {
      // Remove the mouseenter event listener
      link.removeEventListener("mouseenter", handleMouseEnter)
      // If there's a cleanup function from mouseEnterHandler, call it
      if (cleanup) cleanup()
    })
  }
})
