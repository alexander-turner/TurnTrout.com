var checkboxId = function (index) {
  var slug = window.document.body.dataset.slug
  return "".concat(slug, "-checkbox-").concat(index)
}
document.addEventListener("nav", function () {
  var checkboxes = document.querySelectorAll("input.checkbox-toggle")
  checkboxes.forEach(function (el, index) {
    var elId = checkboxId(index)
    var switchState = function (e) {
      var _a
      var newCheckboxState = ((_a = e.target) === null || _a === void 0 ? void 0 : _a.checked)
        ? "true"
        : "false"
      localStorage.setItem(elId, newCheckboxState)
    }
    el.addEventListener("change", switchState)
    window.addCleanup(() => {
      el.removeEventListener("change", switchState)
    })

    if (localStorage.getItem(elId) === "true") {
      el.checked = true
    }
  })
})
