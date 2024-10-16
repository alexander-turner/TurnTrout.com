function collapseHandler() {
  const foldIcon = this.querySelector(".fold-icon")
  const content = this.querySelector(".content")

  content?.classList.toggle("active")
  foldIcon.setAttribute("aria-expanded", content.classList.contains("active"))
}

document.addEventListener("nav", function () {
  let collapsibles = document.getElementsByClassName("collapsible")

  for (let collapsible of collapsibles) {
    const title = collapsible.querySelector(".collapsible-title")
    title.addEventListener("click", collapseHandler.bind(collapsible))
  }
})
