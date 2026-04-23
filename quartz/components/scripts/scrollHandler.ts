import { isPrinting } from "./printState"

export function setupScrollHandler() {
  let lastScrollY = window.scrollY
  let ticking = false
  const scrollThreshold = 50 // Minimum scroll distance before toggle
  const topThreshold = 50 // Show navbar when within 50px of top
  const shadowThreshold = 5 // Show shadow once scrolled past top

  function updateNavbar() {
    const navbar = document.getElementById("navbar")
    if (!navbar) return

    const currentScrollY = window.scrollY
    const delta = currentScrollY - lastScrollY

    navbar.classList.toggle("shadow", currentScrollY > shadowThreshold)

    if (Math.abs(delta) > scrollThreshold) {
      navbar.classList.toggle("hide-above-screen", delta > 0)
      lastScrollY = currentScrollY
    }

    if (currentScrollY <= topThreshold) {
      navbar.classList.remove("hide-above-screen")
    }

    ticking = false
  }

  window.addEventListener(
    "scroll",
    () => {
      if (ticking || isPrinting()) return
      ticking = true
      window.requestAnimationFrame(updateNavbar)
    },
    { passive: true },
  )
}
