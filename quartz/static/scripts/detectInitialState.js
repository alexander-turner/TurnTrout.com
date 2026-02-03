;(() => {
  const themeMode = localStorage.getItem("saved-theme") || "auto"
  document.documentElement.setAttribute("data-theme-mode", themeMode)

  // Determine the actual theme to apply
  let actualTheme = themeMode
  if (themeMode === "auto") {
    const windowMatchMedia = window.matchMedia("(prefers-color-scheme: dark)")
    actualTheme = windowMatchMedia.matches ? "dark" : "light"
  }

  document.documentElement.setAttribute("data-theme", actualTheme)

  // Set theme label content in CSS custom property - show the mode, not the resolved theme
  document.documentElement.style.setProperty(
    "--theme-label-content",
    `"${themeMode[0].toUpperCase()}${themeMode.slice(1)}"`,
  )

  // Set video autoplay button state in CSS custom properties
  const autoplayEnabled = localStorage.getItem("pond-video-autoplay") === "true" // Default to true
  document.documentElement.style.setProperty(
    "--video-play-display",
    autoplayEnabled ? "none" : "block",
  )
  document.documentElement.style.setProperty(
    "--video-pause-display",
    autoplayEnabled ? "block" : "none",
  )

  // Pre-load checkbox states
  // Use Object.keys for better performance than iterating localStorage.length
  window.__quartz_checkbox_states = new Map()
  window.__quartz_collapsible_states = new Map()
  Object.keys(localStorage).forEach((key) => {
    if (key.includes("-checkbox-")) {
      window.__quartz_checkbox_states.set(key, localStorage.getItem(key) === "true")
    } else if (key.includes("-collapsible-")) {
      // Store whether the collapsible is collapsed (true = collapsed)
      window.__quartz_collapsible_states.set(key, localStorage.getItem(key) === "true")
    }
  })

  // Generate a stable collapsible ID based on slug and title (not index)
  window.__quartz_collapsible_id = function (slug, titleText) {
    // Normalize title: lowercase, remove special chars, limit length
    const normalizedTitle = (titleText || "untitled")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50)
    return `${slug}-collapsible-${normalizedTitle}`
  }

  // Apply saved collapsible state immediately when element is added to DOM
  // This prevents layout shift by applying state before first paint
  function applyCollapsibleState(element) {
    const slug = document.body?.dataset?.slug
    if (!slug) return

    const titleEl = element.querySelector(".admonition-title")
    const titleText = titleEl?.textContent?.trim() || ""
    const id = window.__quartz_collapsible_id(slug, titleText)

    element.dataset.collapsibleId = id

    if (window.__quartz_collapsible_states.has(id)) {
      const isCollapsed = window.__quartz_collapsible_states.get(id)
      if (isCollapsed) {
        element.classList.add("is-collapsed")
      } else {
        element.classList.remove("is-collapsed")
      }
    }
  }

  // Set up MutationObserver to catch collapsibles as they're added to DOM
  const collapsibleObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue

        // Check if the added node itself is a collapsible
        if (node.classList?.contains("is-collapsible")) {
          applyCollapsibleState(node)
        }

        // Check descendants for collapsibles
        if (node.querySelectorAll) {
          const collapsibles = node.querySelectorAll(".admonition.is-collapsible")
          collapsibles.forEach(applyCollapsibleState)
        }
      }
    }
  })

  // Start observing as soon as possible
  collapsibleObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })

  // Stop observing after page load to avoid performance overhead
  window.addEventListener(
    "load",
    () => {
      collapsibleObserver.disconnect()
    },
    { once: true },
  )
})()
