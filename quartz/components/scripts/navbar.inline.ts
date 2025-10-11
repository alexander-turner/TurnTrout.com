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
      videoElement.play().catch((error: Error) => {
        console.debug("[handleVideoToggle] Play failed:", error)
      })
    } else {
      // If we're disabling autoplay
      videoElement.pause()
    }
  }
}

function setupPondVideo(): void {
  const videoElement = document.getElementById("pond-video") as HTMLVideoElement | null
  if (!videoElement) return

  const savedTime = sessionStorage.getItem(sessionStoragePondVideoKey)
  const autoplayEnabled = getAutoplayEnabled()

  console.debug(
    "[setupPondVideo] readyState:",
    videoElement.readyState,
    "autoplay:",
    autoplayEnabled,
    "savedTime:",
    savedTime,
  )

  const restoreVideoState = () => {
    console.debug("[restoreVideoState] Running, readyState:", videoElement.readyState)

    // Restore timestamp first (safe while paused)
    if (savedTime) {
      videoElement.currentTime = parseFloat(savedTime)
    }

    // Then start playback if autoplay enabled
    if (autoplayEnabled) {
      videoElement.play().catch((error: Error) => {
        console.error("[setupPondVideo] Play failed:", error)
      })
    }
  }

  // Wait for video to have enough data buffered to play smoothly
  // readyState >= 3 (HAVE_FUTURE_DATA) means we can play without stalling
  if (videoElement.readyState >= 3) {
    console.debug("[setupPondVideo] Video already ready, readyState:", videoElement.readyState)
    restoreVideoState()
  } else {
    console.debug("[setupPondVideo] Waiting for canplay, readyState:", videoElement.readyState)
    videoElement.addEventListener("canplay", restoreVideoState, { once: true })
  }

  // Save timestamp before page unload/refresh
  const saveTimestamp = () => {
    sessionStorage.setItem(sessionStoragePondVideoKey, videoElement.currentTime.toString())
    console.debug("[setupPondVideo] Saving video timestamp", videoElement.currentTime)
  }

  window.addEventListener("beforeunload", saveTimestamp)
  window.addEventListener("pagehide", saveTimestamp)

  // Save timestamp periodically during playback
  videoElement.addEventListener("timeupdate", () => {
    sessionStorage.setItem(sessionStoragePondVideoKey, videoElement.currentTime.toString())
  })
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
