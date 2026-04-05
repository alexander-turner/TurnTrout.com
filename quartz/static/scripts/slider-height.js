/**
 * Constrains each img-comparison-slider's height to the shorter of its two
 * images.  Both images use width:100% / height:auto, so their rendered heights
 * follow their aspect ratios.  The shadow DOM's overflow:hidden then clips the
 * taller image at the bottom, keeping both visually equal.
 */
;(function () {
  "use strict"

  function constrainSliders() {
    document.querySelectorAll("img-comparison-slider").forEach(function (slider) {
      var first = slider.querySelector('[slot="first"]')
      var second = slider.querySelector('[slot="second"]')
      if (!first || !second) return

      // Both images have width/height attributes (from assetDimensions) and
      // CSS width:100%; height:auto, so getBoundingClientRect().height gives
      // the rendered height based on their aspect ratio.
      var h1 = first.getBoundingClientRect().height
      var h2 = second.getBoundingClientRect().height

      if (h1 > 0 && h2 > 0) {
        slider.style.maxHeight = Math.min(h1, h2) + "px"
      }
    })
  }

  // Re-measure on resize (images reflow to new widths)
  var resizeObserver = new ResizeObserver(constrainSliders)

  function setup() {
    constrainSliders()
    // Observe body so we catch layout changes from viewport resize
    resizeObserver.disconnect()
    document.querySelectorAll("img-comparison-slider").forEach(function (slider) {
      resizeObserver.observe(slider)
    })
  }

  // Run on initial load and after SPA navigation
  document.addEventListener("nav", setup)
  // Also run once immediately if nav already fired
  if (document.readyState !== "loading") {
    setup()
  } else {
    document.addEventListener("DOMContentLoaded", setup)
  }
})()
