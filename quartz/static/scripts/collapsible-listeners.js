function collapseHandler() {
  const foldIcon = this.querySelector(".fold-icon")
  const content = this.querySelector(".content")

  if (content && foldIcon) {
    content.classList.toggle("active")
    foldIcon.setAttribute("aria-expanded", content.classList.contains("active"))
  }
}

document.addEventListener("nav", function () {
  const collapsibles = document.getElementsByClassName("collapsible")

  for (const collapsible of collapsibles) {
    // Skip if handler already bound (prevents memory leak on repeated nav events)
    if (collapsible.dataset.collapsibleBound) continue

    const title = collapsible.querySelector(".collapsible-title")
    if (!title) continue

    title.addEventListener("click", collapseHandler.bind(collapsible))
    collapsible.dataset.collapsibleBound = "true"
  }
})
