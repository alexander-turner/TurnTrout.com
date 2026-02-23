let collapsibleListenerActive = false

document.addEventListener("nav", function () {
  // Use event delegation instead of binding individual handlers
  // This avoids creating new functions for each collapsible element
  if (!collapsibleListenerActive) {
    document.addEventListener("click", function (e) {
      const title = e.target.closest(".collapsible-title")
      if (!title) return

      const collapsible = title.closest(".collapsible")
      if (!collapsible) return

      const foldIcon = collapsible.querySelector(".fold-icon")
      const content = collapsible.querySelector(".content")

      if (content && foldIcon) {
        content.classList.toggle("active")
        foldIcon.setAttribute("aria-expanded", content.classList.contains("active"))
      }
    })
    collapsibleListenerActive = true
  }
})
