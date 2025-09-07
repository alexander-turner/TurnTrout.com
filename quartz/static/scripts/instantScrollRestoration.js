;(function () {
  console.debug("[InstantScrollRestoration] Script loaded")

  window.scrollRestoration = "manual"
  history.scrollRestoration = "manual"

  const savedScroll =
    history.state && typeof history.state.scroll === "number" ? history.state.scroll : null

  console.debug("[InstantScrollRestoration] savedScroll:", savedScroll, "hash:", location.hash)

  /**
   * Determine target scroll based on history state or hash.
   * Returns null if neither is applicable yet (e.g., hash element not in DOM yet).
   */
  function computeTarget() {
    if (savedScroll !== null) {
      console.debug("[InstantScrollRestoration] Using saved scroll:", savedScroll)
      return savedScroll
    }

    if (location.hash.length > 1) {
      const id = decodeURIComponent(location.hash.slice(1))
      const elt = document.getElementById(id)
      if (elt) {
        const target = elt.getBoundingClientRect().top + window.scrollY
        console.debug("[InstantScrollRestoration] Hash target found:", target)
        return target
      } else {
        console.debug("[InstantScrollRestoration] Hash element not found yet:", id)
      }
    }
    return null
  }

  let attempts = 0
  const MAX_ATTEMPTS = 180 // 3 seconds @ 60fps

  function tryScroll() {
    const target = computeTarget()
    console.debug(
      `[InstantScrollRestoration] Attempt ${attempts}, target:`,
      target,
      "current scrollY:",
      window.scrollY,
    )

    if (target !== null) {
      window.scrollTo(0, target)
      const actualScroll = window.scrollY
      console.debug("[InstantScrollRestoration] Scrolled to:", actualScroll, "target was:", target)

      if (Math.abs(actualScroll - target) < 1 || attempts >= MAX_ATTEMPTS) {
        console.debug("[InstantScrollRestoration] Restoration complete")
        return // done
      }
    }

    attempts += 1
    if (attempts <= MAX_ATTEMPTS) {
      requestAnimationFrame(tryScroll)
    } else {
      console.debug("[InstantScrollRestoration] Max attempts reached, giving up")
    }
  }

  tryScroll()
})()
