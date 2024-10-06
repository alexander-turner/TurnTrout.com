import { wrapWithoutTransition } from "./util"
import { replaceEmojiConvertArrows } from "../../plugins/transformers/twemoji"

const hamburger = document.querySelector(".hamburger")
const menu = document.querySelector(".menu")

let bars = document.querySelectorAll(".bar")

// Toggle menu visibility and animate hamburger icon when clicked
hamburger?.addEventListener("click", () => {
  menu?.classList.toggle("visible")
  bars.forEach((bar) => bar.classList.toggle("x")) // Hamburger animation
})

// Handle clicks outside the menu to close it
document.addEventListener("click", (event) => {
  // Check if the menu is visible and the click is outside the menu and hamburger
  if (
    menu?.classList.contains("visible") &&
    !menu.contains(event.target as Node) &&
    !hamburger?.contains(event.target as Node)
  ) {
    // Hide the menu
    menu.classList.remove("visible")
    // Reset hamburger icon animation
    bars.forEach((bar) => bar.classList.remove("x"))
  }
})

// Darkmode handling
const userPref = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
const currentTheme = localStorage.getItem("theme") ?? userPref
document.documentElement.setAttribute("saved-theme", currentTheme)

const emitThemeChangeEvent = (theme: "light" | "dark") => {
  const event: CustomEvent = new CustomEvent("themechange", {
    detail: { theme },
  })
  document.dispatchEvent(event)
}

document.addEventListener("nav", () => {
  // Hide the description after the user has interacted with the toggle
  const descriptionParagraph = document.querySelector(".darkmode > .description")

  let switchTheme = (e: Event) => {
    const newTheme = (e.target as HTMLInputElement)?.checked ? "dark" : "light"
    document.documentElement.setAttribute("saved-theme", newTheme)
    localStorage.setItem("theme", newTheme)
    emitThemeChangeEvent(newTheme)

    // Toggle the label text
    if (localStorage.getItem("usedToggle") !== "true" && descriptionParagraph) {
      descriptionParagraph.classList.add("hidden")
    }
    // Prevent further clicks from having an effect
    localStorage.setItem("usedToggle", "true")
  }
  switchTheme = wrapWithoutTransition(switchTheme)

  window.addEventListener("load", function () {
    if (localStorage.getItem("usedToggle") !== "true") {
      descriptionParagraph?.classList.remove("hidden")
    }
  })

  let themeChange = (e: MediaQueryListEvent) => {
    const newTheme = e.matches ? "dark" : "light"
    document.documentElement.setAttribute("saved-theme", newTheme)
    localStorage.setItem("theme", newTheme)
    toggleSwitch.checked = e.matches
    emitThemeChangeEvent(newTheme)
  }
  themeChange = wrapWithoutTransition(themeChange)

  // Darkmode toggle
  const toggleSwitch = document.querySelector("#darkmode-toggle") as HTMLInputElement
  toggleSwitch.addEventListener("change", switchTheme)
  window.addCleanup(() => toggleSwitch.removeEventListener("change", switchTheme))
  if (currentTheme === "dark") {
    toggleSwitch.checked = true
  }

  // Listen for changes in prefers-color-scheme
  const colorSchemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
  colorSchemeMediaQuery.addEventListener("change", themeChange)
  window.addCleanup(() => colorSchemeMediaQuery.removeEventListener("change", themeChange))
})

// SEARCH

import FlexSearch from "flexsearch"
import { ContentDetails } from "../../plugins/emitters/contentIndex"
import { registerEscapeHandler, removeAllChildren } from "./util"
import { FullSlug, normalizeRelativeURLs, resolveRelative } from "../../util/path"

interface Item {
  id: number
  slug: FullSlug
  title: string
  content: string
  tags: string[]
}

// Can be expanded with things like "term" in the future
type SearchType = "basic" | "tags"
let searchType: SearchType = "basic"
let currentSearchTerm = ""
const encoder = (str: string) => str.toLowerCase().split(/([^a-z]|[^\x00-\x7F])/)
let index = new FlexSearch.Document<Item>({
  charset: "latin:extra",
  encode: encoder,
  document: {
    id: "id",
    tag: "tags",
    index: [
      {
        field: "title",
        tokenize: "forward",
      },
      {
        field: "content",
        tokenize: "forward",
      },
      {
        field: "tags",
        tokenize: "forward",
      },
    ],
  },
})

const p = new DOMParser()
const fetchContentCache: Map<FullSlug, any> = new Map()
const contextWindowWords = 30
const numSearchResults = 8
const numTagResults = 5

const tokenizeTerm = (term: string) => {
  const tokens = term.split(/\s+/).filter((t) => t.trim() !== "")
  const tokenLen = tokens.length
  if (tokenLen > 1) {
    for (let i = 1; i < tokenLen; i++) {
      tokens.push(tokens.slice(0, i + 1).join(" "))
    }
  }

  return tokens.sort((a, b) => b.length - a.length) // always highlight longest terms first
}

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

  return `${startIndex === 0 ? "" : "..."}${slice}${
    endIndex === tokenizedText.length - 1 ? "" : "..."
  }`
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function highlightHTML(searchTerm: string, el: HTMLElement) {
  const p = new DOMParser()
  const tokenizedTerms = tokenizeTerm(searchTerm)
  const html = p.parseFromString(el.innerHTML, "text/html")

  const createHighlightSpan = (text: string) => {
    const span = document.createElement("span")
    span.className = "highlight"
    span.textContent = text
    return span
  }

  const highlightTextNodes = (node: Node, term: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const sanitizedTerm = escapeRegExp(term)
      const nodeText = node.nodeValue ?? ""
      const regex = new RegExp(sanitizedTerm.toLowerCase(), "gi")
      const matches = nodeText.match(regex)
      if (!matches || matches.length === 0) return
      const spanContainer = document.createElement("span")
      let lastIndex = 0
      for (const match of matches) {
        const matchIndex = nodeText.indexOf(match, lastIndex)
        spanContainer.appendChild(document.createTextNode(nodeText.slice(lastIndex, matchIndex)))
        spanContainer.appendChild(createHighlightSpan(match))
        lastIndex = matchIndex + match.length
      }
      spanContainer.appendChild(document.createTextNode(nodeText.slice(lastIndex)))
      node.parentNode?.replaceChild(spanContainer, node)
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as HTMLElement).classList.contains("highlight")) return
      Array.from(node.childNodes).forEach((child) => highlightTextNodes(child, term))
    }
  }

  for (const term of tokenizedTerms) {
    highlightTextNodes(html.body, term)
  }

  return html.body
}

function updatePlaceholder() {
  const searchBar = document.getElementById("search-bar")
  const searchPlaceholderDesktop = "Toggle search by pressing /"
  const searchPlaceholderMobile = "Search"

  if (window.innerWidth > 1000) {
    // TODO come with better test
    // This is tablet width
    searchBar?.setAttribute("placeholder", searchPlaceholderDesktop)
  } else {
    searchBar?.setAttribute("placeholder", searchPlaceholderMobile)
  }
}

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const currentSlug = e.detail.url
  const data = await fetchData
  const container = document.getElementById("search-container")
  const searchIcon = document.getElementById("search-icon")
  const searchBar = document.getElementById("search-bar") as HTMLInputElement | null
  const searchLayout = document.getElementById("search-layout")
  const idDataMap = Object.keys(data) as FullSlug[]

  const appendLayout = (el: HTMLElement) => {
    if (searchLayout?.querySelector(`#${el.id}`) === null) {
      searchLayout?.appendChild(el)
    }
  }

  const enablePreview = searchLayout?.dataset?.preview === "true"
  let preview: HTMLDivElement | undefined = undefined
  let previewInner: HTMLDivElement | undefined = undefined
  const results = document.createElement("div")
  results.id = "results-container"
  appendLayout(results)

  if (enablePreview) {
    preview = document.createElement("div")
    preview.id = "preview-container"
    appendLayout(preview)
  }

  function hideSearch() {
    container?.classList.remove("active")
    document.body.classList.remove("no-mix-blend-mode") // Remove class when search is closed
    if (searchBar) {
      searchBar.value = "" // clear the input when we dismiss the search
    }
    if (results) {
      removeAllChildren(results)
    }
    if (preview) {
      removeAllChildren(preview)
    }
    if (searchLayout) {
      searchLayout.classList.remove("display-results")
    }

    searchType = "basic" // reset search type after closing
  }

  function showSearch(searchTypeNew: SearchType) {
    searchType = searchTypeNew
    const navbar = document.getElementById("navbar")
    if (navbar) {
      navbar.style.zIndex = "1"
    }
    container?.classList.add("active")
    document.body.classList.add("no-mix-blend-mode") // Add class when search is opened
    searchBar?.focus()
    updatePlaceholder()
  }

  let currentHover: HTMLInputElement | null = null

  async function shortcutHandler(e: HTMLElementEventMap["keydown"]) {
    if (e.key === "/") {
      e.preventDefault()
      const searchBarOpen = container?.classList.contains("active")
      searchBarOpen ? hideSearch() : showSearch("basic")
      return
    } else if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      // Hotkey to open tag search
      e.preventDefault()
      const searchBarOpen = container?.classList.contains("active")
      searchBarOpen ? hideSearch() : showSearch("tags")

      // add "#" prefix for tag search
      if (searchBar) searchBar.value = "#"
      return
    }

    if (currentHover) {
      currentHover.classList.remove("focus")
    }

    // If search is active, then we will render the first result and display accordingly
    if (!container?.classList.contains("active")) return
    if (e.key === "Enter") {
      // If result has focus, navigate to that one, otherwise pick first result
      if (results?.contains(document.activeElement)) {
        const active = document.activeElement as HTMLInputElement
        if (active.classList.contains("no-match")) return
        await displayPreview(active)
        active.click()
      } else {
        const anchor = document.getElementsByClassName("result-card")[0] as HTMLInputElement | null
        if (!anchor || anchor?.classList.contains("no-match")) return
        await displayPreview(anchor)
        anchor.click()
      }
    } else if (e.key === "ArrowUp" || (e.shiftKey && e.key === "Tab")) {
      e.preventDefault()
      if (results?.contains(document.activeElement)) {
        // If an element in results-container already has focus, focus previous one
        const currentResult = currentHover
          ? currentHover
          : (document.activeElement as HTMLInputElement | null)
        const prevResult = currentResult?.previousElementSibling as HTMLInputElement | null
        currentResult?.classList.remove("focus")
        prevResult?.focus()
        if (prevResult) currentHover = prevResult
        await displayPreview(prevResult)
      }
    } else if (e.key === "ArrowDown" || e.key === "Tab") {
      e.preventDefault()
      // The results should already been focused, so we need to find the next one.
      // The activeElement is the search bar, so we need to find the first result and focus it.
      if (document.activeElement === searchBar || currentHover !== null) {
        const firstResult = currentHover
          ? currentHover
          : (document.getElementsByClassName("result-card")[0] as HTMLInputElement | null)
        const secondResult = firstResult?.nextElementSibling as HTMLInputElement | null
        firstResult?.classList.remove("focus")
        secondResult?.focus()
        if (secondResult) currentHover = secondResult
        await displayPreview(secondResult)
      }
    }
  }

  const formatForDisplay = (term: string, id: number) => {
    const slug = idDataMap[id]
    return {
      id,
      slug,
      title: searchType === "tags" ? data[slug].title : highlight(term, data[slug].title ?? ""),
      content: highlight(term, data[slug].content ?? "", true),
      tags: highlightTags(term.substring(1), data[slug].tags),
    }
  }

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

  function resolveUrl(slug: FullSlug): URL {
    return new URL(resolveRelative(currentSlug, slug), location.toString())
  }

  const resultToHTML = ({ slug, title, content, tags }: Item) => {
    const htmlTags = tags.length > 0 ? `<ul class="tags">${tags.join("")}</ul>` : ""
    const itemTile = document.createElement("a")
    itemTile.classList.add("result-card")
    itemTile.id = slug
    itemTile.href = resolveUrl(slug).toString()

    content = replaceEmojiConvertArrows(content)
    itemTile.innerHTML = `<span class="h4">${title}</span><br/>${htmlTags}${
      enablePreview && window.innerWidth > 600 ? "" : `<p>${content}</p>`
    }`
    itemTile.addEventListener("click", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      hideSearch()
    })

    const handler = (event: MouseEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      hideSearch()
    }

    async function onMouseEnter(ev: MouseEvent) {
      if (!ev.target) return
      const target = ev.target as HTMLInputElement
      await displayPreview(target)
    }

    itemTile.addEventListener("mouseenter", onMouseEnter)
    window.addCleanup(() => itemTile.removeEventListener("mouseenter", onMouseEnter))
    itemTile.addEventListener("click", handler)
    window.addCleanup(() => itemTile.removeEventListener("click", handler))

    return itemTile
  }

  async function displayResults(finalResults: Item[]) {
    if (!results) return

    removeAllChildren(results)
    if (finalResults.length === 0) {
      results.innerHTML = `<a class="result-card no-match">
          <h3>No results.</h3>
          <p>Try another search term?</p>
      </a>`
    } else {
      results.append(...finalResults.map(resultToHTML))
    }

    if (finalResults.length === 0 && preview) {
      // no results, clear previous preview
      removeAllChildren(preview)
    } else {
      // focus on first result, then also dispatch preview immediately
      const firstChild = results.firstElementChild as HTMLElement
      firstChild.classList.add("focus")
      currentHover = firstChild as HTMLInputElement
      await displayPreview(firstChild)
    }
  }

  interface FetchResult {
    content: Element[]
    frontmatter: any
  }

  async function fetchContent(slug: FullSlug): Promise<FetchResult> {
    if (fetchContentCache.has(slug)) {
      return fetchContentCache.get(slug) as FetchResult
    }

    const targetUrl = resolveUrl(slug).toString()
    const contents = await fetch(targetUrl)
      .then((res) => res.text())
      .then((contents) => {
        if (contents === undefined) {
          throw new Error(`Could not fetch ${targetUrl}`)
        }
        const html = p.parseFromString(contents ?? "", "text/html")
        normalizeRelativeURLs(html, targetUrl)

        // Extract frontmatter
        const frontmatterScript = html.querySelector('script[type="application/json"]')
        const frontmatter = frontmatterScript
          ? JSON.parse(frontmatterScript.textContent || "{}")
          : {}

        const contentElements = [...html.getElementsByClassName("popover-hint")]

        return { content: contentElements, frontmatter }
      })

    fetchContentCache.set(slug, contents)
    return contents
  }

  async function displayPreview(el: HTMLElement | null) {
    if (!searchLayout || !enablePreview || !el || !preview) return
    const slug = el.id as FullSlug
    const { content, frontmatter } = await fetchContent(slug)
    const useDropcap = !frontmatter?.no_dropcap

    const innerDiv = content.flatMap((el) => [
      ...highlightHTML(currentSearchTerm, el as HTMLElement).children,
    ])

    previewInner = document.createElement("article" as "div")
    previewInner.classList.add("preview-inner")

    // Set data-use-dropcap attribute based on frontmatter
    previewInner.setAttribute("data-use-dropcap", useDropcap.toString())

    previewInner.append(...innerDiv)

    preview.replaceChildren(previewInner)

    // scroll to longest
    const highlights = [...preview.querySelectorAll(".highlight")].sort(
      (a, b) => b.innerHTML.length - a.innerHTML.length,
    )
    highlights[0]?.scrollIntoView({ block: "start" })
  }

  /**
   * Debounce function to limit the rate at which a function can fire.
   * @param func The function to debounce.
   * @param wait The number of milliseconds to delay.
   * @returns A debounced version of the passed function.
   */
  /**
   * Debounce function to limit the rate at which a function can fire.
   * Allows immediate execution on the first call if `immediate` is true.
   * @param func The function to debounce.
   * @param wait The number of milliseconds to delay.
   * @param immediate If true, trigger the function on the leading edge.
   * @returns A debounced version of the passed function.
   */
  function debounce<F extends (...args: any[]) => void>(
    func: F,
    wait: number,
    immediate: boolean = false,
  ): F {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    return function (this: any, ...args: any[]) {
      const context = this

      const later = () => {
        timeoutId = null
        if (!immediate) {
          func.apply(context, args)
        }
      }

      const callNow = immediate && timeoutId === null

      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(later, wait)

      if (callNow) {
        func.apply(context, args)
      }
    } as F
  }

  async function onType(e: HTMLElementEventMap["input"]) {
    if (!searchLayout || !index) return
    currentSearchTerm = (e.target as HTMLInputElement).value
    searchLayout.classList.toggle("display-results", currentSearchTerm !== "")
    searchType = currentSearchTerm.startsWith("#") ? "tags" : "basic"

    let searchResults: FlexSearch.SimpleDocumentSearchResultSetUnit[]
    if (searchType === "tags") {
      currentSearchTerm = currentSearchTerm.substring(1).trim()
      const separatorIndex = currentSearchTerm.indexOf(" ")
      if (separatorIndex != -1) {
        // search by title and content index and then filter by tag (implemented in flexsearch)
        const tag = currentSearchTerm.substring(0, separatorIndex)
        const query = currentSearchTerm.substring(separatorIndex + 1).trim()
        searchResults = await index.searchAsync({
          query: query,
          // return at least 10000 documents, so it is enough to filter them by tag (implemented in flexsearch)
          limit: Math.max(numSearchResults, 10000),
          index: ["title", "content"],
          tag: tag,
        })
        for (let searchResult of searchResults) {
          searchResult.result = searchResult.result.slice(0, numSearchResults)
        }
        // set search type to basic and remove tag from term for proper highlightning and scroll
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
        index: ["title", "content"],
      })
    }

    const getByField = (field: string): number[] => {
      const results = searchResults.filter((x) => x.field === field)
      return results.length === 0 ? [] : ([...results[0].result] as number[])
    }

    // order titles ahead of content
    const allIds: Set<number> = new Set([
      ...getByField("title"),
      ...getByField("content"),
      ...getByField("tags"),
    ])
    const finalResults = [...allIds].map((id) => formatForDisplay(currentSearchTerm, id))
    await displayResults(finalResults)
  }

  const debouncedOnType = debounce(onType, 50, true)

  document.addEventListener("keydown", shortcutHandler)
  window.addCleanup(() => document.removeEventListener("keydown", shortcutHandler))
  searchIcon?.addEventListener("click", () => showSearch("basic"))
  window.addCleanup(() => searchIcon?.removeEventListener("click", () => showSearch("basic")))
  searchBar?.addEventListener("input", debouncedOnType)
  window.addCleanup(() => searchBar?.removeEventListener("input", debouncedOnType))

  registerEscapeHandler(container, hideSearch)
  await fillDocument(data)
})

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
      }),
    )
  }

  return await Promise.all(promises)
}

// Scrolling navbar
let prevScrollPos = window.scrollY
let isScrollingDown = false
let timeoutId: NodeJS.Timeout | null = null

function toggleShadowNavbar() {
  const navbar = document.querySelector("#navbar")
  if (!navbar) return
  navbar.classList.toggle("shadow", window.scrollY > 5)
}

const scrollDisplayUpdate = () => {
  const currentScrollPos = window.scrollY

  const navbar = document.querySelector("#navbar")
  if (!navbar) return

  toggleShadowNavbar()

  // Immediate update when reaching the top (within a small threshold)
  if (currentScrollPos <= 5) {
    navbar.classList.remove("hide-above-screen")
  } else {
    // Determine scroll direction
    isScrollingDown = currentScrollPos > prevScrollPos

    // Hide immediately on downward scroll, show immediately on upward scroll
    if (isScrollingDown) {
      navbar.classList.add("hide-above-screen")
    } else {
      navbar.classList.remove("hide-above-screen")
    }

    // Throttled update for shadow
    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        timeoutId = null // Reset throttle
      }, 250)
    }
  }

  prevScrollPos = currentScrollPos
}

// Event listeners
;["scroll", "touchmove"].forEach((event: string) => {
  window.addEventListener(event, scrollDisplayUpdate)
})
