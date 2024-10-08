/**
 * Toggles the collapsed state of a callout.
 * @this {HTMLElement} The title element of the callout
 */
function toggleCallout() {
  const outerBlock = this.parentElement
  outerBlock.classList.toggle("is-collapsed")
  const collapsed = outerBlock.classList.contains("is-collapsed")
  const height = collapsed ? this.scrollHeight : outerBlock.scrollHeight
  outerBlock.style.maxHeight = height + "px"
  // walk and adjust height of all parents
  let current = outerBlock
  let parent = outerBlock.parentElement
  while (parent) {
    if (!parent.classList.contains("callout")) {
      return
    }
    const collapsed_1 = parent.classList.contains("is-collapsed")
    const height_1 = collapsed_1 ? parent.scrollHeight : parent.scrollHeight + current.scrollHeight
    parent.style.maxHeight = height_1 + "px"
    current = parent
    parent = parent.parentElement
  }
}
/**
 * Initializes all collapsible callouts on the page.
 */
function setupCallout() {
  const collapsible = document.getElementsByClassName("callout is-collapsible")
  Array.from(collapsible).forEach(function (div) {
    const title = div.firstElementChild
    if (title) {
      title.addEventListener("click", toggleCallout)

      window.addCleanup(() => {
        title.removeEventListener("click", toggleCallout)
      })

      // Recalculate max-height
      const collapsed = div.classList.contains("is-collapsed")
      const height = collapsed ? title.scrollHeight : div.scrollHeight
      div.style.maxHeight = height + "px"
    }
  })
}

// Debounce function to limit the rate of function calls
function debounce(func, wait) {
  let timeout = null
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Function to immediately update callout heights
function updateCalloutHeights() {
  const collapsible = document.getElementsByClassName("callout is-collapsible")
  Array.from(collapsible).forEach(function (div) {
    const collapsed = div.classList.contains("is-collapsed")
    const height = collapsed ? div.firstElementChild.scrollHeight : div.scrollHeight
    div.style.maxHeight = height + "px"
  })
}

// Debounced version of setupCallout
const debouncedSetupCallout = debounce(() => {
  setupCallout()
  updateCalloutHeights()
}, 250)

// Function to handle resize events
function handleResize() {
  updateCalloutHeights() // Immediately update heights
  debouncedSetupCallout() // Schedule full setup
}

document.addEventListener("nav", setupCallout)
window.addEventListener("resize", handleResize)
