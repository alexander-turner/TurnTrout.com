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
  Object.keys(localStorage).forEach((key) => {
    if (key.includes("-checkbox-")) {
      window.__quartz_checkbox_states.set(key, localStorage.getItem(key) === "true")
    }
  })

  // Restore checkbox states as soon as they appear in the DOM (before first paint)
  // This prevents a flash of incorrect checkbox state
  const restoreCheckboxState = (checkbox, index) => {
    const slug = document.body?.dataset?.slug
    if (!slug) return
    const checkboxId = `${slug}-checkbox-${index}`
    const savedState = window.__quartz_checkbox_states.get(checkboxId)
    if (savedState !== undefined) {
      checkbox.checked = savedState
    }
  }

  // Use MutationObserver to catch checkboxes as they're added to the DOM
  const observer = new MutationObserver(() => {
    const checkboxes = document.querySelectorAll("input.checkbox-toggle")
    if (checkboxes.length > 0) {
      checkboxes.forEach(restoreCheckboxState)
    }
  })

  // Start observing once the document element exists
  observer.observe(document.documentElement, { childList: true, subtree: true })

  // Clean up observer after page loads
  const cleanup = () => {
    observer.disconnect()
    // Final pass to ensure all checkboxes are restored
    const checkboxes = document.querySelectorAll("input.checkbox-toggle")
    checkboxes.forEach(restoreCheckboxState)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cleanup)
  } else {
    cleanup()
  }
})()
