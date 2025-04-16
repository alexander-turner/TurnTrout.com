import { normalizeRelativeURLs } from "../../util/path"
import { animate } from "./component_script_utils"
import {
  setPopoverPosition,
  attachPopoverEventListeners,
  PopoverOptions,
  escapeLeadingIdNumber,
  IGNORE_POPOVER_IDS,
  fetchWithMetaRedirect,
  POPOVER_SCROLL_OFFSET,
} from "./popover_helpers"

const parser = new DOMParser()

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
 * @returns A cleanup function to remove event listeners and timeout
 */
function mouseEnterHandler(this: HTMLLinkElement) {
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

    // skipcq: JS-0098
    void popoverElement.offsetWidth

    popoverElement.classList.add("popover-visible")

    if (hash !== "") {
      hash = `${hash}-popover`
      hash = escapeLeadingIdNumber(hash)
      const heading = popoverElement.querySelector(hash) as HTMLElement | null
      if (heading) {
        const popoverInner = popoverElement.querySelector(".popover-inner") as HTMLElement

        popoverInner.scroll({ top: heading.offsetTop - POPOVER_SCROLL_OFFSET, behavior: "instant" })
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
      () => undefined,
      async () => {
        await showPopover()
      },
    )
  }

  const cleanup = cleanupShow()

  return () => {
    cleanup()
    window.removeEventListener("resize", showPopover)
  }
}

document.addEventListener("nav", () => {
  const links = [...document.getElementsByClassName("internal")].filter(
    (link) => !IGNORE_POPOVER_IDS.some((id) => link.closest(`#${id}`)),
  ) as HTMLLinkElement[]
  for (const link of links) {
    // Define handlers outside to ensure they can be removed
    let cleanup: (() => void) | undefined

    const handleMouseEnter = async () => {
      if (cleanup) cleanup()
      cleanup = mouseEnterHandler.call(link)
    }

    const handleMouseLeave = () => {
      if (cleanup) cleanup()
    }

    link.addEventListener("mouseenter", handleMouseEnter)
    link.addEventListener("mouseleave", handleMouseLeave)
  }
})
