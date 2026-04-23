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
    // Always reassign IDs from scratch after counter reset, even if the element already
    // has one. During SPA back-navigation, micromorph may preserve some DOM elements
    // (keeping stale IDs) and replace others (clearing IDs). Skipping preserved elements
    // desynchronizes the counter, producing wrong IDs for replaced elements.
    const title = admonition.querySelector(".admonition-title")?.textContent?.trim() || ""
    const slug = document.body?.dataset?.slug || ""
    // Use title-only (not body) to match ID formula in detectInitialState.js, avoiding
    // streaming-parse race conditions where .admonition-content may not yet be in DOM.
    admonition.dataset.collapsibleId = window.__quartz_collapsible_id(slug, title)
    // Restore saved state
    if (states.has(admonition.dataset.collapsibleId))
      admonition.classList.toggle("is-collapsed", states.get(admonition.dataset.collapsibleId))
    admonition.removeEventListener("click", openAdmonition)
    admonition.addEventListener("click", openAdmonition)
    const title_el = admonition.querySelector(".admonition-title")
    title_el?.removeEventListener("click", closeAdmonition)
    title_el?.addEventListener("click", closeAdmonition)
  }
}

document.addEventListener("nav", setupAdmonition)
