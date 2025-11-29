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
})()
