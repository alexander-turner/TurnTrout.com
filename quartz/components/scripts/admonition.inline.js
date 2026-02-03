/**
 * Generates a unique ID for a collapsible based on slug and title.
 * Uses the shared function from detectInitialState.js if available,
 * otherwise falls back to local implementation.
 * @param {string} titleText The title text of the admonition
 * @returns {string} The unique ID
 */
function collapsibleId(titleText) {
  const slug = document.body?.dataset?.slug || ""
  if (window.__quartz_collapsible_id) {
    return window.__quartz_collapsible_id(slug, titleText)
  }
  // Fallback implementation (matches detectInitialState.js)
  const normalizedTitle = (titleText || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
  return `${slug}-collapsible-${normalizedTitle}`
}

/**
 * Saves the collapsed state of an admonition to localStorage and cache.
 * @param {string} id The unique ID of the collapsible
 * @param {boolean} isCollapsed Whether the admonition is collapsed
 */
function saveCollapsibleState(id, isCollapsed) {
  localStorage.setItem(id, isCollapsed ? "true" : "false")
  // Update the shared state cache (ensure it exists)
  if (!window.__quartz_collapsible_states) {
    window.__quartz_collapsible_states = new Map()
  }
  window.__quartz_collapsible_states.set(id, isCollapsed)
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
 * State restoration is handled by MutationObserver in detectInitialState.js
 * for zero layout shift. This function sets up click handlers and ensures
 * IDs are set for any collapsibles that might have been missed.
 */
function setupAdmonition() {
  const collapsible = document.getElementsByClassName("admonition is-collapsible")
  const states = window.__quartz_collapsible_states || new Map()

  Array.from(collapsible).forEach((div) => {
    // Ensure ID is set (MutationObserver should have done this, but be safe)
    if (!div.dataset.collapsibleId) {
      const titleEl = div.querySelector(".admonition-title")
      const titleText = titleEl?.textContent?.trim() || ""
      const id = collapsibleId(titleText)
      div.dataset.collapsibleId = id

      // Apply saved state if not already applied
      if (states.has(id)) {
        const isCollapsed = states.get(id)
        if (isCollapsed) {
          div.classList.add("is-collapsed")
        } else {
          div.classList.remove("is-collapsed")
        }
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
