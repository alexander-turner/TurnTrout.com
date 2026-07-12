;(() => {
  // Lock playback rate to 1.0 for video.no-vsc elements
  function lockPlaybackRate(video) {
    const desiredRate = 1.0
    // --- 1. Immediate Reversion (via Event Listener) ---
    // This catches most extensions the instant they change the rate.
    video.onratechange = function () {
      if (video.playbackRate !== desiredRate) {
        // Immediately reset the rate
        video.playbackRate = desiredRate
        console.debug(`Rate change event caught and reset on ${video}.`)
      }
    }

    // --- 2. Aggressive Reversion (via Animation Frame Loop) ---
    // This continuously checks and resets the rate tied to the browser's rendering cycle.
    function enforceRate() {
      // Check if the video element is even available before continuing
      if (video && video.playbackRate !== desiredRate) {
        video.playbackRate = desiredRate
        console.debug(`Aggressive frame-based rate reset on ${video}.`)
      }

      // Schedule the function to run again just before the next repaint
      requestAnimationFrame(enforceRate)
    }

    requestAnimationFrame(enforceRate)
  }

  // Apply to all existing video.no-vsc elements
  //  If it's both loop and autoplay, it's probably an inline asset which shouldn't be speeding up no matter what.
  function applyToAllVideos() {
    document.querySelectorAll("video.no-vsc, video[loop][autoplay]").forEach(lockPlaybackRate)
  }

  // Apply on initial page load
  document.addEventListener("DOMContentLoaded", applyToAllVideos)

  // Apply on SPA navigation
  document.addEventListener("nav", applyToAllVideos)
})()
