// Automatically adds tabindex="0" to KaTeX elements that overflow
// (are scrollable), satisfying WCAG 2.1 SC 2.1.1 and the axe
// scrollable-region-focusable rule.  Removes tabindex when the
// element is no longer scrollable (e.g. after a viewport resize).
//
// From KaTeX PR #4162:
// https://github.com/KaTeX/KaTeX/pull/4162

const A11Y_ADDED = "data-a11y-tabindex-added"

function ensureAccessibleName(el) {
  const added = []
  if (!el.hasAttribute("role")) {
    el.setAttribute("role", "math")
    added.push("role")
  }
  if (!el.hasAttribute("aria-label")) {
    const annotation = el.querySelector("annotation[encoding='application/x-tex']")
    if (annotation?.textContent) {
      el.setAttribute("aria-label", annotation.textContent)
      added.push("aria-label")
    }
  }
  if (added.length > 0) {
    el.setAttribute(A11Y_ADDED, added.join(" "))
  }
}

function removeAccessibleName(el) {
  const added = el.getAttribute(A11Y_ADDED)
  if (added) {
    for (const attr of added.split(" ")) {
      el.removeAttribute(attr)
    }
    el.removeAttribute(A11Y_ADDED)
  }
}

function updateTabIndex(el) {
  if (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) {
    el.setAttribute("tabindex", "0")
    ensureAccessibleName(el)
  } else {
    el.removeAttribute("tabindex")
    removeAccessibleName(el)
  }
}

function observeKatex(el, resizeObserver) {
  updateTabIndex(el)
  resizeObserver.observe(el)
}

function init() {
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      updateTabIndex(entry.target)
    }
  })

  document.querySelectorAll(".katex").forEach((el) => observeKatex(el, resizeObserver))

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          if (node.classList.contains("katex")) {
            observeKatex(node, resizeObserver)
          } else {
            node.querySelectorAll(".katex").forEach((el) => observeKatex(el, resizeObserver))
          }
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true })
}

if (document.readyState !== "loading") {
  init()
} else {
  document.addEventListener("DOMContentLoaded", init)
}
