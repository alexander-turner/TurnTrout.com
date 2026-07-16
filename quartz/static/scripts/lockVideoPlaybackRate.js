;(() => {
  // Lock playback rate to 1.0 for video.no-vsc elements
  function lockPlaybackRate(video) {
    const desiredRate = 1.0
    video.playbackRate = desiredRate
    // Shadow the instance property so a write from an extension (e.g. Video
    // Speed Controller) never reaches the engine. Reactive resets (ratechange
    // listeners, rAF loops) leave a window where the video plays at the wrong
    // rate — WebKit delivers ratechange on a throttleable task queue.
    Object.defineProperty(video, "playbackRate", {
      // Re-lockable when applyToAllVideos runs again on SPA navigation.
      configurable: true,
      get: () => desiredRate,
      set: (requestedRate) => {
        console.debug(`Blocked playback rate change to ${requestedRate} on ${video}.`)
      },
    })
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
