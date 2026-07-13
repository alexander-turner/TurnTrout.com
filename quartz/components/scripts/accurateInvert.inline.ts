import {
  handleLoadEvent,
  invertDecodedImages,
  onThemeChange,
  syncPictureSources,
} from "./accurateInvert"

// Capture-phase: `load` doesn't bubble, so a non-capture listener on
// `document` would never fire for img loads. Attaching in `<head>`
// (via beforeDOMLoaded) catches every img load before first paint.
document.addEventListener("load", handleLoadEvent, true)

// React to manual theme switches (darkmode.ts sets data-theme).
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

// Warm-cached images may decode between body-parse and DOMContentLoaded,
// before the capture listener is armed. Sweep them here.
document.addEventListener(
  "DOMContentLoaded",
  () => {
    invertDecodedImages()
    syncPictureSources()
  },
  { once: true },
)

// SPA navigation: Quartz fires `nav` after replacing page content.
// Already-decoded images in the new DOM won't trigger fresh load events.
document.addEventListener("nav", () => {
  invertDecodedImages()
  syncPictureSources()
})
