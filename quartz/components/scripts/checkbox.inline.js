const checkboxId = (index) => {
  const slug = window.document.body.dataset.slug
  return `${slug}-checkbox-${index}`
}

document.addEventListener("nav", () => {
  const checkboxes = document.querySelectorAll("input.checkbox-toggle")
  const states = window.__quartz_checkbox_states || new Map()

  checkboxes.forEach((el, index) => {
    const elId = checkboxId(index)

    // Save state when checkbox changes
    el.addEventListener("change", () => {
      const newCheckboxState = el.checked
      localStorage.setItem(elId, newCheckboxState ? "true" : "false")
      states.set(elId, newCheckboxState)
    })

    // Restore state from pre-loaded cache
    if (states.has(elId)) {
      el.checked = states.get(elId)
    }
  })
})
