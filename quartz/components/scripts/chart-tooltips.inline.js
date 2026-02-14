// Progressive enhancement: tooltips for smart charts
// Uses event delegation for efficiency
;(function () {
  const tooltip = document.createElement("div")
  tooltip.className = "smart-chart-tooltip"
  tooltip.setAttribute("role", "tooltip")
  tooltip.style.display = "none"
  document.body.appendChild(tooltip)

  function showTooltip(target, e) {
    const x = target.getAttribute("data-x")
    const y = target.getAttribute("data-y")
    const series = target.getAttribute("data-series")
    if (!x || !y) return

    tooltip.textContent = ""
    if (series) {
      var strong = document.createElement("strong")
      strong.textContent = series
      tooltip.appendChild(strong)
      tooltip.appendChild(document.createElement("br"))
    }
    tooltip.appendChild(document.createTextNode(x + ", " + y))
    tooltip.style.display = "block"
    positionTooltip(e)
  }

  function positionTooltip(e) {
    const tipRect = tooltip.getBoundingClientRect()
    let left = e.clientX + 12
    let top = e.clientY - 28

    // Keep within viewport
    if (left + tipRect.width > window.innerWidth) {
      left = e.clientX - tipRect.width - 12
    }
    if (top < 0) top = e.clientY + 12

    tooltip.style.left = left + "px"
    tooltip.style.top = top + "px"
  }

  function hideTooltip() {
    tooltip.style.display = "none"
  }

  // Event delegation on document
  document.addEventListener("mouseover", function (e) {
    const target = e.target
    if (target.matches && target.matches(".smart-chart-point")) {
      showTooltip(target, e)
    }
  })

  document.addEventListener("mouseout", function (e) {
    const target = e.target
    if (target.matches && target.matches(".smart-chart-point")) {
      hideTooltip()
    }
  })

  document.addEventListener("mousemove", function (e) {
    if (tooltip.style.display === "block") {
      positionTooltip(e)
    }
  })

  // Touch support
  document.addEventListener("touchstart", function (e) {
    const target = e.target
    if (target.matches && target.matches(".smart-chart-point")) {
      e.preventDefault()
      const touch = e.touches[0]
      showTooltip(target, touch)
    } else {
      hideTooltip()
    }
  })
})()
