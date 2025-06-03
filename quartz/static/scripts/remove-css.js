function removeCSS() {
  const style = document.querySelector("#critical-css")
  if (style) {
    style.remove()
    console.debug("Removed critical styles")
  } else {
    console.warn("Critical style element not found")
  }
}

const mainCSS = document.querySelector('link[href="/index.css"]')
if (mainCSS) {
  if (mainCSS.sheet && mainCSS.sheet.cssRules.length > 0) {
    removeCSS()
  } else {
    mainCSS.addEventListener("load", removeCSS)
  }
} else {
  document.addEventListener("DOMContentLoaded", () => {
    const mainCSS = document.querySelector('link[href="/index.css"]')
    if (mainCSS) {
      if (mainCSS.sheet && mainCSS.sheet.cssRules.length > 0) {
        removeCSS()
      } else {
        mainCSS.addEventListener("load", removeCSS)
      }
    } else {
      removeCSS()
    }
  })
}
