function attachScrollListeners(
  wrapper: HTMLElement,
  scrollable: HTMLElement,
  signal?: AbortSignal,
): ResizeObserver {
  const update = () => {
    const { scrollLeft, scrollWidth, clientWidth } = scrollable
    const overflows = scrollWidth > clientWidth
    wrapper.classList.toggle("can-scroll-left", overflows && scrollLeft > 1)
    wrapper.classList.toggle(
      "can-scroll-right",
      overflows && scrollLeft + clientWidth < scrollWidth - 1,
    )
  }

  scrollable.addEventListener("scroll", update, { passive: true, signal })
  const observer = new ResizeObserver(update)
  observer.observe(scrollable)
  update()
  return observer
}

export function wrapScrollables(container: HTMLElement, signal?: AbortSignal): ResizeObserver[] {
  const observers: ResizeObserver[] = []
  for (const scrollable of container.querySelectorAll<HTMLElement>(
    ".table-container, .katex-display",
  )) {
    const parent = scrollable.parentElement
    if (!parent) continue

    // Already wrapped (e.g. cloned from server-rendered HTML) — just re-attach listeners
    if (parent.classList.contains("scroll-indicator")) {
      observers.push(attachScrollListeners(parent, scrollable, signal))
      continue
    }

    const wrapper = document.createElement("div")
    wrapper.className = "scroll-indicator"
    parent.insertBefore(wrapper, scrollable)
    wrapper.appendChild(scrollable)

    observers.push(attachScrollListeners(wrapper, scrollable, signal))
  }
  return observers
}
