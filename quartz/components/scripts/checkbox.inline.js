const checkboxId = function (index) {
  const slug = window.document.body.dataset.slug
  return `${slug}-checkbox-${index}`
}

document.addEventListener("nav", function () {
  const checkboxes = document.querySelectorAll("input.checkbox-toggle")
  checkboxes.forEach(function (el, index) {
    const elId = checkboxId(index)
    const switchState = function (e) {
      const newCheckboxState = e.target?.checked ? "true" : "false"
      localStorage.setItem(elId, newCheckboxState)
    }

    el.addEventListener("change", switchState)

    if (localStorage.getItem(elId) === "true") {
      el.checked = true
    }
  })
})
