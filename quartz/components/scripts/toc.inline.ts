function setupMobileTocClickDelegation(): void {
  const mobileToc = document.getElementById("toc-content-mobile")
  if (!mobileToc) return

  mobileToc.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === "LI") {
      const link = target.querySelector<HTMLAnchorElement>(":scope > a")
      if (link) link.click()
    }
  })
}

function setupTocTitleScrollToTop(): void {
  const tocTitleButton = document.querySelector("#toc-title button")
  if (!tocTitleButton) return

  tocTitleButton.addEventListener("click", () => {
    const url = new URL(window.location.pathname, window.location.origin)
    window.spaNavigate(url)
    window.scrollTo({ top: 0, behavior: "instant" })
  })
}

function setupTocActiveHighlighting(): void {
  if (window.tocObserver) {
    window.tocObserver.disconnect()
  }

  const allSections = document.querySelectorAll(
    "#center-content article h1, #center-content article h2",
  )
  const navLinks = document.querySelectorAll("#toc-content a")

  const navLinkSlugs = new Set(
    Array.from(navLinks).map((l) => l.getAttribute("href")?.split("#")[1]),
  )
  const sections = Array.from(allSections).filter(
    (section) => section.id && navLinkSlugs.has(section.id),
  )

  if (sections.length === 0 || navLinks.length === 0) return

  let currentSection = ""

  function updateActiveLink(newSection: string): void {
    if (newSection === currentSection) return
    currentSection = newSection

    navLinks.forEach((link) => {
      const slug = link.getAttribute("href")?.split("#")[1]
      link.classList.toggle("active", Boolean(currentSection && slug === currentSection))
    })
  }

  const visibleSections = new Set<string>()

  const observerOptions: IntersectionObserverInit = {
    rootMargin: "0px 0px -70% 0px",
    threshold: 0,
  }

  window.tocObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        visibleSections.add(entry.target.id)
      } else {
        visibleSections.delete(entry.target.id)
      }
    })

    if (visibleSections.size > 0) {
      for (let i = sections.length - 1; i >= 0; i--) {
        if (visibleSections.has(sections[i].id)) {
          updateActiveLink(sections[i].id)
          return
        }
      }
    }
  }, observerOptions)

  sections.forEach((section) => window.tocObserver!.observe(section))

  const hash = window.location.hash.slice(1)
  const firstSectionId = sections[0]?.id
  if (hash || firstSectionId) {
    updateActiveLink(hash || firstSectionId)
  }
}

document.addEventListener("nav", () => {
  setupMobileTocClickDelegation()
  setupTocTitleScrollToTop()
  setupTocActiveHighlighting()
})
