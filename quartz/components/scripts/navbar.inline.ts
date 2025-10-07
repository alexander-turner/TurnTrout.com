import { sessionStoragePondVideoKey } from "../component_utils"
import { setupDarkMode } from "./darkmode"
import { setupHamburgerMenu } from "./hamburgerMenu"
import { setupScrollHandler } from "./scrollHandler"
import { setupSearch } from "./search"

const autoplayKey = "pond-video-autoplay"

function getAutoplayEnabled(): boolean {
  const saved = localStorage.getItem(autoplayKey)
  return saved !== null ? saved === "true" : false // Default to disabled
}

function updatePlayPauseButton(): void {
  const button = document.getElementById("video-toggle") as HTMLButtonElement | null

  if (button) {
    const autoplayEnabled = getAutoplayEnabled()
    button.setAttribute(
      "aria-label",
      autoplayEnabled ? "Disable video autoplay" : "Enable video autoplay",
    )

    // Update CSS custom properties to control icon visibility
    document.documentElement.style.setProperty(
      "--video-play-display",
      autoplayEnabled ? "none" : "block",
    )
    document.documentElement.style.setProperty(
      "--video-pause-display",
      autoplayEnabled ? "block" : "none",
    )
  }
}

function setupAutoplayToggle(): void {
  const button = document.getElementById("video-toggle") as HTMLButtonElement | null

  if (button) {
    button.removeEventListener("click", handleVideoToggle) // Remove first to avoid duplicates
    button.addEventListener("click", handleVideoToggle)
    updatePlayPauseButton()
  }
}

function handleVideoToggle(): void {
  const autoplayEnabled = getAutoplayEnabled()
  localStorage.setItem(autoplayKey, (!autoplayEnabled).toString())
  updatePlayPauseButton()

  // Immediately apply the new autoplay state to the video
  const videoElement = document.getElementById("pond-video") as HTMLVideoElement | null
  if (videoElement) {
    if (!autoplayEnabled) {
      // If we're enabling autoplay
      videoElement.play()
    } else {
      // If we're disabling autoplay
      videoElement.pause()
    }
  }
}

function setupPondVideo(): void {
  const videoElement = document.getElementById("pond-video") as HTMLVideoElement | null

  if (videoElement) {
    const savedTime = sessionStorage.getItem(sessionStoragePondVideoKey)

    // Function to restore state once video is ready
    const restoreState = () => {
      if (savedTime) {
        console.debug("[setupPondVideo] Restoring video timestamp", savedTime)
        videoElement.currentTime = parseFloat(savedTime)
      }

      // Don't interfere with videos that are already playing
      if (videoElement.paused && getAutoplayEnabled()) {
        videoElement.play()
      }
    }

    // Wait for metadata to be loaded before setting currentTime
    if (videoElement.readyState >= 1) {
      // Metadata already loaded
      restoreState()
    } else {
      // Wait for metadata to load
      videoElement.addEventListener("loadedmetadata", restoreState, { once: true })
    }

    // Save timestamp before page unload/refresh
    const saveTimestamp = () => {
      sessionStorage.setItem(sessionStoragePondVideoKey, videoElement.currentTime.toString())
      console.debug("[setupPondVideo] Saving video timestamp", videoElement.currentTime)
    }

    // Save timestamp on various events
    window.addEventListener("beforeunload", saveTimestamp)
    window.addEventListener("pagehide", saveTimestamp)

    // Also save timestamp periodically during playback
    videoElement.addEventListener("timeupdate", () => {
      sessionStorage.setItem(sessionStoragePondVideoKey, videoElement.currentTime.toString())
    })
  }
}

// Initial setup
setupDarkMode()
setupHamburgerMenu()
setupSearch()
setupScrollHandler()
setupPondVideo()
setupAutoplayToggle()

// Re-run setup functions after SPA navigation
document.addEventListener("nav", () => {
  setupPondVideo()
  setupAutoplayToggle()
})
