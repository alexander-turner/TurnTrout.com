function attemptPlayVideos() {
  const videos = document.querySelectorAll("video[autoplay]")
  videos.forEach((video) => {
    // Ensure video is muted (Safari requirement)
    video.muted = true
    const playPromise = video.play()
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay prevented - silently handle
      })
    }
  })
}

document.addEventListener("DOMContentLoaded", attemptPlayVideos)
document.addEventListener("nav", attemptPlayVideos)

// Also try on any user interaction
;["click", "scroll", "touchstart", "mouseover"].forEach((event) => {
  document.addEventListener(event, attemptPlayVideos, { once: true })
})
