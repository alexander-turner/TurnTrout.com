;(() => {
  function removeCSS() {
    const style = document.getElementById("critical-css")
    if (style) {
      style.remove()
    }
  }

  const mainCSS = document.querySelector('link[rel="stylesheet"][href="/index.css"]')
  if (mainCSS) {
    if (mainCSS.sheet) {
      removeCSS()
    } else {
      mainCSS.addEventListener("load", removeCSS)
    }
  } else {
    window.addEventListener("load", removeCSS)
  }
})()
