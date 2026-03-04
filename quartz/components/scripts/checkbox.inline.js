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

      // Cascade down: when checked, also check all descendant checkboxes
      if (newCheckboxState) {
        const li = el.closest("li")
        if (li) {
          const descendants = li.querySelectorAll(
            ":scope > ul input.checkbox-toggle, :scope > ol input.checkbox-toggle",
          )
          descendants.forEach((descendant) => {
            descendant.checked = true
            // Find descendant's index and persist its state
            const descIndex = Array.from(checkboxes).indexOf(descendant)
            if (descIndex !== -1) {
              const descId = checkboxId(descIndex)
              localStorage.setItem(descId, "true")
              states.set(descId, true)
            }
          })
        }
      }
    })

    // Restore state from pre-loaded cache
    if (states.has(elId)) {
      el.checked = states.get(elId)
    }
  })
})
