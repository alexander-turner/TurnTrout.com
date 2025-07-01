function removeCSS() {
  const style = document.getElementById("critical-css")
  if (style) {
    style.remove()
    console.debug("Removed critical styles")
  } else {
    console.warn("Critical style element not found")
  }
}

const mainCSS = document.querySelector('link[href="/index.css"]')
if (mainCSS) {
  if (mainCSS.sheet) {
    removeCSS()
  } else {
    mainCSS.addEventListener("load", removeCSS)
  }
} else {
  window.addEventListener("load", removeCSS)
}
