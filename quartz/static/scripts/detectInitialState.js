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
  window.__quartz_collapsible_id = (slug, titleText) =>
    `${slug}-collapsible-${(titleText || "untitled")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50)}`

  // Apply saved collapsible state immediately when element is added to DOM
  function applyCollapsibleState(el) {
    const slug = document.body?.dataset?.slug
    if (!slug) return
    const id = window.__quartz_collapsible_id(
      slug,
      el.querySelector(".admonition-title")?.textContent?.trim() || "",
    )
    el.dataset.collapsibleId = id
    if (window.__quartz_collapsible_states.has(id)) {
      el.classList.toggle("is-collapsed", window.__quartz_collapsible_states.get(id))
    }
  }

  // MutationObserver to apply state before first paint
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue
        if (node.classList?.contains("is-collapsible")) applyCollapsibleState(node)
        node.querySelectorAll?.(".admonition.is-collapsible").forEach(applyCollapsibleState)
      }
    }
  })
  obs.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener("load", () => obs.disconnect(), { once: true })
})()
