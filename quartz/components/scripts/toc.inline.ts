import {
  TOC_DETECTION_BAND_FRACTION,
  TOC_DETECTION_ROOT_MARGIN,
  TOC_MANUAL_SCROLL_GRACE_MS,
} from "../constants"
import { scrollActiveTocLinkIntoView } from "./toc-autoscroll-utils"

let tocAbortController: AbortController | null = null

function setupMobileTocClickDelegation(signal: AbortSignal): void {
  const mobileToc = document.getElementById("toc-content-mobile")
  if (!mobileToc) return

  mobileToc.addEventListener(
    "click",
    (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === "LI") {
        const link = target.querySelector<HTMLAnchorElement>(":scope > a")
        if (link) link.click()
      }
    },
    { signal },
  )
}

function setupTocTitleScrollToTop(signal: AbortSignal): void {
  const tocTitleButton = document.querySelector("#toc-title button")
  if (!tocTitleButton) return

  tocTitleButton.addEventListener(
    "click",
    () => {
      const url = new URL(window.location.pathname, window.location.origin)
      // skipcq: JS-0098 — fire-and-forget; void marks the intentionally floating promise
      void window.spaNavigate(url)
      window.scrollTo({ top: 0, behavior: "instant" })
    },
    { signal },
  )
}

function setupTocActiveHighlighting(signal: AbortSignal): void {
  if (window.tocObserver) {
    window.tocObserver.disconnect()
  }

  const allSections = document.querySelectorAll(
    "#center-content article h1, #center-content article h2",
  )
  const navLinks = document.querySelectorAll<HTMLAnchorElement>("#toc-content a")
  const navLinkArray = Array.from(navLinks)

  const navLinkSlugs = new Set(navLinkArray.map((l) => l.getAttribute("href")?.split("#")[1]))
  const sections = Array.from(allSections).filter(
    (section) => section.id && navLinkSlugs.has(section.id),
  )

  if (sections.length === 0 || navLinks.length === 0) return

  const sidebar = document.getElementById("right-sidebar")
  let isInitialUpdate = true
  let lastManualSidebarScroll = -Infinity

  if (sidebar) {
    const markManualScroll = () => {
      lastManualSidebarScroll = performance.now()
    }
    // Wheel / touch anywhere in the sidebar, or a drag on the scrollbar track
    // itself (target === sidebar, not a link), counts as manual browsing.
    sidebar.addEventListener("wheel", markManualScroll, { passive: true, signal })
    sidebar.addEventListener("touchmove", markManualScroll, { passive: true, signal })
    sidebar.addEventListener(
      "pointerdown",
      (event) => {
        if (event.target === sidebar) markManualScroll()
      },
      { signal },
    )
  }

  let currentSection = ""

  function updateActiveLink(newSection: string): void {
    if (newSection === currentSection) return
    currentSection = newSection

    navLinkArray.forEach((link) => {
      const slug = link.getAttribute("href")?.split("#")[1]
      link.classList.toggle("active", Boolean(currentSection && slug === currentSection))
    })

    // Follow the active link with the sidebar. Instant only on the first update
    // after a nav (nothing on screen to snap from); a smooth glide thereafter.
    const behavior: ScrollBehavior = isInitialUpdate ? "instant" : "auto"
    isInitialUpdate = false
    if (sidebar === null) return
    if (performance.now() - lastManualSidebarScroll < TOC_MANUAL_SCROLL_GRACE_MS) return
    const activeIndex = navLinkArray.findIndex(
      (link) => link.getAttribute("href")?.split("#")[1] === currentSection,
    )
    if (activeIndex === -1) return
    scrollActiveTocLinkIntoView(sidebar, navLinkArray, activeIndex, behavior)
  }

  const visibleSections = new Set<string>()

  const firstSectionId = sections[0]?.id

  // When no heading sits in the detection band (e.g. on a fresh load scrolled
  // partway down), fall back to the last heading scrolled above the band.
  function getActiveSectionByScroll(): string {
    const boundary = window.innerHeight * TOC_DETECTION_BAND_FRACTION
    let active = ""
    for (const section of sections) {
      if (section.getBoundingClientRect().top > boundary) break
      active = section.id
    }
    return active
  }

  function resolveActiveSection(): string {
    if (visibleSections.size > 0) {
      for (let i = sections.length - 1; i >= 0; i--) {
        if (visibleSections.has(sections[i].id)) return sections[i].id
      }
    }
    return getActiveSectionByScroll() || firstSectionId
  }

  const observerOptions: IntersectionObserverInit = {
    rootMargin: TOC_DETECTION_ROOT_MARGIN,
    threshold: 0,
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        visibleSections.add(entry.target.id)
      } else {
        visibleSections.delete(entry.target.id)
      }
    })

    updateActiveLink(resolveActiveSection())
  }, observerOptions)
  window.tocObserver = observer

  sections.forEach((section) => observer.observe(section))

  const hash = window.location.hash.slice(1)
  if (hash) {
    updateActiveLink(hash)
  } else if (firstSectionId) {
    updateActiveLink(resolveActiveSection())
  }
}

document.addEventListener("nav", () => {
  tocAbortController?.abort()
  tocAbortController = new AbortController()
  const { signal } = tocAbortController

  setupMobileTocClickDelegation(signal)
  setupTocTitleScrollToTop(signal)
  setupTocActiveHighlighting(signal)
})
