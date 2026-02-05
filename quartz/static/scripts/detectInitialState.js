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

  // Pre-load boolean states from localStorage into Maps
  const loadBooleanStates = (keyPattern) => {
    const states = new Map()
    for (const key of Object.keys(localStorage)) {
      if (key.includes(keyPattern)) states.set(key, localStorage.getItem(key) === "true")
    }
    return states
  }
  window.__quartz_checkbox_states = loadBooleanStates("-checkbox-")
  window.__quartz_collapsible_states = loadBooleanStates("-collapsible-")

  /** djb2 hash → 8-char hex. Exposed on window for reuse by other scripts. */
  window.__quartz_hash = (str) => {
    let hash = 5381
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    return (hash >>> 0).toString(16).padStart(8, "0")
  }

  const hashCounts = new Map()
  window.__quartz_reset_collapsible_counts = () => hashCounts.clear()

  /** Generates collapsible ID from content hash with index tiebreaker for duplicates. */
  window.__quartz_collapsible_id = (slug, content) => {
    const hash = window.__quartz_hash(content || "empty")
    const key = `${slug}-${hash}`
    const index = hashCounts.get(key) || 0
    hashCounts.set(key, index + 1)
    return `${slug}-collapsible-${hash}-${index}`
  }

  /** Applies saved state immediately when element added to DOM (prevents layout shift). */
  function applyCollapsibleState(element) {
    const slug = document.body?.dataset?.slug
    if (!slug) return
    const title = element.querySelector(".admonition-title")?.textContent?.trim() || ""
    const body = element.querySelector(".admonition-content")?.textContent?.trim() || ""
    element.dataset.collapsibleId = window.__quartz_collapsible_id(slug, title + body)
    if (window.__quartz_collapsible_states.has(element.dataset.collapsibleId))
      element.classList.toggle(
        "is-collapsed",
        window.__quartz_collapsible_states.get(element.dataset.collapsibleId),
      )
  }

  // MutationObserver applies saved state before first paint
  const collapsibleObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue
        if (node.classList?.contains("is-collapsible")) applyCollapsibleState(node)
        node.querySelectorAll?.(".admonition.is-collapsible").forEach(applyCollapsibleState)
      }
    }
  })
  collapsibleObserver.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener("load", () => collapsibleObserver.disconnect(), { once: true })

  // Restore checkbox states as soon as they appear in the DOM (before first paint)
  const restoreCheckboxState = (checkbox, index) => {
    const slug = document.body?.dataset?.slug
    if (!slug) return
    const checkboxId = `${slug}-checkbox-${index}`
    const savedState = window.__quartz_checkbox_states.get(checkboxId)
    if (savedState !== undefined) checkbox.checked = savedState
  }

  const checkboxObserver = new MutationObserver(() => {
    const checkboxes = document.querySelectorAll("input.checkbox-toggle")
    if (checkboxes.length > 0) checkboxes.forEach(restoreCheckboxState)
  })
  checkboxObserver.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener("load", () => checkboxObserver.disconnect(), { once: true })
})()
