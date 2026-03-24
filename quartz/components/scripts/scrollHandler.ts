export function setupScrollHandler() {
  let lastScrollY = window.scrollY
  let ticking = false
  const scrollThreshold = 50 // Minimum scroll distance before toggle
  const topThreshold = 50 // Show navbar when within 50px of top

  // printQuery.matches may lag behind the layout reflow that fires scroll
  // events when entering/exiting print mode, so track via events too.
  const printQuery = window.matchMedia("print")
  let isPrinting = false
  window.addEventListener("beforeprint", () => (isPrinting = true))
  window.addEventListener("afterprint", () => (isPrinting = false))

  function updateNavbar() {
    const navbar = document.getElementById("navbar")
    if (!navbar) return

    const currentScrollY = window.scrollY
    const delta = currentScrollY - lastScrollY

    navbar.classList.toggle("shadow", currentScrollY > 5)

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
      if (ticking || isPrinting || printQuery.matches) return
      ticking = true
      window.requestAnimationFrame(updateNavbar)
    },
    { passive: true },
  )
}
