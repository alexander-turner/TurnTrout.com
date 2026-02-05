// Fallback hash counts if detectInitialState.js didn't run
const fallbackHashCounts = new Map()

/** Fallback djb2 hash if window.__quartz_hash unavailable */
const hashFallback = (str) => {
  let hash = 5381
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  return (hash >>> 0).toString(16).padStart(8, "0")
}

/** Generates unique collapsible ID from content hash with index tiebreaker. */
function collapsibleId(content) {
  const slug = document.body?.dataset?.slug || ""
  // Use shared ID generator if available (set by detectInitialState.js)
  if (window.__quartz_collapsible_id) return window.__quartz_collapsible_id(slug, content)
  // Fallback implementation
  const hash = (window.__quartz_hash || hashFallback)(content || "empty")
  const key = `${slug}-${hash}`
  const index = fallbackHashCounts.get(key) || 0
  fallbackHashCounts.set(key, index + 1)
  return `${slug}-collapsible-${hash}-${index}`
}

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
  // Reset hash counts on each navigation for consistent IDs
  window.__quartz_reset_collapsible_counts?.()
  fallbackHashCounts.clear()

  const states = window.__quartz_collapsible_states || new Map()
  for (const admonition of document.getElementsByClassName("admonition is-collapsible")) {
    // Assign ID if not already set by MutationObserver
    if (!admonition.dataset.collapsibleId) {
      const title = admonition.querySelector(".admonition-title")?.textContent?.trim() || ""
      const body = admonition.querySelector(".admonition-content")?.textContent?.trim() || ""
      admonition.dataset.collapsibleId = collapsibleId(title + body)
      // Restore saved state
      if (states.has(admonition.dataset.collapsibleId))
        admonition.classList.toggle("is-collapsed", states.get(admonition.dataset.collapsibleId))
    }
    admonition.addEventListener("click", openAdmonition)
    admonition.querySelector(".admonition-title")?.addEventListener("click", closeAdmonition)
  }
}

document.addEventListener("nav", setupAdmonition)
