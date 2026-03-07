const checkboxId = (index) => {
  const slug = window.document.body.dataset.slug
  return `${slug}-checkbox-${index}`
}

document.addEventListener("nav", () => {
  const checkboxes = document.querySelectorAll("input.checkbox-toggle")
  const states = window.__quartz_checkbox_states || new Map()

  // Pre-build element→index map for O(1) lookups during cascade
  const indexMap = new Map()
  checkboxes.forEach((el, index) => indexMap.set(el, index))

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
            const descIndex = indexMap.get(descendant)
            if (descIndex !== undefined) {
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

  // Prevent label clicks from toggling checkboxes — only direct checkbox clicks should toggle
  document.querySelectorAll("label:has(> input.checkbox-toggle)").forEach((label) => {
    label.addEventListener("click", (e) => {
      if (e.target !== label.querySelector("input.checkbox-toggle")) {
        e.preventDefault()
      }
    })
  })
})
