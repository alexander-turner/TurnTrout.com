/** Persists collapsed state to localStorage and in-memory cache. */
function saveCollapsibleState(id, isCollapsed) {
  localStorage.setItem(id, isCollapsed ? "true" : "false")
  ;(window.__quartz_collapsible_states ||= new Map()).set(id, isCollapsed)
}

/** Syncs ARIA attributes with collapsed state. */
function syncAriaState(admonition, isCollapsed) {
  const title = admonition.querySelector(".admonition-title")
  const content = admonition.querySelector(".admonition-content")
  if (title) title.setAttribute("aria-expanded", String(!isCollapsed))
  if (content) content.setAttribute("aria-hidden", String(isCollapsed))
}

/** Opens a collapsed admonition on click. */
function openAdmonition(event) {
  const admonition = event.currentTarget
  if (admonition.classList.contains("is-collapsed")) {
    admonition.classList.remove("is-collapsed")
    syncAriaState(admonition, false)
    if (admonition.dataset.collapsibleId)
      saveCollapsibleState(admonition.dataset.collapsibleId, false)
  }
}

/** Closes an admonition when its title is clicked. */
function closeAdmonition(event) {
  const admonition = event.currentTarget.parentElement
  if (!admonition.classList.contains("is-collapsed")) {
    admonition.classList.add("is-collapsed")
    syncAriaState(admonition, true)
    event.stopPropagation() // Prevent reopening from parent click handler
    if (admonition.dataset.collapsibleId)
      saveCollapsibleState(admonition.dataset.collapsibleId, true)
  }
}

/** Toggles admonition on Enter or Space keypress. */
function handleTitleKeydown(event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault()
    event.currentTarget.click()
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
    syncAriaState(admonition, admonition.classList.contains("is-collapsed"))
    admonition.removeEventListener("click", openAdmonition)
    admonition.addEventListener("click", openAdmonition)
    const title_el = admonition.querySelector(".admonition-title")
    if (title_el) {
      title_el.setAttribute("role", "button")
      title_el.setAttribute("tabindex", "0")
    }
    title_el?.removeEventListener("click", closeAdmonition)
    title_el?.addEventListener("click", closeAdmonition)
    title_el?.removeEventListener("keydown", handleTitleKeydown)
    title_el?.addEventListener("keydown", handleTitleKeydown)
  }
}

document.addEventListener("nav", setupAdmonition)
