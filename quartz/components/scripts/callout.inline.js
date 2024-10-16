/**
 * Toggles the collapsed state of a callout.
 * @this {HTMLElement} The title element of the callout
 */
function toggleCallout() {
  const outerBlock = this.parentElement
  outerBlock.classList.toggle("is-collapsed")
}

/**
 * Initializes all collapsible callouts on the page.
 */
function setupCallout() {
  const collapsible = document.getElementsByClassName("callout is-collapsible")
  Array.from(collapsible).forEach(function (div) {
    const title = div.firstElementChild
    if (title) {
      title.addEventListener("click", toggleCallout)
    }
  })
}

document.addEventListener("nav", setupCallout)
