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

  /** Wrapped callable: schedules the trailing-edge call and may fire immediately on the leading edge. */
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
    console.debug("cancelling debounce")
    /* istanbul ignore next -- defensive null check for rAF cleanup */
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

/** Detaches every child of `node`. */
export function removeAllChildren(node: HTMLElement) {
  while (node.firstChild) {
    node.removeChild(node.firstChild)
  }
}

// Clipboard icon SVGs shared between code block copy buttons and punctilio demo
export const svgCopy =
  '<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true"><path fill-rule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"></path><path fill-rule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"></path></svg>'
export const svgCheck =
  '<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true"><path fill-rule="evenodd" fill="rgb(63, 185, 80)" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path></svg>'

/** How long the copy button shows the checkmark before reverting to the copy icon. */
export const COPY_BUTTON_RESET_DELAY_MS = 2000

/**
 * Sets up a clipboard copy button with icon swap animation.
 * Shared between code block copy buttons and the punctilio demo.
 */
export function setupCopyButton(
  button: HTMLButtonElement,
  getText: () => string,
  options?: AddEventListenerOptions,
): void {
  button.innerHTML = svgCopy
  button.addEventListener(
    "click",
    () => {
      navigator.clipboard.writeText(getText()).then(
        () => {
          button.blur()
          button.innerHTML = svgCheck
          setTimeout(() => {
            button.innerHTML = svgCopy
            button.style.borderColor = ""
          }, COPY_BUTTON_RESET_DELAY_MS)
        },
        (error) => console.error(error),
      )
    },
    options,
  )
}
