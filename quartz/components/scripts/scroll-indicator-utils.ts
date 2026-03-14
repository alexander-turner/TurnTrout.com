function attachScrollListeners(
  wrapper: HTMLElement,
  el: HTMLElement,
  signal?: AbortSignal,
): ResizeObserver {
  const update = () => {
    const { scrollLeft, scrollWidth, clientWidth } = el
    const overflows = scrollWidth > clientWidth
    wrapper.classList.toggle("can-scroll-left", overflows && scrollLeft > 1)
    wrapper.classList.toggle(
      "can-scroll-right",
      overflows && scrollLeft + clientWidth < scrollWidth - 1,
    )
  }

  el.addEventListener("scroll", update, { passive: true, signal })
  const observer = new ResizeObserver(update)
  observer.observe(el)
  update()
  return observer
}

export function wrapScrollables(container: HTMLElement, signal?: AbortSignal): ResizeObserver[] {
  const observers: ResizeObserver[] = []
  for (const el of container.querySelectorAll<HTMLElement>(".table-container, .katex-display")) {
    const parent = el.parentElement
    if (!parent) continue

    // Already wrapped (e.g. cloned from server-rendered HTML) — just re-attach listeners
    if (parent.classList.contains("scroll-indicator")) {
      observers.push(attachScrollListeners(parent, el, signal))
      continue
    }

    const wrapper = document.createElement("div")
    wrapper.className = "scroll-indicator"
    parent.insertBefore(wrapper, el)
    wrapper.appendChild(el)

    observers.push(attachScrollListeners(wrapper, el, signal))
  }
  return observers
}
