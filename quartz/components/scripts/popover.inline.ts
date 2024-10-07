import { normalizeRelativeURLs } from "../../util/path"

const p = new DOMParser()
async function mouseEnterHandler(this: HTMLLinkElement) {
  const link = this
  const parentOfPopover = document.getElementById("quartz-root")
  if (link.dataset.noPopover === "true") {
    return
  }

  // Remove any existing popover
  const existingPopover = document.querySelector(".popover")
  if (existingPopover) {
    existingPopover.remove()
  }

  async function setPosition(popoverElement: HTMLElement) {
    const linkRect = link.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const popoverWidth = popoverElement.offsetWidth
    const popoverHeight = popoverElement.offsetHeight

    // Position below the link
    let top = linkRect.bottom + 5 // 5px gap between link and popover

    // Center horizontally relative to the link
    let left = linkRect.left - popoverWidth / 2

    // Ensure it doesn't go off the left or right sides
    left = Math.max(10, Math.min(left, viewportWidth - popoverWidth - 10))

    // Ensure it doesn't go off the top or bottom
    top = Math.max(10, Math.min(top, viewportHeight - popoverHeight - 10))

    Object.assign(popoverElement.style, {
      left: `${left}px`,
      top: `${top}px`,
    })
  }

  const hasAlreadyBeenFetched = () =>
    [...(parentOfPopover?.children ?? [])].some((child) => child.classList.contains("popover"))

  // dont refetch if there's already a popover
  if (hasAlreadyBeenFetched()) {
    return
  }

  const thisUrl = new URL(document.location.href)
  thisUrl.hash = ""
  thisUrl.search = ""
  const targetUrl = new URL(link.href)
  let hash = targetUrl.hash
  targetUrl.hash = ""
  targetUrl.search = ""

  const response = await fetch(`${targetUrl}`).catch((err) => {
    console.error(err)
  })

  // bailout if another popover exists
  if (hasAlreadyBeenFetched()) {
    return
  }

  if (!response) return
  const [contentType] = response.headers.get("Content-Type")!.split(";")
  const [contentTypeCategory, typeInfo] = contentType.split("/")

  let popoverElement = document.createElement("div")
  popoverElement.classList.add("popover")
  popoverElement.style.cursor = "pointer" // Add cursor style
  const popoverInner = document.createElement("div")
  popoverInner.classList.add("popover-inner")
  popoverElement.appendChild(popoverInner)

  popoverInner.dataset.contentType = contentType ?? undefined

  switch (contentTypeCategory) {
    case "image":
      const img = document.createElement("img")
      img.src = targetUrl.toString()
      img.alt = targetUrl.pathname

      popoverInner.appendChild(img)
      break
    case "application":
      switch (typeInfo) {
        case "pdf":
          const pdf = document.createElement("iframe")
          pdf.src = targetUrl.toString()
          popoverInner.appendChild(pdf)
          break
        default:
          break
      }
      break
    default:
      const contents = await response.text()
      const html = p.parseFromString(contents, "text/html")
      const appendToAttr = (element: Element, attrName: string, toAppend: string) => {
        const attr = element.getAttribute(attrName)
        if (attr) {
          element.setAttribute(attrName, `${attr}${toAppend}`)
        }
      }

      // Modify id attributes so they don't mess up anchor jumps
      html.querySelectorAll("body *").forEach((elt) => {
        const id = elt.getAttribute("id")
        if (!id) return
        const newId = /^[0-9]/.test(id) ? "_" + id : id
        elt.setAttribute("id", newId + "-popover")
      })
      // We want same page links clicked within the popover to move the popover window instead of the main window
      html.querySelectorAll("body a.same-page-link").forEach((link) => {
        ;(link as HTMLLinkElement).href = escapeLeadingIdNumber((link as HTMLLinkElement).href)
        appendToAttr(link, "href", "-popover")
      })

      normalizeRelativeURLs(html, targetUrl)
      const elts = [...html.getElementsByClassName("popover-hint")]
      if (elts.length === 0) return

      elts.forEach((elt) => popoverInner.appendChild(elt))
  }

  setPosition(popoverElement)
  parentOfPopover?.prepend(popoverElement)

  let isMouseOverLink = false
  let isMouseOverPopover = false

  const removePopover = () => {
    popoverElement.classList.remove("visible")

    // Short delay to allow other mouse events to fire
    setTimeout(() => {
      if (!isMouseOverLink && !isMouseOverPopover) {
        popoverElement.remove()
      }
    }, 300) // Wait until animation finishes
  }

  const showPopover = () => {
    popoverElement.classList.add("popover-visible")
  }

  link.addEventListener("mouseenter", () => {
    isMouseOverLink = true
    showPopover()
  })

  link.addEventListener("mouseleave", () => {
    isMouseOverLink = false
    removePopover()
  })

  popoverElement.addEventListener("mouseenter", () => {
    isMouseOverPopover = true
  })

  popoverElement.addEventListener("mouseleave", () => {
    isMouseOverPopover = false
    removePopover()
  })

  popoverElement.addEventListener("click", (e) => {
    const clickedLink = (e.target as HTMLElement).closest("a")
    if (clickedLink && clickedLink instanceof HTMLAnchorElement) {
      // If a specific link is clicked, navigate to that link
      window.location.href = clickedLink.href
    } else {
      // If empty space is clicked, navigate to the original link
      window.location.href = link.href
    }
  })

  showPopover()

  // Cleanup function to remove event listeners
  const cleanup = () => {
    link.removeEventListener("mouseenter", showPopover)
    link.removeEventListener("mouseleave", removePopover)
    popoverElement.removeEventListener("mouseenter", () => {
      isMouseOverPopover = true
    })
    popoverElement.removeEventListener("mouseleave", () => {
      isMouseOverPopover = false
      removePopover()
    })
    popoverElement.removeEventListener("click", (e) => {
      const clickedLink = (e.target as HTMLElement).closest("a")
      if (clickedLink && clickedLink instanceof HTMLAnchorElement) {
        e.preventDefault()
        window.location.href = clickedLink.href
      } else {
        e.preventDefault()
        window.location.href = link.href
      }
    })
  }

  if (hash !== "") {
    hash += "-popover"
    hash = escapeLeadingIdNumber(hash)
    const heading = popoverInner.querySelector(hash) as HTMLElement | null
    if (heading) {
      // leave ~12px of buffer when scrolling to a heading
      popoverInner.scroll({ top: heading.offsetTop - 12, behavior: "instant" })
    }
  }

  return cleanup
}

// Not all IDs are valid - can't start with digit
function escapeLeadingIdNumber(headingText: string) {
  // Escape numbers at the start
  const escapedId = headingText.replace(/\#(\d+)/, "#_$1")

  return escapedId
}

document.addEventListener("nav", () => {
  const links = [...document.getElementsByClassName("internal")] as HTMLLinkElement[]
  for (const link of links) {
    let cleanup: (() => void) | undefined

    const handleMouseEnter = async (_event: MouseEvent) => {
      if (cleanup) cleanup() // Remove previous listeners if any
      cleanup = await mouseEnterHandler.call(link)
    }

    link.addEventListener("mouseenter", handleMouseEnter)
    window.addCleanup(() => {
      link.removeEventListener("mouseenter", handleMouseEnter)
      if (cleanup) cleanup()
    })
  }
})
