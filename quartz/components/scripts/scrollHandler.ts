// Scrolling navbar
let prevScrollPos = window.scrollY
let isScrollingDown = false
let timeoutId: NodeJS.Timeout | null = null

function toggleShadowNavbar() {
  const navbar = document.querySelector("#navbar")
  if (!navbar) return
  navbar.classList.toggle("shadow", window.scrollY > 5)
}

const scrollDisplayUpdate = () => {
  const currentScrollPos = window.scrollY

  const navbar = document.querySelector("#navbar")
  if (!navbar) return

  toggleShadowNavbar()

  // Immediate update when reaching the top (within a small threshold)
  if (currentScrollPos <= 5) {
    navbar.classList.remove("hide-above-screen")
  } else {
    // Determine scroll direction
    isScrollingDown = currentScrollPos > prevScrollPos

    // Hide immediately on downward scroll, show immediately on upward scroll
    if (isScrollingDown) {
      navbar.classList.add("hide-above-screen")
    } else {
      navbar.classList.remove("hide-above-screen")
    }

    // Throttled update for shadow
    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        timeoutId = null // Reset throttle
      }, 250)
    }
  }

  prevScrollPos = currentScrollPos
}

// Event listeners
export function setupScrollHandler() {
  ;["scroll", "touchmove"].forEach((event: string) => {
    window.addEventListener(event, scrollDisplayUpdate)
  })
}
