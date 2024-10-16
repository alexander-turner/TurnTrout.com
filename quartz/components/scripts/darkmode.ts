import { wrapWithoutTransition } from "./util"

export function setupDarkMode() {
  const emitThemeChangeEvent = (theme: "light" | "dark") => {
    const event: CustomEvent = new CustomEvent("themechange", {
      detail: { theme },
    })
    document.dispatchEvent(event)
  }

  const userPref = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
  const currentTheme = localStorage.getItem("theme") ?? userPref
  document.documentElement.setAttribute("saved-theme", currentTheme)

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
    if (currentTheme === "dark") {
      toggleSwitch.checked = true
    }

    // Listen for changes in prefers-color-scheme
    const colorSchemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    colorSchemeMediaQuery.addEventListener("change", themeChange)
  })
}
