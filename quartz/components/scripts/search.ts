import FlexSearch, { type ContextOptions } from "flexsearch"

import { type ContentDetails } from "../../plugins/emitters/contentIndex"
import { replaceEmojiConvertArrows } from "../../plugins/transformers/twemoji"
import { tabletBreakpoint } from "../../styles/variables"
import { escapeRegExp } from "../../util/escape"
import { type FullSlug, resolveRelative } from "../../util/path"
import { simpleConstants } from "../constants"
import { registerEscapeHandler, removeAllChildren, debounce } from "./component_script_utils"
import { fetchHTMLContent, processPreviewables } from "./content_renderer"

// Global function injected by renderPage.tsx to lazy-load content index
declare global {
  function getContentIndex(): Promise<{ [key: string]: ContentDetails }>
}

const { debounceSearchDelay, mouseFocusDelay, searchPlaceholderDesktop, searchPlaceholderMobile } =
  simpleConstants

interface Item {
  id: number
  slug: FullSlug
  title: string
  content: string
  authors?: string // Stored as comma-joined string for search indexing
}

let currentSearchTerm = ""
let searchLayout: HTMLElement | null = null

const documentType = FlexSearch.Document<Item>
let index: InstanceType<typeof documentType> | null = null
let searchInitialized = false
let searchInitializing = false
let initializationPromise: Promise<void> | null = null

/**
 * Creates and configures a new FlexSearch index
 */
function createSearchIndex(): InstanceType<typeof documentType> {
  return new documentType({
    charset: "latin:advanced",
    tokenize: "strict",
    resolution: 1,
    context: {
      depth: 2,
      bidirectional: false,
    } as ContextOptions,
    document: {
      id: "id",
      index: [
        {
          field: "title",
          tokenize: "forward",
          resolution: 7, // Higher resolution for titles (most important field)
        },
        {
          field: "content",
          tokenize: "strict",
          resolution: 6, // Balanced resolution for content (largest field)
        },
        {
          field: "tags",
          tokenize: "strict",
          resolution: 5, // Lower resolution for short metadata
        },
        {
          field: "slug",
          tokenize: "strict",
          resolution: 5, // Lower resolution for short metadata
        },
        {
          field: "aliases",
          tokenize: "strict",
          resolution: 5, // Lower resolution for short metadata
        },
        {
          field: "authors",
          tokenize: "strict",
          resolution: 5, // Lower resolution for short metadata
        },
      ],
    },
  })
}

interface FetchResult {
  content: Element[]
  frontmatter: Element
}

const fetchContentCache = new Map<FullSlug, Promise<FetchResult>>()
const contextWindowWords = 30
const numSearchResults = 8

/**
 * Tokenizes a search term into individual words and their combinations
 * @param term - The search term to tokenize
 * @returns Array of tokens, sorted by length (longest first)
 * @example
 * tokenizeTerm("hello world") // returns ["hello world", "hello", "world"]
 */
export const tokenizeTerm = (term: string): string[] => {
  const tokens = term.split(/\s+/).filter((t) => t.trim() !== "")
  const tokenLen = tokens.length
  if (tokenLen > 1) {
    for (let i = 1; i < tokenLen; i++) {
      tokens.push(tokens.slice(0, i + 1).join(" "))
    }
  }

  return tokens.sort((a, b) => b.length - a.length) // always match longest terms first
}

/**
 * matchs search terms within a text string
 * @param searchTerm - Term to match
 * @param text - Text to search within
 * @param trim - If true, returns a window of text around matches
 * @returns HTML string with matched terms wrapped in <span class="match">
 */
export function match(searchTerm: string, text: string, trim?: boolean) {
  const tokenizedTerms = tokenizeTerm(searchTerm)
  let tokenizedText = text.split(/\s+/).filter((t) => t !== "")
  const originalTokenLen = tokenizedText.length

  let startIndex = 0
  let endIndex = tokenizedText.length - 1
  if (trim) {
    // Checks if the token starts with any of the tokenized terms (case-insensitive).
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
    // Include both startIndex and endIndex tokens in the slice
    tokenizedText = tokenizedText.slice(startIndex, endIndex + 1)
  }

  const slice = tokenizedText
    .map((tok: string): string => {
      // see if this tok is prefixed by any search terms
      for (const searchTok of tokenizedTerms) {
        if (tok.toLowerCase().includes(searchTok.toLowerCase())) {
          const sanitizedSearchTok = escapeRegExp(searchTok)
          const regex = new RegExp(sanitizedSearchTok.toLowerCase(), "gi")
          return tok.replace(regex, '<span class="search-match">$&</span>')
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
  if (endIndex < originalTokenLen - 1) {
    end = "..."
  }
  return `${beginning}${slice}${end}`
}

// Re-export escapeRegExp from centralized escape utilities
export { escapeRegExp } from "../../util/escape"

/**
 * Creates a span element with the class "match" and the given text
 */
export const createMatchSpan = (text: string): HTMLSpanElement => {
  const span = document.createElement("span")
  span.className = "search-match"
  span.textContent = text
  return span
}

/**
 * Syncs the display-results class with the actual search bar content
 * This handles cases where JS state is lost but DOM state persists
 */
export function syncSearchLayoutState() {
  if (document.hidden) return

  const container = document.getElementById("search-container")
  if (!container?.classList.contains("active")) return

  const searchBar = document.getElementById("search-bar") as HTMLInputElement | null
  if (!searchBar || !searchLayout) return

  const hasSearchText = searchBar.value.trim() !== ""
  currentSearchTerm = searchBar.value
  searchLayout.classList.toggle("display-results", hasSearchText)
}

/**
 * matchs search terms within HTML content while preserving HTML structure
 * @param node - HTML element to search within
 * @param term - Term to match
 */
export const matchTextNodes = (node: Node, term: string) => {
  // Skip if node is within table of contents
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement
    if (element.closest("#toc-content-mobile")) return
    if (element.classList.contains("search-match")) return

    Array.from(node.childNodes).forEach((child) => matchTextNodes(child, term))
  } else if (node.nodeType === Node.TEXT_NODE) {
    /* istanbul ignore next */
    const nodeText = node.nodeValue ?? ""
    // Normalize NBSP (U+00A0) to regular space so multi-word search terms
    // match across non-breaking spaces inserted by punctilio
    const normalizedText = nodeText.replace(/\u00A0/gu, " ")
    const sanitizedTerm = escapeRegExp(term)
    const regex = new RegExp(`(${sanitizedTerm})`, "gi")

    // Use a single split operation
    const parts = normalizedText.split(regex)
    if (parts.length === 1) return // No matches

    const fragment = document.createDocumentFragment()
    parts.forEach((part: string): void => {
      if (part.toLowerCase() === term.toLowerCase()) {
        fragment.appendChild(createMatchSpan(part))
      } else if (part) {
        fragment.appendChild(document.createTextNode(part))
      }
    })

    node.parentNode?.replaceChild(fragment, node)
  }
}

/**
 * Manages the lifecycle and rendering of the search result preview panel.
 * Creates an inner article element, fetches the target content, applies
 * matching, and handles show/hide/clear operations.
 */
export class PreviewManager {
  private container: HTMLDivElement
  private inner: HTMLElement
  private currentSlug: FullSlug | null = null

  constructor(container: HTMLDivElement) {
    this.container = container
    this.inner = document.createElement("article")
    this.inner.classList.add("search-preview")
    this.container.appendChild(this.inner)
  }

  /**
   * Update the preview panel to reflect the provided result element.
   * If no element is provided, the preview is hidden.
   *
   * @param el - The result card element corresponding to the hovered/active item
   * @param currentSearchTerm - The active search term used for matching
   * @param baseSlug - The current page's slug used to resolve relative links
   */
  /* istanbul ignore next */
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
    // skipcq: JS-0098
    void this.fetchAndUpdateContent(slug, currentSearchTerm, baseSlug)
  }

  /* istanbul ignore next */
  private async fetchAndUpdateContent(
    slug: FullSlug,
    currentSearchTerm: string,
    baseSlug: FullSlug,
  ) {
    /**
     * Fetch the content for a given slug and update the preview if it is still current.
     *
     * @private
     * @param slug - The content slug to fetch and preview
     * @param currentSearchTerm - The current search term for matching
     * @param baseSlug - The base slug to resolve relative URLs against
     */
    try {
      const { content, frontmatter } = await fetchContent(slug)

      // Only update if this is still the current preview we want
      if (this.currentSlug !== slug) {
        return
      }

      const useDropcap: boolean =
        !("no_dropcap" in frontmatter) || frontmatter.no_dropcap === "false"
      this.inner.setAttribute("data-use-dropcap", useDropcap.toString())

      // Create a document fragment to build content off-screen
      const fragment = document.createDocumentFragment()
      content.forEach((el) => {
        const matchedContent = matchHTML(currentSearchTerm, el as HTMLElement)
        fragment.appendChild(matchedContent)
      })

      // Clear existing content and append new content
      this.inner.innerHTML = ""
      this.inner.appendChild(fragment)

      // Set click handler
      this.inner.onclick = () => {
        const targetUrl = resolveSlug(slug, baseSlug)

        // Always delegate scroll targeting to SPA using the current search term.
        // SPA will re-run the same match logic and scroll to the first match.
        navigateWithSearchTerm(targetUrl.toString(), currentSearchTerm)
      }

      // Let images and other resources load naturally
      // Browser will handle loading these in the background
      this.scrollToFirstmatch()
    } catch (error) {
      console.error("Error loading preview:", error)
      if (this.currentSlug === slug) {
        this.inner.innerHTML = '<div class="preview-error">Error loading preview</div>'
      }
    }
  }

  // skipcq: JS-D1001
  /* istanbul ignore next */
  public show(): void {
    this.container.classList.add("active")
    this.container.style.visibility = "visible"
  }

  // skipcq: JS-D1001
  /* istanbul ignore next */
  public hide(): void {
    this.container.classList.remove("active")
    this.container.style.visibility = "hidden"
  }

  // skipcq: JS-D1001
  /* istanbul ignore next */
  public clear(): void {
    this.inner.innerHTML = ""
  }

  // skipcq: JS-D1001
  /* istanbul ignore next */
  public destroy(): void {
    this.inner.onclick = null
    this.inner.innerHTML = ""
    this.currentSlug = null
  }

  /**
   * Scroll the preview container to properly orient the first match in the viewport.
   */
  /* istanbul ignore next */
  private scrollToFirstmatch(): void {
    // Get only the first matching search-match without sorting
    const firstMatch = this.container.querySelector(".search-match") as HTMLElement
    if (!firstMatch) return

    this.container.scrollTop = getSearchMatchScrollPosition(firstMatch, this.container, 0.5)
  }
}

let previewManager: PreviewManager | null

/**
 * matchs search terms within HTML content while preserving HTML structure
 * @param searchTerm - Term to match
 * @param el - HTML element to search within
 * @returns DOM node with matched terms
 */
/* istanbul ignore next */
export function matchHTML(searchTerm: string, el: HTMLElement) {
  const tokenizedTerms = tokenizeTerm(searchTerm)
  // Clone the element to preserve DOM state (like checkbox checked property)
  const cloned = el.cloneNode(true) as HTMLElement

  for (const term of tokenizedTerms) {
    matchTextNodes(cloned, term)
  }

  return cloned
}

/**
 * Updates the search bar placeholder text based on screen width
 */
export function updatePlaceholder(searchBar?: HTMLInputElement | null) {
  if (!searchBar) return
  if (window.innerWidth > tabletBreakpoint) {
    searchBar?.setAttribute("placeholder", searchPlaceholderDesktop)
  } else {
    searchBar?.setAttribute("placeholder", searchPlaceholderMobile)
  }
}

async function maybeInitializeSearch(container: HTMLElement, searchBar: HTMLInputElement) {
  // Show the UI first for better UX
  const navbar = document.getElementById("navbar")
  if (navbar) {
    navbar.style.zIndex = "1"
  }
  container.classList.add("active")
  document.body.classList.add("no-mix-blend-mode")
  searchBar.focus()

  await initializeSearch()

  updatePlaceholder(searchBar)
  return
}

/**
 * Show the search UI and focus the search bar.
 * @param container - The search container element
 * @param searchBar - The input element used for search
 */
export async function showSearch(
  container: HTMLElement | null,
  searchBar: HTMLInputElement | null,
): Promise<undefined> {
  if (!container || !searchBar) return

  // Initialize search when opening the search UI
  if (!searchInitialized && !searchInitializing) {
    await maybeInitializeSearch(container, searchBar)
    return
  }

  const navbar = document.getElementById("navbar")
  if (navbar) {
    navbar.style.zIndex = "1"
  }

  container.classList.add("active")
  document.body.classList.add("no-mix-blend-mode")

  searchBar.focus()
  searchBar.select() // Needed for firefox

  updatePlaceholder(searchBar)
  syncSearchLayoutState()

  return
}

/**
 * Hides the search interface and resets its state
 */
export function hideSearch(previewManagerArg: PreviewManager | null) {
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
  if (previewManagerArg) {
    previewManagerArg.hide()
    // Ensure no residual information is left in the preview
    previewManagerArg.clear()
  }
}

let data: { [key: FullSlug]: ContentDetails } | undefined

// Test helper to set searchLayout for testing
export function setSearchLayoutForTesting(layout: HTMLElement | null) {
  searchLayout = layout
}
let results: HTMLElement
let preview: HTMLDivElement | undefined
let currentHover: HTMLElement | null = null
let currentSlug: FullSlug
let mouseEventsLocked = false

/* istanbul ignore next */
const appendLayout = (el: HTMLElement) => {
  /**
   * Append an element to the search layout if it is not already present.
   *
   * @param el - The element to append to the layout
   */
  if (searchLayout?.querySelector(`#${el.id}`) === null) {
    searchLayout?.appendChild(el)
  }
}

// Handle shortcuts for opening and closing the UI.
/* istanbul ignore next */
async function handleSearchToggle(
  e: KeyboardEvent,
  container: HTMLElement | null,
  searchBar: HTMLInputElement | null,
): Promise<boolean> {
  if (e.key !== "/") return false

  e.preventDefault()
  const searchBarOpen = container?.classList.contains("active")
  if (searchBarOpen) {
    hideSearch(previewManager)
  } else {
    await showSearch(container, searchBar)
  }

  return true
}

/**
 * Perform in-result navigation (arrow keys, Tab, Enter) when the search UI is
 * already open.
 */
/* istanbul ignore next */
async function handleResultNavigation(
  e: KeyboardEvent,
  container: HTMLElement | null,
  searchBar: HTMLInputElement | null,
): Promise<void> {
  // Abort early when search is not active
  if (!container?.classList.contains("active")) return

  /* skipcq: JS-D1001 */
  const prevSibling = (el: HTMLElement): HTMLElement | null =>
    el.previousElementSibling ? (el.previousElementSibling as HTMLElement) : null

  /* skipcq: JS-D1001 */
  const nextSibling = (el: HTMLElement): HTMLElement | null =>
    el.nextElementSibling ? (el.nextElementSibling as HTMLElement) : null

  const canNavigate = document.activeElement === searchBar || currentHover !== null

  /**
   * Focus a target result element and update the preview, if present.
   * Locks mouse events temporarily to prevent interference.
   *
   * @param target - The result card to focus and preview
   */
  const focusAndPreview = async (target: HTMLElement | null) => {
    if (!target) return

    // Lock mouse events during keyboard navigation
    mouseEventsLocked = true

    await displayPreview(target)

    // Unlock mouse events after a short delay
    setTimeout(() => {
      mouseEventsLocked = false
    }, mouseFocusDelay)
  }

  /**
   * Get the element to navigate to, handling the case when currentHover is null
   * by starting from the first result.
   */
  const getNavigationTarget = (
    getTarget: (el: HTMLElement) => HTMLElement | null,
  ): HTMLElement | null => {
    if (currentHover) {
      return getTarget(currentHover)
    }
    // If no current hover, start from the first result
    return document.getElementsByClassName("result-card")[0] as HTMLElement | null
  }

  switch (e.key) {
    case "Enter": {
      if (document.activeElement?.classList.contains("result-card")) {
        const active = document.activeElement as HTMLElement
        if (!active.classList.contains("no-match")) {
          active.click()
        }
        break
      }

      if (currentHover?.classList.contains("focus")) {
        currentHover.click()
        break
      }

      const first = document.getElementsByClassName("result-card")[0] as HTMLElement | null
      if (first && !first.classList.contains("no-match")) {
        await focusAndPreview(first)
        first.click()
      }
      break
    }

    case "ArrowUp": {
      e.preventDefault()
      if (canNavigate && currentHover) {
        const toShow = prevSibling(currentHover)
        if (toShow) {
          await focusAndPreview(toShow)
        }
      }
      break
    }

    case "ArrowDown": {
      e.preventDefault()
      if (canNavigate) {
        const toShow = getNavigationTarget(nextSibling)
        if (toShow) {
          await focusAndPreview(toShow)
        }
      }
      break
    }

    case "Tab": {
      e.preventDefault()
      if (!canNavigate) break
      const toShow = getNavigationTarget(e.shiftKey ? prevSibling : nextSibling)
      if (toShow) {
        await focusAndPreview(toShow)
      }
      break
    }

    default:
      // Other keys are ignored by navigation handler
      break
  }
}

/**
 * Keyboard shortcut handler for the search component. Delegates to smaller
 * helper functions to keep complexity manageable.
 */
/* istanbul ignore next */
async function shortcutHandler(
  e: KeyboardEvent,
  container: HTMLElement | null,
  searchBar: HTMLInputElement | null,
): Promise<void> {
  // First, deal with shortcuts that toggle the visibility of the search UI.
  if (await handleSearchToggle(e, container, searchBar)) return

  // Otherwise, handle navigation within an already open search UI.
  await handleResultNavigation(e, container, searchBar)
}

let cleanupListeners: (() => void) | undefined
/**
 * Handles navigation events by setting up search functionality
 * @param e - Navigation event
 */
/* istanbul ignore next */
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

  // Verify getContentIndex was injected by renderPage.tsx
  if (typeof getContentIndex !== "function") {
    throw new Error("getContentIndex not initialized - check script injection order")
  }

  data = await getContentIndex()
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
  addListener(
    searchIcon,
    "click",
    () => {
      showSearch(container, searchBar).catch((error) => {
        console.error("Failed to show search:", error)
      })
    },
    listeners,
  )
  addListener(searchBar, "input", debouncedOnType, listeners)
  addListener(
    searchBar,
    "focus",
    () => {
      if (!searchInitialized && !searchInitializing) {
        initializeSearch().catch((error) => {
          console.error("Failed to initialize search:", error)
        })
      }
    },
    listeners,
  )

  addListener(document, "visibilitychange", syncSearchLayoutState, listeners)

  const escapeCleanup = registerEscapeHandler(container, () => hideSearch(previewManager))
  listeners.add(escapeCleanup)

  cleanupListeners = () => {
    listeners.forEach((cleanup) => cleanup())
    listeners.clear()
  }
}

/**
 * Fetches and caches content for a given slug
 * Note: This function's correctness depends on the HTML structure of your content
 * and should be verified with your specific setup
 * @param slug - Page slug to fetch
 */
/* istanbul ignore next */
async function fetchContent(slug: FullSlug): Promise<FetchResult> {
  if (!fetchContentCache.has(slug)) {
    const fetchPromise = await (async () => {
      const targetUrl = new URL(resolveSlug(slug, currentSlug).toString())

      const html = await fetchHTMLContent(targetUrl)

      // Extract frontmatter
      const frontmatterScript = html.querySelector('script[type="application/json"]')
      const frontmatter = frontmatterScript ? JSON.parse(frontmatterScript.textContent || "{}") : {}

      // Extract previewable elements and restore checkbox states in one operation
      const contentElements = processPreviewables(html, targetUrl)

      return { content: contentElements, frontmatter }
    })()

    fetchContentCache.set(slug, Promise.resolve(fetchPromise))
  }

  return fetchContentCache.get(slug) ?? ({} as FetchResult)
}
/**
 * Visually and optionally programmatically focus a result card.
 *
 * @param el - The card element to focus
 * @param keyboardFocus - Whether to call focus() on the element
 */
/* istanbul ignore next */
async function focusCard(el: HTMLElement | null, keyboardFocus = true) {
  document.querySelectorAll(".result-card").forEach((card) => {
    card.classList.remove("focus")
  })

  if (el) {
    el.classList.add("focus")
    currentHover = el

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
/* istanbul ignore next */
async function displayPreview(el: HTMLElement | null, keyboardFocus = true) {
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
/* istanbul ignore next */
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
/* istanbul ignore next */
const getByField = (
  field: string,
  searchResults: FlexSearch.SimpleDocumentSearchResultSetUnit[],
): number[] => {
  const results = searchResults.filter((x) => x.field === field)
  return results.length === 0 ? [] : ([...results[0].result] as number[])
}

/**
 * Create the DOM element representing a single search result.
 *
 * @param slug - The result slug
 * @param title - The page title (may include match markup)
 * @param content - The content snippet (may include match markup)
 * @param enablePreview - Whether preview mode is enabled (controls snippet rendering)
 * @returns The anchor element for the result card
 */
/* istanbul ignore next */
const resultToHTML = ({ slug, title, content }: Item, enablePreview: boolean) => {
  const itemTile = document.createElement("a")
  itemTile.classList.add("result-card")
  itemTile.id = slug
  itemTile.href = resolveSlug(slug, currentSlug).toString()

  content = replaceEmojiConvertArrows(content)

  let suffixHTML = ""
  if (!enablePreview) {
    suffixHTML = `<p>${content}</p>`
  }
  itemTile.innerHTML = `<span class="h4">${title}</span><br/>${suffixHTML}`

  // On mobile/tablet, embed a small inline preview slice in each card
  if (enablePreview && window.innerWidth <= tabletBreakpoint) {
    const inlinePreview = document.createElement("div")
    inlinePreview.classList.add("inline-preview")
    itemTile.appendChild(inlinePreview)

    void fetchContent(slug as FullSlug).then(({ content: contentElements }) => {
      if (!contentElements) return
      const article = document.createElement("article")
      article.classList.add("search-preview")
      contentElements.forEach((el) => {
        article.appendChild(matchHTML(currentSearchTerm, el as HTMLElement))
      })
      inlinePreview.appendChild(article)

      // Scroll to first match so the relevant slice is visible
      const firstMatch = inlinePreview.querySelector(".search-match")
      if (firstMatch) {
        const matchOffset = (firstMatch as HTMLElement).offsetTop
        inlinePreview.scrollTop = Math.max(0, matchOffset - inlinePreview.clientHeight / 3)
      }
    })
  }

  // Handles the mouse enter event by displaying a preview for the hovered element if mouse events are not locked.
  async function onMouseEnter(ev: MouseEvent) {
    if (mouseEventsLocked) return
    if (!ev.currentTarget) return
    const target = ev.currentTarget as HTMLElement
    await displayPreview(target, false)
  }

  // Add mouse leave handler to maintain focus state
  function onMouseLeave() {
    if (mouseEventsLocked) return
    if (currentHover === itemTile) {
      currentHover = null
    }
  }

  itemTile.addEventListener("mouseenter", onMouseEnter)
  itemTile.addEventListener("mouseleave", onMouseLeave)
  itemTile.addEventListener("click", (e) => {
    e.preventDefault()
    navigateWithSearchTerm(itemTile.href, currentSearchTerm)
  })

  return itemTile
}

/**
 * Navigate to a URL with a text fragment hash for scroll targeting
 * @param href - The destination URL
 * @param searchTerm - The search term to highlight and scroll to
 */
export function navigateWithSearchTerm(href: string, searchTerm: string) {
  if (!searchTerm) {
    console.error(
      "[navigateWithSearchTerm] No search term available for result card navigation - this should not happen",
    )
  }

  const targetUrl = new URL(href)
  targetUrl.hash = `:~:text=${encodeURIComponent(searchTerm)}`
  hideSearch(null)
  window.spaNavigate(targetUrl)
}

/**
 * Formats search result data for display
 * @param term - Search term
 * @param id - Result ID
 * @param data - Content data
 * @param idDataMap - Mapping of IDs to slugs
 */
/* istanbul ignore next */
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
    title: match(term, data[slug].title ?? ""),
    content: match(term, data[slug].content ?? "", true),
    authors: data[slug].authors?.join(", "),
  }
}

/**
 * Displays search results in the UI
 * @param finalResults - Processed search results
 * @param results - Container element for results
 * @param enablePreview - Whether preview is enabled
 */
/* istanbul ignore next */
async function displayResults(
  finalResults: Item[],
  results: HTMLElement,
  enablePreview: boolean,
): Promise<void> {
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
/* istanbul ignore next */
async function onType(e: HTMLElementEventMap["input"]): Promise<void> {
  if (!searchLayout) return

  // Ensure search is initialized (waits if initialization is in progress)
  await initializeSearch()

  if (!index) return

  const enablePreview = searchLayout?.dataset?.preview === "true"
  currentSearchTerm = (e.target as HTMLInputElement).value
  searchLayout.classList.toggle("display-results", currentSearchTerm !== "")

  mouseEventsLocked = true
  const searchResults: FlexSearch.SimpleDocumentSearchResultSetUnit[] = await index.searchAsync({
    query: currentSearchTerm,
    limit: numSearchResults,
    index: ["title", "content", "slug", "authors"],
    bool: "or", // Appears in any of the fields
    suggest: false,
  })

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
    // skipcq: JS-0098
    void results.offsetHeight
  }

  await displayResults(finalResults, results, enablePreview)

  // Re-enable mouse after a short delay to prevent immediate hover selection
  setTimeout(() => {
    mouseEventsLocked = false
  }, mouseFocusDelay)
}

/**
 * Resolve a slug to an absolute URL based on the current page slug.
 *
 * @param slug - The target slug to resolve
 * @param currentSlug - The base slug representing the current page
 * @returns The resolved absolute URL
 */
/* istanbul ignore next */
function resolveSlug(slug: FullSlug, currentSlug: FullSlug): URL {
  return new URL(resolveRelative(currentSlug, slug), location.toString())
}

// skipcq: JS-D1001
/* istanbul ignore next */
export function setupSearch(): void {
  document.addEventListener("nav", onNav)
}

/**
 * Fills flexsearch document with data
 * @param index index to fill
 * @param data data to fill index with
 * @returns filled index
 */
/* istanbul ignore next */
async function fillDocument(data: { [key: FullSlug]: ContentDetails }): Promise<void> {
  if (!index) return

  const promises = Object.entries<ContentDetails>(data).map(([slug, fileData], id) => {
    if (!index) {
      throw new Error("Search index is not initialized")
    }
    return index.addAsync(id, {
      id,
      slug: slug as FullSlug,
      title: fileData.title,
      content: fileData.content,
      authors: fileData.authors?.join(", "),
    })
  })

  await Promise.all(promises)
}

/**
 * Lazy-initializes the search index on first interaction
 * Shows a loading indicator while initializing
 */
/* istanbul ignore next */
async function initializeSearch(): Promise<void> {
  // If already initialized, nothing to do
  if (searchInitialized) return

  // If initialization is in progress, wait for it to complete
  if (searchInitializing && initializationPromise) {
    await initializationPromise
    return
  }

  searchInitializing = true

  // Create a promise that other callers can await
  initializationPromise = (async () => {
    // Show loading indicator
    const searchBar = document.getElementById("search-bar") as HTMLInputElement
    if (!searchBar) {
      console.error("Can't locate the #search-bar element.")
      return
    }
    const originalPlaceholder = searchBar?.placeholder
    searchBar.placeholder = "Loading search..."

    try {
      // Create the index
      index = createSearchIndex()

      // Fetch and fill the index with data
      if (data) {
        await fillDocument(data)
      }

      searchInitialized = true
    } catch (error) {
      console.error("Error initializing search:", error)
      searchBar.placeholder = "Search failed to load."
    } finally {
      searchInitializing = false

      // Restore search bar state
      if (originalPlaceholder) {
        searchBar.placeholder = originalPlaceholder
      }
      updatePlaceholder(searchBar)

      // Ensure focus is maintained (needed for non-Chromium browsers)
      searchBar.focus()
    }
  })()

  await initializationPromise
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

/**
 * Compute the vertical offset of an element relative to a scrollable container.
 *
 * @param element - The element whose offset to compute
 * @param container - The container element used as the reference
 * @returns The offsetTop in pixels relative to the container
 */
export function getOffsetTopRelativeToContainer(
  element: HTMLElement,
  container: HTMLElement,
): number {
  let offsetTop = 0
  let currentElement: HTMLElement | null = element

  // Traverse up the DOM tree until we reach the container
  while (currentElement && currentElement !== container) {
    offsetTop += currentElement.offsetTop
    currentElement = currentElement.offsetParent as HTMLElement | null
  }

  return offsetTop
}

/**
 * Calculate scroll position to properly orient an element within its container
 * @param element - The element to position
 * @param container - The container to scroll
 * @param scrollFraction - Fraction (0-1) of container height from top where element should be positioned
 * @returns The scroll position for optimal element visibility
 */
export function getSearchMatchScrollPosition(
  element: HTMLElement,
  container: HTMLElement,
  scrollFraction: number,
): number {
  const offsetTop = getOffsetTopRelativeToContainer(element, container)
  return offsetTop - container.clientHeight * scrollFraction
}
