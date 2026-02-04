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

function saveCollapsibleState(id, isCollapsed) {
  localStorage.setItem(id, isCollapsed ? "true" : "false")
  ;(window.__quartz_collapsible_states ||= new Map()).set(id, isCollapsed)
}

function openAdmonition(event) {
  const el = event.currentTarget
  if (el.classList.contains("is-collapsed")) {
    el.classList.remove("is-collapsed")
    if (el.dataset.collapsibleId) saveCollapsibleState(el.dataset.collapsibleId, false)
  }
}

function closeAdmonition(event) {
  const el = event.currentTarget.parentElement
  if (!el.classList.contains("is-collapsed")) {
    el.classList.add("is-collapsed")
    event.stopPropagation()
    if (el.dataset.collapsibleId) saveCollapsibleState(el.dataset.collapsibleId, true)
  }
}

function setupAdmonition() {
  const states = window.__quartz_collapsible_states || new Map()
  for (const div of document.getElementsByClassName("admonition is-collapsible")) {
    if (!div.dataset.collapsibleId) {
      const id = collapsibleId(div.querySelector(".admonition-title")?.textContent?.trim() || "")
      div.dataset.collapsibleId = id
      if (states.has(id)) div.classList.toggle("is-collapsed", states.get(id))
    }
    div.addEventListener("click", openAdmonition)
    div.querySelector(".admonition-title")?.addEventListener("click", closeAdmonition)
  }
}

document.addEventListener("nav", setupAdmonition)
