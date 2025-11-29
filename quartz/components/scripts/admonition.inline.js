/**
 * Opens a collapsed admonition.
 * @param {Event} event The click event
 */
function openAdmonition(event) {
  const admonition = event.currentTarget
  if (admonition.classList.contains("is-collapsed")) {
    admonition.classList.remove("is-collapsed")
  }
}

/**
 * Closes an open admonition if clicked on title.
 * @param {Event} event The click event
 */
function closeAdmonition(event) {
  const title = event.currentTarget
  const admonition = title.parentElement
  if (!admonition.classList.contains("is-collapsed")) {
    admonition.classList.add("is-collapsed")
    event.stopPropagation()
  }
}

/**
 * Initializes all collapsible admonitions on the page.
 */
function setupAdmonition() {
  const collapsible = document.getElementsByClassName("admonition is-collapsible")
  Array.from(collapsible).forEach((div) => {
    // Add click handler to entire admonition for opening
    div.addEventListener("click", openAdmonition)

    // We don't want content to close because that'd be annoying if the user
    // clicks on the content while reading.
    const title = div.querySelector(".admonition-title")
    if (title) {
      title.addEventListener("click", closeAdmonition)
    }
  })
}

document.addEventListener("nav", setupAdmonition)
