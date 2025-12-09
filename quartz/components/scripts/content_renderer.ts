import { normalizeRelativeURLs, stripSlashes } from "../../util/path"

interface WindowWithCheckboxStates extends Window {
  __quartz_checkbox_states?: Map<string, boolean>
}

export interface ContentRenderOptions {
  targetUrl: URL
  idSuffix?: string
}

/**
 * Fetches and parses HTML content from a URL
 * @param url - The URL to fetch content from
 * @param customFetch - Optional custom fetch implementation
 * @returns Parsed HTML document
 */
export async function fetchHTMLContent(
  url: URL,
  customFetch: typeof fetch = fetch,
): Promise<Document> {
  const response = await customFetch(url.toString())
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const contents = await response.text()
  const parser = new DOMParser()
  const html = parser.parseFromString(contents, "text/html")
  normalizeRelativeURLs(html, url)

  return html
}

/**
 * Extracts popover-hint elements from HTML document
 * @param html - The HTML document to extract from
 * @returns Array of popover-hint elements
 */
export function extractPopoverHints(html: Document): Element[] {
  return Array.from(html.getElementsByClassName("popover-hint"))
}

/**
 * Modifies element IDs by appending a suffix
 * @param elements - Elements to process
 * @param suffix - Suffix to append to IDs
 */
export function modifyElementIds(elements: Element[], suffix: string): void {
  elements.forEach((elt) => {
    const headingsAndLinks = elt.querySelectorAll("h1, h2, h3, h4, h5, h6, li, a")
    headingsAndLinks.forEach((element) => {
      if (element.id) {
        element.id = `${element.id}${suffix}`
      }
    })
  })
}

/**
 * Restores checkbox states from localStorage
 * @param container - The container element with checkboxes
 * @param targetUrl - The URL of the page being displayed
 */
export function restoreCheckboxStates(container: HTMLElement, targetUrl: URL): void {
  const checkboxes = container.querySelectorAll("input.checkbox-toggle")
  if (checkboxes.length === 0) return

  // Extract the slug from the target URL pathname
  // Remove leading/trailing slashes and .html extension if present
  const slug = stripSlashes(targetUrl.pathname).replace(/\.html$/, "")

  const states = (window as WindowWithCheckboxStates).__quartz_checkbox_states
  if (!states) return

  checkboxes.forEach((checkbox, index) => {
    const checkboxId = `${slug}-checkbox-${index}`
    if (states.has(checkboxId)) {
      ;(checkbox as HTMLInputElement).checked = states.get(checkboxId)!
    }
  })
}

/**
 * Extracts and processes popover hints with checkbox restoration
 * @param html - The HTML document to extract from
 * @param targetUrl - The URL of the page (for checkbox state restoration)
 * @returns Array of processed elements with restored checkbox states
 */
export function extractAndProcessHints(html: Document, targetUrl: URL): Element[] {
  const hintElements = extractPopoverHints(html)

  const tempContainer = document.createElement("div")
  hintElements.forEach((el) => tempContainer.appendChild(el.cloneNode(true)))
  restoreCheckboxStates(tempContainer, targetUrl)

  return Array.from(tempContainer.children)
}

/**
 * Renders HTML content into a container with optional modifications
 * Always normalizes relative URLs and restores checkbox states
 * @param container - The container to render content into
 * @param html - The HTML document to render from
 * @param options - Rendering options
 * @returns Array of rendered elements
 */
export function renderHTMLContent(
  container: HTMLElement,
  html: Document,
  options: ContentRenderOptions,
): Element[] {
  const { targetUrl, idSuffix } = options

  // Always normalize URLs so relative links work correctly
  normalizeRelativeURLs(html, targetUrl)

  const hintElements = extractPopoverHints(html)

  // Modify IDs if a suffix is provided
  if (idSuffix) {
    modifyElementIds(hintElements, idSuffix)
  }

  hintElements.forEach((elt) => {
    container.appendChild(elt)
  })

  restoreCheckboxStates(container, targetUrl)

  return hintElements
}
