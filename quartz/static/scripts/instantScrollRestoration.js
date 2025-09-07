;(function () {
  console.debug("[InstantScrollRestoration] Script loaded")

  // Force manual scroll restoration across all browsers
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual"
  }
  if ("scrollRestoration" in window) {
    window.scrollRestoration = "manual"
  }

  const savedScroll =
    history.state && typeof history.state.scroll === "number" ? history.state.scroll : null

  console.debug("[InstantScrollRestoration] savedScroll:", savedScroll, "hash:", location.hash)

  // Don't restore hash if we have a saved scroll position - user manually scrolled away
  const shouldRestoreHash = !savedScroll && location.hash.length > 1

  /**
   * Determine target scroll based on history state or hash.
   * Returns null if neither is applicable yet (e.g., hash element not in DOM yet).
   */
  function computeTarget() {
    // Always prioritize saved scroll position over hash
    if (savedScroll !== null) {
      console.debug("[InstantScrollRestoration] Using saved scroll:", savedScroll)
      return savedScroll
    }

    // Only restore hash if we should (no saved scroll position)
    if (shouldRestoreHash) {
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

  // Don't run during SPA navigation - let the SPA router handle scroll restoration
  if (window.__routerInitialized) {
    console.debug("[InstantScrollRestoration] SPA router detected, skipping instant restoration")
    return
  }

  // Only run restoration if we have something to restore
  if (savedScroll !== null || shouldRestoreHash) {
    tryScroll()
  } else {
    console.debug("[InstantScrollRestoration] Nothing to restore")
  }
})()
