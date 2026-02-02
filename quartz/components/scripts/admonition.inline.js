/**
 * Generates a unique ID for a collapsible based on slug and index.
 * @param {number} index The index of the collapsible on the page
 * @returns {string} The unique ID
 */
function collapsibleId(index) {
  const slug = window.document.body.dataset.slug
  return `${slug}-collapsible-${index}`
}

/**
 * Saves the collapsed state of an admonition to localStorage.
 * @param {string} id The unique ID of the collapsible
 * @param {boolean} isCollapsed Whether the admonition is collapsed
 */
function saveCollapsibleState(id, isCollapsed) {
  localStorage.setItem(id, isCollapsed ? "true" : "false")
  const states = window.__quartz_collapsible_states || new Map()
  states.set(id, isCollapsed)
}

/**
 * Opens a collapsed admonition.
 * @param {Event} event The click event
 */
function openAdmonition(event) {
  const admonition = event.currentTarget
  if (admonition.classList.contains("is-collapsed")) {
    admonition.classList.remove("is-collapsed")
    const id = admonition.dataset.collapsibleId
    if (id) {
      saveCollapsibleState(id, false)
    }
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
    const id = admonition.dataset.collapsibleId
    if (id) {
      saveCollapsibleState(id, true)
    }
  }
}

/**
 * Initializes all collapsible admonitions on the page.
 */
function setupAdmonition() {
  const collapsible = document.getElementsByClassName("admonition is-collapsible")
  const states = window.__quartz_collapsible_states || new Map()

  Array.from(collapsible).forEach((div, index) => {
    const id = collapsibleId(index)
    div.dataset.collapsibleId = id

    // Restore saved state to avoid layout shift
    if (states.has(id)) {
      const isCollapsed = states.get(id)
      if (isCollapsed) {
        div.classList.add("is-collapsed")
      } else {
        div.classList.remove("is-collapsed")
      }
    }

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
