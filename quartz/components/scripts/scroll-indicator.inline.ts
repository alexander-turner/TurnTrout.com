const SCROLL_THRESHOLD = 1
let observers: ResizeObserver[] = []
let abortController: AbortController | null = null

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
      // Keep fade above scrollbar so the scrollbar stays visible
      const scrollbarHeight = el.offsetHeight - el.clientHeight
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
