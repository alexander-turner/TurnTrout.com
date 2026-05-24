import {
  handleLoadEvent,
  invertDecodedImages,
  onThemeChange,
  syncPictureSources,
} from "./accurateInvert"

document.addEventListener("load", handleLoadEvent, true)

new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type === "attributes" && m.attributeName === "data-theme") {
      onThemeChange()
      return
    }
  }
}).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
})

document.addEventListener(
  "DOMContentLoaded",
  () => {
    invertDecodedImages()
    syncPictureSources()
  },
  { once: true },
)

document.addEventListener("nav", () => {
  invertDecodedImages()
  syncPictureSources()
})
