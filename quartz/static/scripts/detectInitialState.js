;(() => {
  let theme = localStorage.getItem("saved-theme") || "auto"
  document.documentElement.setAttribute("data-theme-mode", theme)

  // If the theme is auto, set it to the user's preference
  if (theme === "auto") {
    const userPref = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    theme = userPref
  }

  document.documentElement.setAttribute("data-theme", theme)

  // Update the theme label
  const themeLabel = document.querySelector("#theme-label")
  if (themeLabel) {
    themeLabel.textContent = theme.charAt(0).toUpperCase() + theme.slice(1)
  }

  // Set video autoplay button state
  const autoplayEnabled = localStorage.getItem("pond-video-autoplay") !== "false" // Default to true
  const button = document.querySelector("#video-toggle")
  const playIcon = document.querySelector("#play-icon")
  const pauseIcon = document.querySelector("#pause-icon")

  if (button && playIcon && pauseIcon) {
    button.setAttribute(
      "aria-label",
      autoplayEnabled ? "Disable video autoplay" : "Enable video autoplay",
    )
    console.debug("[DetectInitialState] Pond video autoplay enabled: ", autoplayEnabled)

    if (autoplayEnabled) {
      playIcon.style.display = "none"
      pauseIcon.style.display = "block"
    } else {
      playIcon.style.display = "block"
      pauseIcon.style.display = "none"
    }
  }
})()
