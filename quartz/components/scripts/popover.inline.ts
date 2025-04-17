import { normalizeRelativeURLs } from "../../util/path"
import {
  setPopoverPosition,
  attachPopoverEventListeners,
  PopoverOptions,
  escapeLeadingIdNumber,
  fetchWithMetaRedirect,
  POPOVER_SCROLL_OFFSET,
} from "./popover_helpers"

const parser = new DOMParser()

// Module-level state
let activePopoverRemover: (() => void) | null = null
let pendingPopoverTimer: number | null = null

/**
 * Creates a popover element based on the provided options
 * @param options - The options for creating the popover
 * @returns A Promise that resolves to the created popover element
 */
export async function createPopover(options: PopoverOptions): Promise<HTMLElement> {
  const { targetUrl, linkElement, customFetch = fetch } = options

  // Check if the link is a footnote back arrow
  const footnoteRefRegex = /^#user-content-fnref-\d+$/
  if (footnoteRefRegex.test(linkElement.getAttribute("href") || "")) {
    throw new Error("Footnote back arrow links are not supported for popovers")
  }

  const popoverElement = document.createElement("div")
  popoverElement.classList.add("popover")
  const popoverInner = document.createElement("div")
  popoverInner.classList.add("popover-inner")
  popoverElement.appendChild(popoverInner)

  const response = await fetchWithMetaRedirect(targetUrl, customFetch)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const contentType = response.headers.get("Content-Type")
  if (!contentType) throw new Error("No content type received")

  const [contentTypeCategory, typeInfo] = contentType.split("/")
  popoverInner.dataset.contentType = contentType

  let img: HTMLImageElement | null = null
  let contents: string | null = null
  let html: Document | null = null
  let hintElements: Element[] = []
  switch (contentTypeCategory) {
    case "image":
      img = document.createElement("img")
      img.src = targetUrl.toString()
      img.alt = targetUrl.pathname
      popoverInner.appendChild(img)
      break
    case "application":
      if (typeInfo === "pdf") {
        const pdf = document.createElement("iframe")
        pdf.src = targetUrl.toString()
        popoverInner.appendChild(pdf)
      }
      break
    default:
      contents = await response.text()
      html = parser.parseFromString(contents, "text/html")
      normalizeRelativeURLs(html, targetUrl)

      hintElements = Array.from(html.getElementsByClassName("popover-hint"))
      Array.from(hintElements).forEach((elt) => {
        const popoverHeadings = elt.querySelectorAll("h1, h2, h3, h4, h5, h6, li, a")
        popoverHeadings.forEach((element) => {
          if (element.id) {
            element.id = `${element.id}-popover`
          }
        })
        popoverInner.appendChild(elt)
      })
  }

  return popoverElement
}

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
