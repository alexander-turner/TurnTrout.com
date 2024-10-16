const hamburger = document.querySelector(".hamburger")
const menu = document.querySelector(".menu")
const bars = document.querySelectorAll(".bar")

// Toggle menu visibility and animate hamburger icon when clicked
hamburger?.addEventListener("click", () => {
  menu?.classList.toggle("visible")
  bars.forEach((bar) => bar.classList.toggle("x")) // Hamburger animation
})

export function setupHamburgerMenu() {
  // Handle clicks outside the menu to close it
  document.addEventListener("click", (event) => {
    // Check if the menu is visible and the click is outside the menu and hamburger
    if (
      menu?.classList.contains("visible") &&
      !menu.contains(event.target as Node) &&
      !hamburger?.contains(event.target as Node)
    ) {
      // Hide the menu
      menu.classList.remove("visible")
      // Reset hamburger icon animation
      bars.forEach((bar) => bar.classList.remove("x"))
    }
  })
}
