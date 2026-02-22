/** Persists collapsed state to localStorage and in-memory cache. */
function saveCollapsibleState(id, isCollapsed) {
  localStorage.setItem(id, isCollapsed ? "true" : "false")
  ;(window.__quartz_collapsible_states ||= new Map()).set(id, isCollapsed)
}

/** Opens a collapsed admonition on click. */
function openAdmonition(event) {
  const admonition = event.currentTarget
  if (admonition.classList.contains("is-collapsed")) {
    admonition.classList.remove("is-collapsed")
    if (admonition.dataset.collapsibleId)
      saveCollapsibleState(admonition.dataset.collapsibleId, false)
  }
}

/** Closes an admonition when its title is clicked. */
function closeAdmonition(event) {
  const admonition = event.currentTarget.parentElement
  if (!admonition.classList.contains("is-collapsed")) {
    admonition.classList.add("is-collapsed")
    event.stopPropagation() // Prevent reopening from parent click handler
    if (admonition.dataset.collapsibleId)
      saveCollapsibleState(admonition.dataset.collapsibleId, true)
  }
}

/** Sets up click handlers and restores state for all collapsible admonitions. */
function setupAdmonition() {
  // Reset hash counts for consistent IDs (detectInitialState.js always runs first)
  window.__quartz_reset_collapsible_counts?.()

  const states = window.__quartz_collapsible_states || new Map()
  for (const admonition of document.getElementsByClassName("admonition is-collapsible")) {
    // Assign ID if not already set by MutationObserver in detectInitialState.js
    if (!admonition.dataset.collapsibleId) {
      const title = admonition.querySelector(".admonition-title")?.textContent?.trim() || ""
      const body = admonition.querySelector(".admonition-content")?.textContent?.trim() || ""
      const slug = document.body?.dataset?.slug || ""
      admonition.dataset.collapsibleId = window.__quartz_collapsible_id(slug, title + body)
      // Restore saved state
      if (states.has(admonition.dataset.collapsibleId))
        admonition.classList.toggle("is-collapsed", states.get(admonition.dataset.collapsibleId))
    }
    admonition.addEventListener("click", openAdmonition)
    admonition.querySelector(".admonition-title")?.addEventListener("click", closeAdmonition)
  }
}

document.addEventListener("nav", setupAdmonition)
