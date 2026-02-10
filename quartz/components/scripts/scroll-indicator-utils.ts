const SCROLL_THRESHOLD = 1

export function updateScrollIndicator(wrapper: HTMLElement, scrollable: HTMLElement): void {
  const { scrollLeft, scrollWidth, clientWidth } = scrollable
  if (scrollWidth <= clientWidth) {
    wrapper.classList.remove("can-scroll-left", "can-scroll-right")
    return
  }
  wrapper.classList.toggle("can-scroll-left", scrollLeft > SCROLL_THRESHOLD)
  wrapper.classList.toggle(
    "can-scroll-right",
    scrollLeft + clientWidth < scrollWidth - SCROLL_THRESHOLD,
  )
}

export interface ScrollIndicatorCleanup {
  disconnect: () => void
}

/**
 * Wraps scrollable elements (.table-container, .katex-display) within the
 * given container with scroll-indicator wrappers that show fade effects.
 * @param container - The container element to search within
 * @param signal - Optional AbortSignal to remove scroll event listeners
 * @returns A cleanup object to disconnect ResizeObservers
 */
export function wrapScrollables(
  container: HTMLElement,
  signal?: AbortSignal,
): ScrollIndicatorCleanup {
  const observers: ResizeObserver[] = []

  const scrollables = container.querySelectorAll<HTMLElement>(".table-container, .katex-display")

  for (const el of scrollables) {
    // Skip if already wrapped from a previous call
    if (el.parentElement?.classList.contains("scroll-indicator")) continue

    const wrapper = document.createElement("div")
    wrapper.className = "scroll-indicator"
    el.parentNode!.insertBefore(wrapper, el)
    wrapper.appendChild(el)

    const update = () => updateScrollIndicator(wrapper, el)

    el.addEventListener("scroll", update, { passive: true, signal })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    observers.push(observer)
    update()
  }

  return {
    disconnect() {
      for (const observer of observers) observer.disconnect()
    },
  }
}
