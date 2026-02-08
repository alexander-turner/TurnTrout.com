const SCROLL_THRESHOLD = 1
const OVERLAY_SCROLLBAR_HEIGHT = 8
let observers: ResizeObserver[] = []
let abortController: AbortController | null = null

// Detect overlay scrollbars: they don't reduce clientWidth inside a scrollable element
function hasOverlayScrollbars(): boolean {
  const outer = document.createElement("div")
  outer.style.overflow = "scroll"
  outer.style.width = "50px"
  outer.style.height = "50px"
  outer.style.position = "absolute"
  outer.style.left = "-9999px"
  document.body.appendChild(outer)
  const overlay = outer.offsetWidth === outer.clientWidth
  document.body.removeChild(outer)
  return overlay
}

function updateIndicator(wrapper: HTMLElement, scrollable: HTMLElement) {
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

document.addEventListener("nav", () => {
  // Clean up previous observers and listeners
  for (const observer of observers) observer.disconnect()
  observers = []
  abortController?.abort()
  const controller = new AbortController()
  abortController = controller

  const overlay = hasOverlayScrollbars()
  const scrollables = document.querySelectorAll<HTMLElement>(".table-container, .katex-display")

  for (const el of scrollables) {
    // Skip if already wrapped from a previous navigation
    if (el.parentElement?.classList.contains("scroll-indicator")) continue
    if (!el.parentNode) continue

    const wrapper = document.createElement("div")
    wrapper.className = "scroll-indicator"
    el.parentNode.insertBefore(wrapper, el)
    wrapper.appendChild(el)

    const update = () => {
      // Keep fade above scrollbar so the scrollbar stays visible.
      // Overlay scrollbars (macOS default) don't reduce clientHeight,
      // so offsetHeight - clientHeight is 0; use a minimum instead.
      const isScrollable = el.scrollWidth > el.clientWidth
      const layoutScrollbarHeight = el.offsetHeight - el.clientHeight
      const scrollbarHeight =
        layoutScrollbarHeight > 0
          ? layoutScrollbarHeight
          : overlay && isScrollable
            ? OVERLAY_SCROLLBAR_HEIGHT
            : 0
      wrapper.style.setProperty("--scrollbar-height", `${scrollbarHeight}px`)
      updateIndicator(wrapper, el)
    }

    el.addEventListener("scroll", update, { passive: true, signal: controller.signal })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    observers.push(observer)
    update()
  }
})
