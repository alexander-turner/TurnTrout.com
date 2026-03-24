export function setupScrollHandler() {
  let lastScrollY = window.scrollY
  let ticking = false
  const scrollThreshold = 50 // Minimum scroll distance before toggle
  const topThreshold = 50 // Show navbar when within 50px of top

  const printQuery = window.matchMedia("print")

  // Track print state via events — printQuery.matches may lag behind the
  // layout reflow that fires scroll events when entering/exiting print mode.
  let isPrinting = false
  window.addEventListener("beforeprint", () => {
    isPrinting = true
  })
  window.addEventListener("afterprint", () => {
    isPrinting = false
  })

  window.addEventListener("scroll", () => {
    if (!ticking && !isPrinting && !printQuery.matches) {
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
