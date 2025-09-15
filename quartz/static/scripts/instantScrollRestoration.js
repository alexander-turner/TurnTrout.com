;(function () {
  console.debug("[InstantScrollRestoration] Script loaded")

  // Force manual scroll restoration across all browsers
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual"
  }
  if ("scrollRestoration" in window) {
    window.scrollRestoration = "manual"
  }

  // Firefox sometimes loses history.state on reload, so check multiple sources
  let savedScroll = null
  if (history.state && typeof history.state.scroll === "number") {
    savedScroll = history.state.scroll
  } else if (window.history.state && typeof window.history.state.scroll === "number") {
    savedScroll = window.history.state.scroll
  } else if (typeof Storage !== "undefined") {
    // Fallback for Firefox: check sessionStorage
    const sessionScroll = sessionStorage.getItem("instantScrollRestore")
    if (sessionScroll) {
      const parsed = parseInt(sessionScroll, 10)
      if (!isNaN(parsed)) {
        savedScroll = parsed
        console.debug("[InstantScrollRestoration] Using sessionStorage fallback:", savedScroll)
        // Clear it after use to avoid stale data
        sessionStorage.removeItem("instantScrollRestore")
      }
    }
  }

  console.debug("[InstantScrollRestoration] savedScroll:", savedScroll, "hash:", location.hash)

  // Don't restore hash if we have a saved scroll position - user manually scrolled away
  const shouldRestoreHash = !savedScroll && location.hash.length > 1
  const BASE_MARGIN = 12 // px
  const SCROLL_MARGIN_TOP = 6 * BASE_MARGIN // defined in base.scss

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
        return target - SCROLL_MARGIN_TOP
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
        console.debug(
          "[InstantScrollRestoration] Initial scroll complete, waiting for layout stability",
        )
        waitForLayoutStability(target)
        return // done with initial attempts
      }
    }

    attempts += 1
    if (attempts <= MAX_ATTEMPTS) {
      requestAnimationFrame(tryScroll)
    } else {
      console.debug("[InstantScrollRestoration] Max attempts reached, giving up")
    }
  }

  function waitForLayoutStability(targetPos) {
    // Monitor for a few frames to catch Firefox layout drift
    let frameCount = 0
    const MAX_MONITOR_FRAMES = 15 // A few more frames to catch late drift
    let userHasScrolled = false

    // Track user scroll events to cancel monitoring
    const scrollHandler = () => {
      const currentScroll = window.scrollY
      // Only consider it user scrolling if it's significantly different from our target
      // and not just a small drift we're correcting
      if (Math.abs(currentScroll - targetPos) > 10) {
        userHasScrolled = true
        console.debug(
          "[InstantScrollRestoration] User scroll detected, canceling layout monitoring",
        )
        window.removeEventListener("scroll", scrollHandler, { passive: true })
      }
    }

    window.addEventListener("scroll", scrollHandler, { passive: true })

    const monitorScroll = () => {
      // Cancel if user has started scrolling
      if (userHasScrolled) {
        window.removeEventListener("scroll", scrollHandler, { passive: true })
        console.debug("[InstantScrollRestoration] Monitoring canceled due to user input")
        return
      }

      const currentScroll = window.scrollY

      // Correct if we've drifted more than 2px from target
      if (Math.abs(currentScroll - targetPos) > 2) {
        console.debug(
          `[InstantScrollRestoration] Drift detected on frame ${frameCount}, correcting: ${currentScroll} → ${targetPos}`,
        )
        window.scrollTo(0, targetPos)
      }

      frameCount++

      if (frameCount < MAX_MONITOR_FRAMES) {
        requestAnimationFrame(monitorScroll)
      } else {
        window.removeEventListener("scroll", scrollHandler, { passive: true })
        console.debug("[InstantScrollRestoration] Monitoring complete")
      }
    }

    requestAnimationFrame(monitorScroll)
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
