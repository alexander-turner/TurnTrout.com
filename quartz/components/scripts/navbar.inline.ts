import { sessionStoragePondVideoKey } from "../component_utils"
import { setupDarkMode } from "./darkmode"
import { setupHamburgerMenu } from "./hamburgerMenu"
import { setupScrollHandler } from "./scrollHandler"
import { setupSearch } from "./search"

function setupPondVideo(): void {
  const videoElement = document.getElementById("pond-video") as HTMLVideoElement | null

  if (videoElement) {
    // Restore timestamp
    const savedTime = sessionStorage.getItem(sessionStoragePondVideoKey)
    if (savedTime) {
      videoElement.currentTime = parseFloat(savedTime)
    }

    videoElement.removeEventListener("mouseenter", playVideo) // Remove first to avoid duplicates
    videoElement.removeEventListener("mouseleave", pauseVideo)
    videoElement.addEventListener("mouseenter", playVideo)
    videoElement.addEventListener("mouseleave", pauseVideo)
  }
}

function playVideo(this: HTMLVideoElement): void {
  // Muting the floating promise as we don't need to await it

  // skipcq: JS-0098 (play is awaited)
  void this.play()
}

function pauseVideo(this: HTMLVideoElement): void {
  this.pause()
}

// Initial setup
setupDarkMode()
setupHamburgerMenu()
setupSearch()
setupScrollHandler() // Mobile: hide navbar on scroll down, show on scroll up
setupPondVideo()

// Re-run setup functions after SPA navigation
document.addEventListener("nav", () => {
  setupPondVideo()
})
