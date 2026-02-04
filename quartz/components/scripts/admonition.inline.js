/**
 * Simple hash function for content-based IDs (fallback).
 * @param {string} str - String to hash
 * @returns {string} 8-character hex hash
 */
function hashContent(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

// Fallback hash counts (used if detectInitialState.js didn't run)
const fallbackHashCounts = new Map()

/**
 * Generates a unique collapsible ID from content hash with index tiebreaker.
 * Uses shared function from detectInitialState.js if available.
 * @param {string} content - The full content (title + body text)
 * @returns {string} Unique ID like "slug-collapsible-abc12345-0"
 */
function collapsibleId(content) {
  const slug = document.body?.dataset?.slug || ""
  if (window.__quartz_collapsible_id) return window.__quartz_collapsible_id(slug, content)
  // Fallback (matches detectInitialState.js)
  const hash = hashContent(content || "empty")
  const key = `${slug}-${hash}`
  const index = fallbackHashCounts.get(key) || 0
  fallbackHashCounts.set(key, index + 1)
  return `${slug}-collapsible-${hash}-${index}`
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
  // Reset hash counts on each navigation for consistent IDs
  window.__quartz_reset_collapsible_counts?.()
  fallbackHashCounts.clear()
  const states = window.__quartz_collapsible_states || new Map()
  for (const admonition of document.getElementsByClassName("admonition is-collapsible")) {
    if (!admonition.dataset.collapsibleId) {
      const title = admonition.querySelector(".admonition-title")?.textContent?.trim() || ""
      const body = admonition.querySelector(".admonition-content")?.textContent?.trim() || ""
      const id = collapsibleId(title + body)
      admonition.dataset.collapsibleId = id
      if (states.has(id)) admonition.classList.toggle("is-collapsed", states.get(id))
    }
    admonition.addEventListener("click", openAdmonition)
    admonition.querySelector(".admonition-title")?.addEventListener("click", closeAdmonition)
  }
}

document.addEventListener("nav", setupAdmonition)
