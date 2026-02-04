/**
 * Generates a unique collapsible ID from slug and title.
 * Uses shared function from detectInitialState.js if available.
 * @param {string} titleText - The admonition title text
 * @returns {string} Unique ID like "slug-collapsible-normalized-title"
 */
function collapsibleId(titleText) {
  const slug = document.body?.dataset?.slug || ""
  if (window.__quartz_collapsible_id) return window.__quartz_collapsible_id(slug, titleText)
  // Fallback (matches detectInitialState.js)
  return `${slug}-collapsible-${(titleText || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)}`
}

/**
 * Persists collapsed state to localStorage and in-memory cache.
 * @param {string} id - The collapsible's unique ID
 * @param {boolean} isCollapsed - Whether the admonition is collapsed
 */
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
    event.stopPropagation()
    if (admonition.dataset.collapsibleId)
      saveCollapsibleState(admonition.dataset.collapsibleId, true)
  }
}

/**
 * Sets up click handlers for all collapsible admonitions.
 * State restoration is handled by MutationObserver in detectInitialState.js
 * for zero layout shift; this ensures IDs and handlers for any missed elements.
 */
function setupAdmonition() {
  const states = window.__quartz_collapsible_states || new Map()
  for (const admonition of document.getElementsByClassName("admonition is-collapsible")) {
    if (!admonition.dataset.collapsibleId) {
      const id = collapsibleId(
        admonition.querySelector(".admonition-title")?.textContent?.trim() || "",
      )
      admonition.dataset.collapsibleId = id
      if (states.has(id)) admonition.classList.toggle("is-collapsed", states.get(id))
    }
    admonition.addEventListener("click", openAdmonition)
    admonition.querySelector(".admonition-title")?.addEventListener("click", closeAdmonition)
  }
}

document.addEventListener("nav", setupAdmonition)
