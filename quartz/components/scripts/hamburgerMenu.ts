let cleanupController: AbortController | null = null

export function setupHamburgerMenu() {
  if (cleanupController) {
    cleanupController.abort()
  }
  cleanupController = new AbortController()
  const { signal } = cleanupController

  const hamburger = document.querySelector("#menu-button")
  const menu = document.querySelector(".menu")
  const bars = document.querySelectorAll(".bar")

  function closeMenu() {
    menu?.classList.remove("visible")
    bars.forEach((bar) => bar.classList.remove("x"))
    updateAriaExpanded()
  }

  function updateAriaExpanded() {
    const isVisible = menu?.classList.contains("visible") ?? false
    hamburger?.setAttribute("aria-expanded", String(isVisible))
  }

  // Toggle menu visibility and animate hamburger icon when clicked
  hamburger?.addEventListener(
    "click",
    () => {
      menu?.classList.toggle("visible")
      bars.forEach((bar) => bar.classList.toggle("x"))
      updateAriaExpanded()
    },
    { signal },
  )

  // Handle clicks outside the menu to close it
  document.addEventListener(
    "click",
    (event) => {
      if (
        menu?.classList.contains("visible") &&
        !menu.contains(event.target as Node) &&
        !hamburger?.contains(event.target as Node)
      ) {
        closeMenu()
      }
    },
    { signal },
  )

  // Close menu on Escape key
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && menu?.classList.contains("visible")) {
        closeMenu()
        ;(hamburger as HTMLElement | null)?.focus()
      }
    },
    { signal },
  )
}
