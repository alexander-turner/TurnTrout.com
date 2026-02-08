const SCROLL_THRESHOLD = 1

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
  const scrollables = document.querySelectorAll<HTMLElement>(".table-container, .katex-display")

  for (const el of scrollables) {
    // Skip if already wrapped from a previous navigation
    if (el.parentElement?.classList.contains("scroll-indicator")) continue

    const wrapper = document.createElement("div")
    wrapper.className = "scroll-indicator"
    el.parentNode!.insertBefore(wrapper, el)
    wrapper.appendChild(el)

    const update = () => updateIndicator(wrapper, el)

    el.addEventListener("scroll", update, { passive: true })
    new ResizeObserver(update).observe(el)
    update()
  }
})
