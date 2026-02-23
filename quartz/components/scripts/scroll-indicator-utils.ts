export function wrapScrollables(container: HTMLElement, signal?: AbortSignal): ResizeObserver[] {
  const observers: ResizeObserver[] = []
  for (const el of container.querySelectorAll<HTMLElement>(".table-container, .katex-display")) {
    const parent = el.parentElement
    if (!parent || parent.classList.contains("scroll-indicator")) continue

    const wrapper = document.createElement("div")
    wrapper.className = "scroll-indicator"
    parent.insertBefore(wrapper, el)
    wrapper.appendChild(el)

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
    observers.push(observer)
    update()
  }
  return observers
}
