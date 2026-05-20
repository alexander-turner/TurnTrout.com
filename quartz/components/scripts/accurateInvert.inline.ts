import { handleLoadEvent, onThemeChange, processLoaded, pruneStalePins } from "./accurateInvert"

// Capture-phase: `load` doesn't bubble, so a non-capture listener on
// `document` would never fire for img loads. Attaching here in
// `<head>` (via beforeDOMLoaded) means we catch every img load event
// before first paint.
document.addEventListener("load", handleLoadEvent, true)

// React to theme switches set by darkmode.ts via the data-theme attribute.
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

// Cover cached images that decoded between body-parse and DOMContentLoaded
// (rare but possible — capture listeners only catch loads that fire after
// they're attached, and there's a small async gap on warm-cached images).
document.addEventListener("DOMContentLoaded", () => processLoaded(), { once: true })

// SPA navigation: Quartz fires `nav` after replacing page content. Images
// already decoded in the new DOM (cache hits, reused nodes) won't trigger
// fresh load events, so sweep them explicitly.
document.addEventListener("nav", () => {
  pruneStalePins()
  processLoaded()
})
