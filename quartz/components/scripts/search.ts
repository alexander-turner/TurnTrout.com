import FlexSearch, { type ContextOptions } from "flexsearch"

import { type ContentDetails } from "../../plugins/emitters/contentIndex"
import { replaceEmojiConvertArrows } from "../../plugins/transformers/twemoji"
import { tabletBreakpoint, mobileBreakpoint } from "../../styles/variables"
import { type FullSlug, normalizeRelativeURLs, resolveRelative } from "../../util/path"
import { registerEscapeHandler, removeAllChildren, debounce } from "./component_script_utils"

interface Item {
  id: number
  slug: FullSlug
  title: string
  content: string
  tags: string[]
  authors?: string
}

/**
 * Delay in milliseconds before triggering a search after user input
 */
export const debounceSearchDelay = 400

// Delay in milliseconds before triggering a mouseover event after user input
export const mouseFocusDelay = 100

type SearchType = "basic" | "tags"
let searchType: SearchType = "basic"
let currentSearchTerm = ""

const index = new FlexSearch.Document<Item>({
  charset: "latin:advanced",
  tokenize: "strict",
  resolution: 1,
  context: {
    depth: 2,
    bidirectional: false,
  } as ContextOptions,
  document: {
    id: "id",
    tag: "tags",
    index: [
      {
        field: "title",
        tokenize: "forward",
        resolution: 9,
      },
      {
        field: "content",
        tokenize: "strict",
        resolution: 9,
      },
      {
        field: "tags",
        tokenize: "strict",
        resolution: 9,
      },
      {
        field: "slug",
        tokenize: "strict",
        resolution: 9,
      },
      {
        field: "aliases",
        tokenize: "strict",
        resolution: 9,
      },
      {
        field: "authors",
        tokenize: "strict",
        resolution: 9,
      },
    ],
  },
})

interface FetchResult {
  content: Element[]
  frontmatter: Element
}

const fetchContentCache = new Map<FullSlug, Promise<FetchResult>>()
const contextWindowWords = 30
const numSearchResults = 8
const numTagResults = 5

/**
 * Tokenizes a search term into individual words and their combinations
 * @param term - The search term to tokenize
 * @returns Array of tokens, sorted by length (longest first)
 * @example
 * tokenizeTerm("hello world") // returns ["hello world", "hello", "world"]
 */
const tokenizeTerm = (term: string): string[] => {
  const tokens = term.split(/\s+/).filter((t) => t.trim() !== "")
  const tokenLen = tokens.length
  if (tokenLen > 1) {
    for (let i = 1; i < tokenLen; i++) {
      tokens.push(tokens.slice(0, i + 1).join(" "))
    }
  }

  return tokens.sort((a, b) => b.length - a.length) // always highlight longest terms first
}

/**
 * Highlights search terms within a text string
 * @param searchTerm - Term to highlight
 * @param text - Text to search within
 * @param trim - If true, returns a window of text around matches
 * @returns HTML string with highlighted terms wrapped in <span class="highlight">
 */
function highlight(searchTerm: string, text: string, trim?: boolean) {
  const tokenizedTerms = tokenizeTerm(searchTerm)
  let tokenizedText = text.split(/\s+/).filter((t) => t !== "")

  let startIndex = 0
  let endIndex = tokenizedText.length - 1
  if (trim) {
    const includesCheck = (tok: string) =>
      tokenizedTerms.some((term) => tok.toLowerCase().startsWith(term.toLowerCase()))
    const occurrencesIndices = tokenizedText.map(includesCheck)

    let bestSum = 0
    let bestIndex = 0
    for (let i = 0; i < Math.max(tokenizedText.length - contextWindowWords, 0); i++) {
      const window = occurrencesIndices.slice(i, i + contextWindowWords)
      const windowSum = window.reduce((total, cur) => total + (cur ? 1 : 0), 0)
      if (windowSum >= bestSum) {
        bestSum = windowSum
        bestIndex = i
      }
    }

    startIndex = Math.max(bestIndex - contextWindowWords, 0)
    endIndex = Math.min(startIndex + 2 * contextWindowWords, tokenizedText.length - 1)
    tokenizedText = tokenizedText.slice(startIndex, endIndex)
  }

  const slice = tokenizedText
    .map((tok: string): string => {
      // see if this tok is prefixed by any search terms
      for (const searchTok of tokenizedTerms) {
        if (tok.toLowerCase().includes(searchTok.toLowerCase())) {
          const sanitizedSearchTok = escapeRegExp(searchTok)
          const regex = new RegExp(sanitizedSearchTok.toLowerCase(), "gi")
          return tok.replace(regex, '<span class="highlight">$&</span>')
        }
      }
      return tok
    })
    .join(" ")

  let beginning = ""
  if (startIndex !== 0) {
    beginning = "..."
  }
  let end = ""
  if (endIndex !== tokenizedText.length - 1) {
    end = "..."
  }
  return `${beginning}${slice}${end}`
}

/**
 * Escapes special characters in a string for use in RegExp
 * @param text - String to escape
 */
function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const createHighlightSpan = (text: string) => {
  const span = document.createElement("span")
  span.className = "highlight"
  span.textContent = text
  return span
}

/**
 * Highlights search terms within HTML content while preserving HTML structure
 * @param node - HTML element to search within
 * @param term - Term to highlight
 */
export const highlightTextNodes = (node: Node, term: string) => {
  // Skip if node is within table of contents
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement
    if (element.closest("#toc-content-mobile")) return
    if (element.classList.contains("highlight")) return

    Array.from(node.childNodes).forEach((child) => highlightTextNodes(child, term))
  } else if (node.nodeType === Node.TEXT_NODE) {
    const nodeText = node.nodeValue ?? ""
    const sanitizedTerm = escapeRegExp(term)
    const regex = new RegExp(`(${sanitizedTerm})`, "gi")

    // Use a single split operation
    const parts = nodeText.split(regex)
    if (parts.length === 1) return // No matches

    const fragment = document.createDocumentFragment()
    parts.forEach((part: string): void => {
      if (part.toLowerCase() === term.toLowerCase()) {
        fragment.appendChild(createHighlightSpan(part))
      } else if (part) {
        fragment.appendChild(document.createTextNode(part))
      }
    })

    node.parentNode?.replaceChild(fragment, node)
  }
}

class PreviewManager {
  private container: HTMLDivElement
  private inner: HTMLElement
  private currentSlug: FullSlug | null = null

  constructor(container: HTMLDivElement) {
    this.container = container
    this.inner = document.createElement("article")
    this.inner.classList.add("preview-inner")
    this.container.appendChild(this.inner)
  }

  public update(el: HTMLElement | null, currentSearchTerm: string, baseSlug: FullSlug) {
    if (!el) {
      this.hide()
      return
    }

    const slug = el.id as FullSlug
    this.currentSlug = slug

    // Show container immediately
    this.show()

    // Fetch and render content immediately without waiting for assets
    void this.fetchAndUpdateContent(slug, currentSearchTerm, baseSlug)
  }

  private async fetchAndUpdateContent(
    slug: FullSlug,
    currentSearchTerm: string,
    baseSlug: FullSlug,
  ) {
    try {
      const { content, frontmatter } = await fetchContent(slug)

      // Only update if this is still the current preview we want
      if (this.currentSlug === slug) {
        const useDropcap: boolean =
          !("no_dropcap" in frontmatter) || frontmatter.no_dropcap === "false"
        this.inner.setAttribute("data-use-dropcap", useDropcap.toString())

        // Create a document fragment to build content off-screen
        const fragment = document.createDocumentFragment()
        content.forEach((el) => {
          const highlightedContent = highlightHTML(currentSearchTerm, el as HTMLElement)
          fragment.append(...Array.from(highlightedContent.childNodes))
        })

        // Clear existing content and append new content
        this.inner.innerHTML = ""
        this.inner.appendChild(fragment)

        // Set click handler
        this.inner.onclick = () => {
          window.location.href = resolveUrl(slug, baseSlug).toString()
        }

        // Let images and other resources load naturally
        // Browser will handle loading these in the background
        this.scrollToFirstHighlight()
      }
    } catch (error) {
      console.error("Error loading preview:", error)
      if (this.currentSlug === slug) {
        this.inner.innerHTML = '<div class="preview-error">Error loading preview</div>'
      }
    }
  }

  public show(): void {
    this.container.classList.add("active")
    this.container.style.visibility = "visible"
  }

  public hide(): void {
    this.container.classList.remove("active")
    this.container.style.visibility = "hidden"
  }

  public clear(): void {
    this.inner.innerHTML = ""
  }

  public destroy(): void {
    this.inner.onclick = null
    this.inner.innerHTML = ""
    this.currentSlug = null
  }

  private scrollToFirstHighlight(): void {
    // Get only the first matching highlight without sorting
    const firstHighlight = this.container.querySelector(".highlight") as HTMLElement
    if (!firstHighlight) return

    const offsetTop = getOffsetTopRelativeToContainer(firstHighlight, this.container)
    this.container.scrollTop = offsetTop - 0.5 * this.container.clientHeight
  }
}

let previewManager: PreviewManager | null

/**
 * Highlights search terms within HTML content while preserving HTML structure
 * @param searchTerm - Term to highlight
 * @param el - HTML element to search within
 * @returns DOM node with highlighted terms
 */
function highlightHTML(searchTerm: string, el: HTMLElement) {
  const parser = new DOMParser()
  const tokenizedTerms = tokenizeTerm(searchTerm)
  const html = parser.parseFromString(el.innerHTML, "text/html")

  for (const term of tokenizedTerms) {
    highlightTextNodes(html.body, term)
  }

  return html.body
}

export const searchPlaceholderDesktop = "Toggle search by pressing /"
export const searchPlaceholderMobile = "Search"
/**
 * Updates the search bar placeholder text based on screen width
 */
function updatePlaceholder() {
  const searchBar = document.getElementById("search-bar")
  if (window.innerWidth > tabletBreakpoint) {
    searchBar?.setAttribute("placeholder", searchPlaceholderDesktop)
  } else {
    searchBar?.setAttribute("placeholder", searchPlaceholderMobile)
  }
}

function showSearch(
  searchTypeNew: SearchType,
  container: HTMLElement | null,
  searchBar: HTMLInputElement | null,
) {
  if (!container || !searchBar) return
  searchType = searchTypeNew
  const navbar = document.getElementById("navbar")
  if (navbar) {
    navbar.style.zIndex = "1"
  }

  container.classList.add("active")
  document.body.classList.add("no-mix-blend-mode")

  searchBar.focus()
  searchBar.select() // Needed for firefox

  updatePlaceholder()
}

/**
 * Hides the search interface and resets its state
 */
function hideSearch() {
  const container = document.getElementById("search-container")
  const searchBar = document.getElementById("search-bar") as HTMLInputElement | null
  const results = document.getElementById("results-container")

  container?.classList.remove("active")
  document.body.classList.remove("no-mix-blend-mode")
  if (searchBar) {
    searchBar.value = ""
  }
  if (results) {
    removeAllChildren(results)
  }

  // Clean up preview
  if (previewManager) {
    previewManager.hide()
    // Ensure no residual information is left in the preview
    previewManager.clear()
  }

  searchType = "basic"
}

let searchLayout: HTMLElement | null = null
let data: { [key: FullSlug]: ContentDetails } | undefined
let results: HTMLElement
let preview: HTMLDivElement | undefined
let currentHover: HTMLElement | null = null
let currentSlug: FullSlug
let mouseEventsLocked = false

const appendLayout = (el: HTMLElement) => {
  if (searchLayout?.querySelector(`#${el.id}`) === null) {
    searchLayout?.appendChild(el)
  }
}

async function shortcutHandler(
  e: KeyboardEvent,
  container: HTMLElement | null,
  searchBar: HTMLInputElement | null,
) {
  if (e.key === "/") {
    e.preventDefault()
    const searchBarOpen = container?.classList.contains("active")
    if (searchBarOpen) {
      hideSearch()
    } else {
      showSearch("basic", container, searchBar)
    }
    return
  } else if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    // Hotkey to open tag search
    e.preventDefault()
    e.stopPropagation() // Add this line to stop event propagation
    const searchBarOpen = container?.classList.contains("active")
    if (searchBarOpen) {
      hideSearch()
    } else {
      // TODO document feature or remove; don't want hidden functionality
      showSearch("tags", container, searchBar)
    }

    // add "#" prefix for tag search
    if (searchBar) searchBar.value = "#"

    return
  }

  if (currentHover) {
    currentHover.classList.remove("focus")
  }

  // If search is active, then we will render the first result and display accordingly
  if (!container?.classList.contains("active")) return

  const prevSibling = (el: HTMLElement): HTMLElement =>
    el.previousElementSibling ? (el.previousElementSibling as HTMLElement) : el
  const nextSibling = (el: HTMLElement): HTMLElement =>
    el.nextElementSibling ? (el.nextElementSibling as HTMLElement) : el

  // Check if we can navigate through search results
  // Only allow if search bar is focused or a result is currently hovered
  const canNavigate = document.activeElement === searchBar || currentHover !== null

  if (e.key === "Enter") {
    // If a result has explicit keyboard focus, navigate to that one
    if (document.activeElement && document.activeElement.classList.contains("result-card")) {
      const active = document.activeElement as HTMLInputElement
      if (active.classList.contains("no-match")) return
      active.click()
    }
    // Otherwise, if a result has our visual "focus" class, navigate to that
    else if (currentHover && currentHover.classList.contains("focus")) {
      currentHover.click()
    }
    // As a fallback, navigate to the first result
    else {
      const anchor = document.getElementsByClassName("result-card")[0] as HTMLInputElement | null
      if (!anchor || anchor?.classList.contains("no-match")) return

      await displayPreview(anchor)
      focusCard(anchor)
      anchor.click()
    }
  } else if (e.key === "ArrowUp" || (e.shiftKey && e.key === "Tab")) {
    e.preventDefault()
    if (canNavigate) {
      const toShow = prevSibling(currentHover as HTMLElement)
      await displayPreview(toShow as HTMLElement)
      focusCard(toShow as HTMLElement)
    }
  } else if (e.key === "ArrowDown" || e.key === "Tab") {
    e.preventDefault()
    if (canNavigate) {
      const toShow = nextSibling(currentHover as HTMLElement)
      await displayPreview(toShow as HTMLElement)
      focusCard(toShow as HTMLElement)
    }
  }
}

let cleanupListeners: (() => void) | undefined
/**
 * Handles navigation events by setting up search functionality
 * @param e - Navigation event
 */
async function onNav(e: CustomEventMap["nav"]) {
  // Clean up previous listeners and preview manager if they exist
  if (cleanupListeners) {
    cleanupListeners()
  }
  if (previewManager) {
    previewManager.destroy()
    previewManager = null
  }

  currentSlug = e.detail.url
  data = await fetchData
  if (!data) return
  results = document.createElement("div")
  const container = document.getElementById("search-container")
  const searchIcon = document.getElementById("search-icon")
  const searchBar = document.getElementById("search-bar") as HTMLInputElement | null
  searchLayout = document.getElementById("search-layout")

  const enablePreview = searchLayout?.dataset?.preview === "true"
  results.id = "results-container"
  appendLayout(results)

  if (enablePreview) {
    preview = document.createElement("div")
    preview.id = "preview-container"
    appendLayout(preview)
  }

  const debouncedOnType = debounce(onType, debounceSearchDelay, false)

  // Store all event listener cleanup functions
  const listeners = new Set<() => void>()

  addListener(
    document,
    "keydown",
    (e: Event) => shortcutHandler(e as KeyboardEvent, container, searchBar),
    listeners,
  )
  addListener(searchIcon, "click", () => showSearch("basic", container, searchBar), listeners)
  addListener(searchBar, "input", debouncedOnType, listeners)

  const escapeCleanup = registerEscapeHandler(container, hideSearch)
  listeners.add(escapeCleanup)

  cleanupListeners = () => {
    listeners.forEach((cleanup) => cleanup())
    listeners.clear()
  }

  await fillDocument(data)
}

/**
 * Fetches and caches content for a given slug
 * Note: This function's correctness depends on the HTML structure of your content
 * and should be verified with your specific setup
 * @param slug - Page slug to fetch
 */
async function fetchContent(slug: FullSlug): Promise<FetchResult> {
  if (!fetchContentCache.has(slug)) {
    const fetchPromise = await (async () => {
      const targetUrl = resolveUrl(slug, currentSlug).toString()
      const contents = await fetch(targetUrl)
        .then((res) => res.text())
        .then((contents) => {
          if (contents === undefined) {
            throw new Error(`Could not fetch ${targetUrl}`)
          }

          const parser = new DOMParser()
          const html = parser.parseFromString(contents ?? "", "text/html")
          normalizeRelativeURLs(html, targetUrl)

          // Extract frontmatter
          const frontmatterScript = html.querySelector('script[type="application/json"]')
          const frontmatter = frontmatterScript
            ? JSON.parse(frontmatterScript.textContent || "{}")
            : {}

          const contentElements = [...html.getElementsByClassName("popover-hint")]

          return { content: contentElements, frontmatter }
        })

      return contents
    })()

    fetchContentCache.set(slug, Promise.resolve(fetchPromise))
  }

  return fetchContentCache.get(slug) ?? ({} as FetchResult)
}

async function focusCard(el: HTMLElement | null, keyboardFocus: boolean = true) {
  document.querySelectorAll(".result-card").forEach((card) => {
    card.classList.remove("focus")
  })

  if (el) {
    el.classList.add("focus")

    if (keyboardFocus) {
      el.focus()
    }
  }
}

/**
 * Displays a preview of a card element
 * @param el - Card element to display preview for
 * @param keyboardFocus - Whether to focus the element using the keyboard
 */
async function displayPreview(el: HTMLElement | null, keyboardFocus: boolean = true) {
  const enablePreview = searchLayout?.dataset?.preview === "true"
  if (!searchLayout || !enablePreview || !preview) return

  // Initialize preview manager if needed
  if (!previewManager && preview) {
    previewManager = new PreviewManager(preview)
  }

  await focusCard(el, keyboardFocus)

  // Update preview content
  previewManager?.update(el, currentSearchTerm, currentSlug)
}

/**
 * Adds an event listener and tracks it for cleanup
 * @param element - Element to attach listener to
 * @param event - Event name
 * @param handler - Event handler
 * @param listeners - Set to track cleanup functions
 */
function addListener(
  element: Element | Document | null,
  event: string,
  handler: EventListener,
  listeners: Set<(listener: () => void) => void>,
) {
  if (!element) return
  element.addEventListener(event, handler)
  listeners.add(() => element.removeEventListener(event, handler))
}

/**
 * Retrieves IDs from search results based on a specific field
 * @param field - Field name to filter by
 * @param searchResults - Search results to filter
 * @returns Array of IDs
 */
const getByField = (
  field: string,
  searchResults: FlexSearch.SimpleDocumentSearchResultSetUnit[],
): number[] => {
  const results = searchResults.filter((x) => x.field === field)
  return results.length === 0 ? [] : ([...results[0].result] as number[])
}

const resultToHTML = ({ slug, title, content, tags }: Item, enablePreview: boolean) => {
  const htmlTags = tags.length > 0 ? `<ul class="tags">${tags.join("")}</ul>` : ""
  const itemTile = document.createElement("a")
  itemTile.classList.add("result-card")
  itemTile.id = slug
  itemTile.href = resolveUrl(slug, currentSlug).toString()

  content = replaceEmojiConvertArrows(content)

  let suffixHTML = ""
  if (!enablePreview || window.innerWidth <= mobileBreakpoint) {
    suffixHTML = `<p>${content}</p>`
  }
  itemTile.innerHTML = `<span class="h4">${title}</span><br/>${htmlTags}${suffixHTML}`

  async function onMouseEnter(ev: MouseEvent) {
    if (mouseEventsLocked) return
    if (!ev.currentTarget) return
    const target = ev.currentTarget as HTMLElement
    await displayPreview(target)
  }

  // Add mouse leave handler to maintain focus state
  function onMouseLeave() {
    if (currentHover === itemTile) {
      currentHover = null
    }
  }

  itemTile.addEventListener("mouseenter", onMouseEnter)
  itemTile.addEventListener("mouseleave", onMouseLeave)

  return itemTile
}

/**
 * Formats search result data for display
 * @param term - Search term
 * @param id - Result ID
 * @param data - Content data
 * @param idDataMap - Mapping of IDs to slugs
 */
const formatForDisplay = (
  term: string,
  id: number,
  data: { [key: FullSlug]: ContentDetails },
  idDataMap: FullSlug[],
) => {
  const slug = idDataMap[id]
  return {
    id,
    slug,
    title: searchType === "tags" ? data[slug].title : highlight(term, data[slug].title ?? ""),
    content: highlight(term, data[slug].content ?? "", true),
    authors: data[slug].authors,
    tags: highlightTags(term.substring(1), data[slug].tags),
  }
}

/**
 * Displays search results in the UI
 * @param finalResults - Processed search results
 * @param results - Container element for results
 * @param enablePreview - Whether preview is enabled
 */
async function displayResults(finalResults: Item[], results: HTMLElement, enablePreview: boolean) {
  if (!results) return

  removeAllChildren(results)
  if (finalResults.length === 0) {
    results.innerHTML = `<a class="result-card no-match">
        <h3>No results</h3>
        <p>Try another search term?</p>
    </a>`

    if (enablePreview && preview) {
      if (!previewManager) {
        previewManager = new PreviewManager(preview)
      }
      previewManager.clear()
    }
  } else {
    results.append(...finalResults.map((result) => resultToHTML(result, enablePreview)))

    // focus on first result and update preview
    const firstChild = results.firstElementChild as HTMLElement
    firstChild.classList.add("focus")
    currentHover = firstChild as HTMLInputElement

    await displayPreview(firstChild, false)
  }
}

/**
 * Handles search input changes
 * @param e - Input event
 */
async function onType(e: HTMLElementEventMap["input"]) {
  if (!searchLayout || !index) return
  const enablePreview = searchLayout?.dataset?.preview === "true"
  currentSearchTerm = (e.target as HTMLInputElement).value
  searchLayout.classList.toggle("display-results", currentSearchTerm !== "")
  searchType = currentSearchTerm.startsWith("#") ? "tags" : "basic"

  mouseEventsLocked = true
  let searchResults: FlexSearch.SimpleDocumentSearchResultSetUnit[]
  if (searchType === "tags") {
    currentSearchTerm = currentSearchTerm.substring(1).trim()
    const separatorIndex = currentSearchTerm.indexOf(" ")
    if (separatorIndex !== -1) {
      // search by title and content index and then filter by tag (implemented in flexsearch)
      const tag = currentSearchTerm.substring(0, separatorIndex)
      const query = currentSearchTerm.substring(separatorIndex + 1).trim()
      searchResults = await index.searchAsync({
        query,
        // return at least 10000 documents, so it is enough to filter them by tag (implemented in flexsearch)
        limit: Math.max(numSearchResults, 2000),
        index: ["title", "content"],
        tag,
      })
      for (const searchResult of searchResults) {
        searchResult.result = searchResult.result.slice(0, numSearchResults)
      }
      // set search type to basic and remove tag from term for proper highlighting and scroll
      searchType = "basic"
      currentSearchTerm = query
    } else {
      // default search by tags index
      searchResults = await index.searchAsync({
        query: currentSearchTerm,
        limit: numSearchResults,
        index: ["tags"],
      })
    }
  } else if (searchType === "basic") {
    searchResults = await index.searchAsync({
      query: currentSearchTerm,
      limit: numSearchResults,
      index: ["title", "content", "slug", "authors"],
      bool: "or", // Appears in any of the fields
      suggest: false,
    })
  } else {
    throw new Error("Invalid search type")
  }

  // Ordering affects search results, so we need to order them here
  const allIds: Set<number> = new Set([
    ...getByField("slug", searchResults),
    ...getByField("title", searchResults),
    ...getByField("authors", searchResults),
    ...getByField("content", searchResults),
  ])
  const idDataMap = Object.keys(data ?? {}) as FullSlug[]
  if (!data) return

  const finalResults = [...allIds].map((id: number) =>
    formatForDisplay(currentSearchTerm, id, data as { [key: FullSlug]: ContentDetails }, idDataMap),
  )

  // Force a layout recalculation in WebKit
  if (results) {
    // This forces a style recalculation
    void results.offsetHeight
  }

  await displayResults(finalResults, results, enablePreview)

  // Re-enable mouse after a short delay to prevent immediate hover selection
  setTimeout(() => {
    mouseEventsLocked = false
  }, mouseFocusDelay)
}

/**
 * Highlights matching tags in search results
 * @param term - Search term
 * @param tags - Array of tags
 * @returns Array of HTML strings for tags
 */
function highlightTags(term: string, tags: string[]) {
  if (!tags || searchType !== "tags") {
    return []
  }

  return tags
    .map((tag) => {
      if (tag.toLowerCase().includes(term.toLowerCase())) {
        return `<li><p class="match-tag">#${tag}</p></li>`
      } else {
        return `<li><p>#${tag}</p></li>`
      }
    })
    .slice(0, numTagResults)
}

function resolveUrl(slug: FullSlug, currentSlug: FullSlug): URL {
  return new URL(resolveRelative(currentSlug, slug), location.toString())
}

/**
 * Initializes search functionality
 */
export function setupSearch() {
  document.addEventListener("nav", onNav)
}

/**
 * Fills flexsearch document with data
 * @param index index to fill
 * @param data data to fill index with
 */
async function fillDocument(data: { [key: FullSlug]: ContentDetails }) {
  let id = 0
  const promises: Array<Promise<unknown>> = []
  for (const [slug, fileData] of Object.entries<ContentDetails>(data)) {
    promises.push(
      index.addAsync(id++, {
        id,
        slug: slug as FullSlug,
        title: fileData.title,
        content: fileData.content,
        tags: fileData.tags,
        authors: fileData.authors,
      }),
    )
  }

  return await Promise.all(promises)
}

/*
 * Return all descendants with an ID
 */
export function descendantsWithId(rootNode: Element): HTMLElement[] {
  const elementsWithId: HTMLElement[] = []
  const children = rootNode.querySelectorAll<HTMLElement>("*")

  children.forEach((child) => {
    if (child.id && !child.id.startsWith("search-")) {
      elementsWithId.push(child)
    }
  })

  return elementsWithId
}

/*
 * Return all descendants with a same-page-link class
 */
export function descendantsSamePageLinks(rootNode: Element): HTMLAnchorElement[] {
  // Select all 'a' elements with 'href' starting with '#'
  const nodeListElements = rootNode.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')
  return Array.from(nodeListElements)
}

function getOffsetTopRelativeToContainer(element: HTMLElement, container: HTMLElement): number {
  let offsetTop = 0
  let currentElement: HTMLElement | null = element

  // Traverse up the DOM tree until we reach the container
  while (currentElement && currentElement !== container) {
    offsetTop += currentElement.offsetTop
    currentElement = currentElement.offsetParent as HTMLElement | null
  }

  return offsetTop
}
