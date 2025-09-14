import { sessionStoragePondVideoKey } from "../component_utils"
import { setupDarkMode } from "./darkmode"
import { setupHamburgerMenu } from "./hamburgerMenu"
import { setupScrollHandler } from "./scrollHandler"
import { setupSearch } from "./search"

const autoplayKey = "pond-video-autoplay"

function getAutoplayEnabled(): boolean {
  const saved = localStorage.getItem(autoplayKey)
  console.debug("Local storage value for autoplay: ", saved)
  return saved !== null ? saved === "true" : true // Default to enabled
}

// TODO use for detect initial state
function updatePlayPauseButton(): void {
  const button = document.getElementById("video-toggle") as HTMLButtonElement | null
  const playIcon = document.getElementById("play-icon")
  const pauseIcon = document.getElementById("pause-icon")

  if (button && playIcon && pauseIcon) {
    const autoplayEnabled = getAutoplayEnabled()
    button.setAttribute(
      "aria-label",
      autoplayEnabled ? "Disable video autoplay" : "Enable video autoplay",
    )

    if (autoplayEnabled) {
      // Show pause icon, hide play icon
      playIcon.style.display = "none"
      pauseIcon.style.display = "block"
    } else {
      // Show play icon, hide pause icon
      playIcon.style.display = "block"
      pauseIcon.style.display = "none"
    }
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
      void videoElement.play()
    } else {
      // If we're disabling autoplay
      videoElement.pause()
    }
  }
}

function setupPondVideo(): void {
  const videoElement = document.getElementById("pond-video") as HTMLVideoElement | null

  if (videoElement) {
    // Restore timestamp
    const savedTime = sessionStorage.getItem(sessionStoragePondVideoKey)
    if (savedTime) {
      console.debug("Restoring video timestamp", savedTime)
      videoElement.currentTime = parseFloat(savedTime)
    }

    if (getAutoplayEnabled()) {
      void videoElement.play()
    } else {
      videoElement.pause()
    }

    // TODO load at detect initial state -- getting flickering of poster
    // Save timestamp before page unload/refresh
    const saveTimestamp = () => {
      sessionStorage.setItem(sessionStoragePondVideoKey, videoElement.currentTime.toString())
      console.debug("Saving video timestamp", videoElement.currentTime)
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
setupScrollHandler() // Mobile: hide navbar on scroll down, show on scroll up
setupPondVideo()
setupAutoplayToggle()

// Re-run setup functions after SPA navigation
document.addEventListener("nav", () => {
  setupPondVideo()
  setupAutoplayToggle()
})
