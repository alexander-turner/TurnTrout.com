export interface PopoverOptions {
  parentElement: HTMLElement
  targetUrl: URL
  linkElement: HTMLLinkElement
  customFetch?: typeof fetch
}

export const POPOVER_SCROLL_OFFSET = 12

/**
 * Fetches content while following HTML meta refresh redirects.
 * @param url - The URL to fetch
 * @param customFetch - Optional custom fetch implementation
 * @param maxRedirects - Maximum number of redirects to follow (default: 3)
 * @returns The final response after following any meta refreshes
 */
export async function fetchWithMetaRedirect(
  url: URL,
  customFetch: typeof fetch = fetch,
  maxRedirects = 3,
): Promise<Response> {
  let currentUrl = url
  let redirectCount = 0

  while (redirectCount < maxRedirects) {
    const response = await customFetch(currentUrl.toString())

    // If not HTML or response not OK, return as-is
    const contentType = response.headers.get("Content-Type")
    if (!response.ok || !contentType?.includes("text/html")) {
      return response
    }

    const html = await response.text()
    const metaRefresh = html.match(/<meta[^>]*?http-equiv=["']?refresh["']?[^>]*?>/i)

    if (!metaRefresh) {
      // No meta refresh found, return response with the HTML content
      return new Response(html, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      })
    }

    // Extract URL from content="[timeout]; url=[url]"
    const urlMatch = metaRefresh[0].match(/url=(.*?)["'\s>]/i)
    if (!urlMatch) {
      return response
    }

    // Update URL for next iteration
    currentUrl = new URL(urlMatch[1], currentUrl)
    redirectCount++
  }

  throw new Error(`Maximum number of redirects (${maxRedirects}) exceeded`)
}

// POSITIONING the popover
export const POPOVER_PADDING = 5

/**
 * Computes the left position of the popover
 * @param linkRect - The bounding rectangle of the link element
 * @param popoverWidth - The width of the popover element
 * @returns The computed left position
 */
export function computeLeft(linkRect: DOMRect, popoverWidth: number): number {
  const initialLeft = linkRect.left - popoverWidth - POPOVER_PADDING

  // Ensure the popover doesn't go off the left or right edge of the screen
  const maxLeft = window.innerWidth - popoverWidth - POPOVER_PADDING
  const minLeft = POPOVER_PADDING

  return Math.max(minLeft, Math.min(initialLeft, maxLeft))
}

/**
 * Computes the top position of the popover
 * @param linkRect - The bounding rectangle of the link element
 * @param popoverHeight - The height of the popover element
 * @returns The computed top position
 */
export function computeTop(linkRect: DOMRect, popoverHeight: number): number {
  // Calculate top position to be centered vertically with the link
  const initialTop = 0.5 * (linkRect.top + linkRect.bottom) - 0.5 * popoverHeight + window.scrollY

  // Ensure the popover doesn't go off the top or bottom of the screen
  const minTop = window.scrollY + POPOVER_PADDING
  const maxTop = window.scrollY + window.innerHeight - popoverHeight - POPOVER_PADDING

  return Math.max(minTop, Math.min(initialTop, maxTop))
}

/**
 * Sets the position of the popover relative to the link element
 * @param popoverElement - The popover element to position
 * @param linkElement - The link element to position relative to
 */
export function setPopoverPosition(
  popoverElement: HTMLElement,
  linkElement: HTMLLinkElement,
): void {
  const linkRect = linkElement.getBoundingClientRect()
  const popoverWidth = popoverElement.offsetWidth
  const popoverHeight = popoverElement.offsetHeight

  const left = computeLeft(linkRect, popoverWidth)
  const top = computeTop(linkRect, popoverHeight)

  Object.assign(popoverElement.style, {
    position: "absolute",
    left: `${left}px`,
    top: `${top}px`,
  })
}

/**
 * Attaches event listeners to the popover and link elements
 * @param popoverElement - The popover element
 * @param linkElement - The link element
 * @param onRemove - Callback function invoked when the popover is fully removed
 * @returns A cleanup function to remove the event listeners
 */
export function attachPopoverEventListeners(
  popoverElement: HTMLElement,
  linkElement: HTMLLinkElement,
  onRemove: () => void,
): () => void {
  let isMouseOverLink = false
  let isMouseOverPopover = false

  const removePopover = () => {
    popoverElement.classList.remove("visible")
    // Use a short timeout to allow for potential CSS transitions
    setTimeout(() => {
      if (!isMouseOverLink && !isMouseOverPopover) {
        popoverElement.remove()
        onRemove()
      }
    }, 300)
  }

  const showPopover = () => {
    popoverElement.classList.add("popover-visible")
  }

  const handlerMap = {
    mouseenterLink: () => {
      isMouseOverLink = true
      showPopover()
    },
    mouseleaveLink: () => {
      isMouseOverLink = false
      removePopover()
    },
    mouseenterPopover: () => {
      isMouseOverPopover = true
    },
    mouseleavePopover: () => {
      isMouseOverPopover = false
      removePopover()
    },
    clickPopover: (e: MouseEvent) => {
      const clickedLink = (e.target as HTMLElement).closest("a")
      if (clickedLink && clickedLink instanceof HTMLAnchorElement) {
        window.location.href = clickedLink.href
      } else {
        window.location.href = linkElement.href
      }
    },
  }

  linkElement.addEventListener("mouseenter", handlerMap.mouseenterLink)
  linkElement.addEventListener("mouseleave", handlerMap.mouseleaveLink)
  popoverElement.addEventListener("mouseenter", handlerMap.mouseenterPopover)
  popoverElement.addEventListener("mouseleave", handlerMap.mouseleavePopover)
  popoverElement.addEventListener("click", handlerMap.clickPopover)

  // Returned cleanup function
  return () => {
    linkElement.removeEventListener("mouseenter", handlerMap.mouseenterLink)
    linkElement.removeEventListener("mouseleave", handlerMap.mouseleaveLink)
    popoverElement.removeEventListener("mouseenter", handlerMap.mouseenterPopover)
    popoverElement.removeEventListener("mouseleave", handlerMap.mouseleavePopover)
    popoverElement.removeEventListener("click", handlerMap.clickPopover)

    // Also trigger removal logic if cleanup is called directly
    popoverElement.remove()
    onRemove()
  }
}

/**
 * Escapes leading ID numbers in a string
 * @param text - The text to escape
 * @returns The escaped text
 */
export function escapeLeadingIdNumber(text: string): string {
  return text.replace(/#(\d+)/, "#_$1")
}
