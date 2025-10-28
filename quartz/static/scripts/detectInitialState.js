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
  window.__quartz_checkbox_states = new Map()
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.includes("-checkbox-")) {
      window.__quartz_checkbox_states.set(key, localStorage.getItem(key) === "true")
    }
  }

  console.debug(
    "[DetectInitialState] Theme mode:",
    themeMode,
    "Actual theme:",
    actualTheme,
    "Video autoplay enabled:",
    autoplayEnabled,
    "Checkbox states loaded:",
    window.__quartz_checkbox_states.size,
  )
})()
