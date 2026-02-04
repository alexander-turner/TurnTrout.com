/** djb2 hash → 8-char hex */
function hashContent(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  return (hash >>> 0).toString(16).padStart(8, "0")
}

const fallbackHashCounts = new Map()

/** Generates unique collapsible ID from content hash with index tiebreaker. */
function collapsibleId(content) {
  const slug = document.body?.dataset?.slug || ""
  if (window.__quartz_collapsible_id) return window.__quartz_collapsible_id(slug, content)
  const hash = hashContent(content || "empty")
  const key = `${slug}-${hash}`
  const index = fallbackHashCounts.get(key) || 0
  fallbackHashCounts.set(key, index + 1)
  return `${slug}-collapsible-${hash}-${index}`
}

function saveCollapsibleState(id, isCollapsed) {
  localStorage.setItem(id, isCollapsed ? "true" : "false")
  ;(window.__quartz_collapsible_states ||= new Map()).set(id, isCollapsed)
}

function openAdmonition(event) {
  const admonition = event.currentTarget
  if (admonition.classList.contains("is-collapsed")) {
    admonition.classList.remove("is-collapsed")
    if (admonition.dataset.collapsibleId)
      saveCollapsibleState(admonition.dataset.collapsibleId, false)
  }
}

function closeAdmonition(event) {
  const admonition = event.currentTarget.parentElement
  if (!admonition.classList.contains("is-collapsed")) {
    admonition.classList.add("is-collapsed")
    event.stopPropagation()
    if (admonition.dataset.collapsibleId)
      saveCollapsibleState(admonition.dataset.collapsibleId, true)
  }
}

function setupAdmonition() {
  window.__quartz_reset_collapsible_counts?.()
  fallbackHashCounts.clear()
  const states = window.__quartz_collapsible_states || new Map()
  for (const admonition of document.getElementsByClassName("admonition is-collapsible")) {
    if (!admonition.dataset.collapsibleId) {
      const title = admonition.querySelector(".admonition-title")?.textContent?.trim() || ""
      const body = admonition.querySelector(".admonition-content")?.textContent?.trim() || ""
      admonition.dataset.collapsibleId = collapsibleId(title + body)
      if (states.has(admonition.dataset.collapsibleId))
        admonition.classList.toggle("is-collapsed", states.get(admonition.dataset.collapsibleId))
    }
    admonition.addEventListener("click", openAdmonition)
    admonition.querySelector(".admonition-title")?.addEventListener("click", closeAdmonition)
  }
}

document.addEventListener("nav", setupAdmonition)
