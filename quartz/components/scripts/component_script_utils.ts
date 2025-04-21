/**
 * Limits how often a function can be called. Once called, subsequent calls within
 * the delay period will be ignored or queued for the next frame.
 *
 * Example:
 * const throttledScroll = throttle(() => console.log('Scrolled!'), 100)
 * // Will only log once every 100ms no matter how often called
 */
export function throttle(func: () => void, delay: number) {
  // Track the animation frame ID to cancel if needed
  let frameId: number | null = null
  // Track when we last ran the function
  let lastRun = 0

  return () => {
    // If we're already waiting to run in next frame, skip
    if (frameId) return

    const now = performance.now()
    const timeSinceLastRun = now - lastRun

    // If enough time has passed, run immediately
    if (timeSinceLastRun >= delay) {
      func()
      lastRun = now
    } else {
      // Otherwise, schedule to run in next animation frame
      frameId = requestAnimationFrame(() => {
        frameId = null
        func()
        lastRun = performance.now()
      })
    }
  }
}

/**
 * Delays executing a function until after a period of no calls.
 * Useful for functions that shouldn't run until input has "settled".
 *
 * Example:
 * const debouncedSearch = debounce((e) => console.log('Searching...'), 500)
 * // Only runs after 500ms of no calls, cancelling previous pending calls
 *
 * @param func The function to debounce
 * @param wait Milliseconds to wait after last call before executing
 * @param immediate If true, execute on the first call instead of last
 */
export function debounce<Args extends unknown[], R>(
  func: (...args: Args) => R,
  wait: number,
  immediate = false,
): ((...args: Args) => void) & { cancel: () => void } {
  // Track the animation frame ID to cancel pending executions
  let frameId: number | null = null
  // Track the time of the last *invocation attempt*
  let lastCallTime = 0

  const debounced = function (this: unknown, ...args: Args) {
    const now = performance.now()
    const shouldCallImmediately = immediate && (lastCallTime === 0 || now - lastCallTime >= wait)

    // Always update the time of the last invocation attempt
    lastCallTime = now

    // Cancel any previously scheduled trailing edge call
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
      frameId = null
    }

    if (shouldCallImmediately) {
      // Execute immediately
      func.apply(this, args)
    } else if (!immediate) {
      // Schedule a trailing edge call only if immediate is false
      frameId = requestAnimationFrame(
        function checkTime(this: unknown) {
          // Use the lastCallTime captured in the outer scope
          const elapsed = performance.now() - lastCallTime
          if (elapsed < wait) {
            // Not enough time passed, check again next frame
            frameId = requestAnimationFrame(checkTime.bind(this))
          } else {
            // Enough time passed, execute the function
            frameId = null
            func.apply(this, args)
          }
        }.bind(this),
      )
    }
    // If immediate is true and shouldCallImmediately is false, we do nothing.
    // The function was called too recently, so we just wait for the next invocation attempt.
  }

  debounced.cancel = () => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
    }
    frameId = null
  }

  return debounced
}

/**
 * Registers click outside and escape key handlers for UI elements like modals.
 * When triggered, runs the provided callback.
 * @returns A cleanup function that removes the event listeners
 */
export function registerEscapeHandler(
  outsideContainer: HTMLElement | null,
  cb: () => void,
): () => void {
  if (!outsideContainer) return () => undefined

  // Handle clicks outside the container
  function click(e: MouseEvent) {
    if (e.target !== outsideContainer) return
    e.preventDefault()
    cb()
  }

  // Handle escape key presses
  function esc(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault()
      cb()
    }
  }

  outsideContainer.addEventListener("click", click)
  window.addEventListener("keydown", esc)

  // Return cleanup function
  return () => {
    outsideContainer.removeEventListener("click", click)
    window.removeEventListener("keydown", esc)
  }
}

export function removeAllChildren(node: HTMLElement) {
  while (node.firstChild) {
    node.removeChild(node.firstChild)
  }
}

/**
 * Temporarily disables all CSS transitions while executing an action.
 * Useful for preventing unwanted animations during DOM updates.
 *
 * @param action Function to execute with transitions disabled
 */
export const withoutTransition = (action: () => void) => {
  // Create style element to disable all transitions
  const style = document.createElement("style")
  style.textContent = `body * {
     -webkit-transition: none !important;
     -moz-transition: none !important;
     -o-transition: none !important;
     -ms-transition: none !important;   
      transition: none !important;
    }
  `

  const disableTransitions = () => document.head.appendChild(style)
  const enableTransitions = () => document.head.removeChild(style)

  // If getComputedStyle is available, use it to force a reflow
  if (typeof window.getComputedStyle !== "undefined") {
    disableTransitions()
    action()
    Object.assign({}, window.getComputedStyle(style)) // Force reflow
    enableTransitions()
    return
  }

  // Fallback if getComputedStyle isn't available
  disableTransitions()
  action()
  requestAnimationFrame(enableTransitions)
}

/**
 * Wraps a function to execute it with transitions temporarily disabled.
 * Also adds a temporary class during execution.
 *
 * @param func Function to wrap
 * @returns Wrapped function that handles transition disabling
 */
export function wrapWithoutTransition<Args extends unknown[], R>(
  func: (...args: Args) => R,
): (...args: Args) => R {
  return (...args) => {
    let result!: R
    document.documentElement.classList.add("temporary-transition")

    withoutTransition(() => {
      result = func(...args)
    })

    setTimeout(() => {
      document.documentElement.classList.remove("temporary-transition")
    }, 1000)

    return result
  }
}

/**
 * Helper function to handle requestAnimationFrame-based animations
 * @param duration Duration of the animation in milliseconds
 * @param onFrame Callback function called on each animation frame with progress (0 to 1)
 * @param onComplete Optional callback function called when animation completes
 * @returns Cleanup function to cancel the animation
 */
export function animate(
  duration: number,
  onFrame: (progress: number) => void,
  onComplete?: () => void,
): () => void {
  if (duration <= 0) {
    onFrame(1)
    onComplete?.()
    return () => undefined
  }

  let start: number | null = null
  let rafId: number | null = null

  const frame = (timestamp: number) => {
    if (!start) start = timestamp
    const elapsed = timestamp - start
    const progress = Math.min(elapsed / duration, 1)

    onFrame(progress)

    if (progress < 1) {
      rafId = requestAnimationFrame(frame)
    } else {
      onComplete?.()
    }
  }

  rafId = requestAnimationFrame(frame)

  // Return cleanup function
  return () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }
}
