;(function () {
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
  /**
   * Returns the computed scroll-margin-top (in px) for a given element.
   * Falls back to 0 if the property is unavailable or unparsable.
   */
  function getScrollMarginTop(elt) {
    if (!elt || typeof window === "undefined" || !window.getComputedStyle) return 0

    const style = window.getComputedStyle(elt)
    // Some browsers expose the camelCase property, others require the CSS name
    const raw = style.scrollMarginTop || style.getPropertyValue("scroll-margin-top")
    const parsed = parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : 0
  }

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
        const marginTop = getScrollMarginTop(elt)
        console.debug(
          "[InstantScrollRestoration] Hash target found:",
          target,
          "scroll-margin-top:",
          marginTop,
        )
        return target - marginTop
      } else {
        console.debug("[InstantScrollRestoration] Hash element not found yet:", id)
      }
    }
    return null
  }

  let attempts = 0
  const MAX_ATTEMPTS = 180 // 3 seconds @ 60fps

  // Flag & helper to mark programmatic scrolls so scroll listeners can ignore them
  let programmaticScroll = false

  function scrollToProgrammatic(y) {
    programmaticScroll = true
    window.scrollTo(0, y)
    // Reset flag on next frame; scroll event fires before this
    requestAnimationFrame(() => (programmaticScroll = false))
  }

  function tryScroll() {
    const target = computeTarget()
    console.debug(
      `[InstantScrollRestoration] Attempt ${attempts}, target:`,
      target,
      "current scrollY:",
      window.scrollY,
    )

    if (target !== null) {
      scrollToProgrammatic(target)
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

    // Track explicit user interaction separate from scroll events, since some browsers
    // may emit additional scroll events due to late layout shifts (e.g., Safari after
    // images load). We only treat a large scroll delta as a _user_ scroll if it was
    // preceded by an actual interaction such as wheel, touch, pointer, or key press.
    let userInteracted = false
    const markInteraction = () => {
      userInteracted = true
    }
    for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) {
      window.addEventListener(event, markInteraction, { passive: true, once: true })
    }

    // Track if we've already seen an unexplained large drift during the initial few frames.
    // Safari can briefly jump by a large amount while layout settles after reload, so we
    // allow one correction very early in the monitoring window before considering the
    // movement as user input. After the first few frames—or after some time has elapsed—
    // large deltas are treated as user-driven again.
    let largeDriftForgiven = false
    let scrollHandler
    const monitoringStart = performance.now()
    const cancelMonitoringDueToUser = () => {
      userHasScrolled = true
      console.debug("[InstantScrollRestoration] User scroll detected, canceling layout monitoring")
      window.removeEventListener("scroll", scrollHandler, { passive: true })
    }

    // Scroll handler for monitoring drift
    scrollHandler = () => {
      if (programmaticScroll) return

      const currentScroll = window.scrollY

      // Determine if this scroll likely originates from the user. Explicit interaction
      // (wheel/touch/pointer/keyboard) is a strong signal. In addition, repeated large
      // deltas without any recorded interaction are treated as user input, but the first
      // occurrence is forgiven to allow layout drift correction on Safari.
      const delta = Math.abs(currentScroll - targetPos)
      const SMALL_DELTA_THRESHOLD = 10 // px
      const LARGE_DELTA_THRESHOLD = 60 // px

      if (delta <= SMALL_DELTA_THRESHOLD) {
        largeDriftForgiven = false
        return
      }

      if (userInteracted) {
        cancelMonitoringDueToUser()
        return
      }

      if (delta > LARGE_DELTA_THRESHOLD) {
        const elapsed = performance.now() - monitoringStart
        const withinForgivenessWindow = !largeDriftForgiven && frameCount < 3 && elapsed < 150

        if (withinForgivenessWindow) {
          largeDriftForgiven = true
          return
        }

        cancelMonitoringDueToUser()
      }
    }

    window.addEventListener("scroll", scrollHandler, { passive: true })

    const monitorScroll = () => {
      // Cancel if user has started scrolling
      if (userHasScrolled) {
        window.removeEventListener("scroll", scrollHandler, { passive: true })
        console.log("[InstantScrollRestoration] Monitoring canceled due to user input")
        return
      }

      if (programmaticScroll) return

      const currentScroll = window.scrollY

      // Correct if we've drifted more than 2px from target
      if (Math.abs(currentScroll - targetPos) > 2) {
        console.debug(
          `[InstantScrollRestoration] Drift detected on frame ${frameCount}, correcting: ${currentScroll} → ${targetPos}`,
        )
        scrollToProgrammatic(targetPos)
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
