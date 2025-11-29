export function setupScrollHandler() {
  let lastScrollY = window.scrollY
  let ticking = false
  const scrollThreshold = 50 // Minimum scroll distance before toggle
  const topThreshold = 50 // Show navbar when within 50px of top

  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const navbar = document.getElementById("navbar")
        if (!navbar) return

        const currentScrollY = window.scrollY
        const delta = currentScrollY - lastScrollY

        navbar.classList.toggle("shadow", window.scrollY > 5)

        if (Math.abs(delta) > scrollThreshold) {
          if (delta > 0) {
            navbar.classList.add("hide-above-screen")
          } else {
            navbar.classList.remove("hide-above-screen")
          }
          lastScrollY = currentScrollY
        }

        // Show navbar if close to top of page
        if (currentScrollY <= topThreshold) {
          navbar.classList.remove("hide-above-screen")
        }

        ticking = false
      })
      ticking = true
    }
  })
}
