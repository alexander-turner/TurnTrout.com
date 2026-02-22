import { savedThemeKey } from "../constants"

export type Theme = "light" | "dark" | "auto"

/* istanbul ignore next: Browser API, tested in darkmode.spec.ts */
/**
 * Determines the system's color scheme preference
 * @returns The system's preferred theme ('light' or 'dark')
 */
export function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/* istanbul ignore next: DOM manipulation, tested in darkmode.spec.ts */
/**
 * Updates the theme text in the toggle button
 * @param theme - The current theme
 */
function updateThemeLabel(theme: Theme) {
  const themeLabel = theme.charAt(0).toUpperCase() + theme.slice(1)

  // Update CSS custom property - the CSS ::after will display this content
  document.documentElement.style.setProperty("--theme-label-content", `"${themeLabel}"`)
}

/* istanbul ignore next: DOM manipulation, tested in darkmode.spec.ts */
/**
 * Updates the DOM to reflect the current theme state
 * @param theme - The theme to apply
 */
function setThemeClassOnRoot(theme: Theme) {
  document.documentElement.setAttribute("data-theme-mode", theme)
  const themeToApply = theme === "auto" ? getSystemTheme() : theme
  document.documentElement.setAttribute("data-theme", themeToApply)
}

/* istanbul ignore next: localStorage API, tested in darkmode.spec.ts */
/**
 * Updates the theme state and related UI elements
 * @param theme - The theme state to apply
 */
export function handleThemeUpdate(theme: Theme): void {
  localStorage.setItem(savedThemeKey, theme)
  setThemeClassOnRoot(theme)
  updateThemeLabel(theme)
}

/* istanbul ignore next: localStorage API, tested in darkmode.spec.ts */
const getNextTheme = (): Theme => {
  const currentTheme = localStorage.getItem(savedThemeKey) || "auto"
  let nextTheme: Theme

  switch (currentTheme) {
    case "auto":
      nextTheme = "light"
      break
    case "light":
      nextTheme = "dark"
      break
    case "dark":
      nextTheme = "auto"
      break
    default:
      nextTheme = "auto"
  }

  return nextTheme
}

/**
 * Cycles through theme states in the order: auto -> light -> dark -> auto
 */
export const rotateTheme = () => {
  const nextTheme = getNextTheme()
  handleThemeUpdate(nextTheme)
}

/* istanbul ignore next: localStorage API, tested in darkmode.spec.ts */
/**
 * Initializes the dark mode functionality:
 * - Sets up initial theme based on saved preference or auto mode
 * - Configures theme toggle click handler
 * - Sets up system preference change listener
 * - Manages theme label based on current theme
 */
function setupDarkMode() {
  const savedTheme = localStorage.getItem(savedThemeKey)
  const theme = savedTheme || "auto"
  handleThemeUpdate(theme as Theme)

  const toggle = document.querySelector("#theme-toggle") as HTMLButtonElement
  if (toggle) {
    toggle.addEventListener("click", rotateTheme)
  }

  /**
   * Handles system color scheme preference changes
   * @param e - MediaQueryList event containing the new preference
   */
  function doSystemPreference(e: MediaQueryListEvent): void {
    const savedTheme = localStorage.getItem(savedThemeKey)
    if (savedTheme === "auto") {
      const newTheme = e.matches ? "dark" : "light"
      document.documentElement.setAttribute("data-theme", newTheme)
    }
  }

  const colorSchemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
  colorSchemeMediaQuery.addEventListener("change", doSystemPreference)

  document.addEventListener("nav", () => {
    // Update theme state after navigation
    const currentTheme = localStorage.getItem(savedThemeKey) || "auto"
    setThemeClassOnRoot(currentTheme as Theme)
    updateThemeLabel(currentTheme as Theme)
  })
}

export { setupDarkMode }
