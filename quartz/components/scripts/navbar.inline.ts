import { autoplayStorageKey, pondVideoId, sessionStoragePondVideoKey } from "../constants"
import { setupDarkMode } from "./darkmode"
import { setupHamburgerMenu } from "./hamburgerMenu"
import { setupRandomPostLink } from "./randomPost"
import { setupScrollHandler } from "./scrollHandler"
import { setupSearch } from "./search"

let pondVideoCleanupController: AbortController | null = null

function getAutoplayEnabled(): boolean {
  const saved = localStorage.getItem(autoplayStorageKey)
  return saved !== null ? saved === "true" : false // Default to disabled
}

// WebKit's decode pipeline can accept a play() request, report no error, yet
// never advance past HAVE_METADATA — the playhead stays frozen at 0. Re-issuing
// play() unsticks it. After requesting playback, poll a few times and retry
// until the playhead advances, stopping early if the user turns autoplay back
// off so we never fight a deliberate pause.
const VIDEO_WATCHDOG_INTERVAL_MS = 500
const VIDEO_WATCHDOG_MAX_RETRIES = 3

function playVideoWithWatchdog(videoElement: HTMLVideoElement): void {
  const attempt = (retriesLeft: number): void => {
    videoElement.play().catch((error: Error) => {
      console.debug("[playVideoWithWatchdog] Play failed:", error)
    })
    if (retriesLeft <= 0) return
    setTimeout(() => {
      if (!getAutoplayEnabled() || videoElement.paused || videoElement.currentTime > 0) return
      attempt(retriesLeft - 1)
    }, VIDEO_WATCHDOG_INTERVAL_MS)
  }
  attempt(VIDEO_WATCHDOG_MAX_RETRIES)
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
  localStorage.setItem(autoplayStorageKey, (!autoplayEnabled).toString())
  updatePlayPauseButton()

  // Immediately apply the new autoplay state to the video
  const videoElement = document.getElementById(pondVideoId) as HTMLVideoElement | null
  if (videoElement) {
    if (!autoplayEnabled) {
      // If we're enabling autoplay
      playVideoWithWatchdog(videoElement)
    } else {
      // If we're disabling autoplay
      videoElement.pause()
    }
  }
}

// A seek is close enough when the playhead lands within this many seconds of
// the target. Kept under the 0.5s tolerance the timestamp tests assert.
const SEEK_LANDING_TOLERANCE_S = 0.4
// WebKit can report a buffered range covering the target yet still clamp the
// applied seek, so the retry loop is bounded rather than trusting the buffer.
const MAX_SEEK_ATTEMPTS = 5

function isTimestampBuffered(videoElement: HTMLVideoElement, target: number): boolean {
  const { buffered } = videoElement
  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= target && target <= buffered.end(i)) return true
  }
  return false
}

function seekLanded(videoElement: HTMLVideoElement, target: number): boolean {
  return Math.abs(videoElement.currentTime - target) <= SEEK_LANDING_TOLERANCE_S
}

// Browsers that honor an in-buffer seek land immediately and leave the video
// paused on the restored frame — no playback, so visual snapshots stay stable.
// WebKit instead clamps a seek past the buffered range back to 0 and only
// applies a paused seek after a play/pause nudge, so retry as the buffer fills.
// A dedicated controller stops the retries the moment the playhead lands, so a
// later autoplay or loop restart can't drag it back to the restored position.
function restorePausedTimestamp(
  videoElement: HTMLVideoElement,
  target: number,
  parentSignal: AbortSignal,
): void {
  videoElement.currentTime = target
  if (seekLanded(videoElement, target)) return

  const controller = new AbortController()
  const { signal } = controller
  parentSignal.addEventListener("abort", () => controller.abort(), { once: true, signal })

  let attempts = 0
  const applySeek = () => {
    if (seekLanded(videoElement, target) || attempts >= MAX_SEEK_ATTEMPTS) {
      controller.abort()
      return
    }
    if (!isTimestampBuffered(videoElement, target)) return
    attempts += 1
    videoElement.currentTime = target
    videoElement
      .play()
      .then(() => videoElement.pause())
      .catch((error: Error) => {
        // AbortError is expected when pause() interrupts the play() request;
        // anything else is a real playback failure worth surfacing.
        if (error.name !== "AbortError") {
          console.debug("[restorePausedTimestamp] Nudge play failed:", error)
        }
      })
  }

  videoElement.addEventListener("progress", applySeek, { signal })
  videoElement.addEventListener("canplay", applySeek, { signal })
  videoElement.addEventListener("seeked", applySeek, { signal })

  // A paused, autoplay-off video may stall at HAVE_METADATA without buffering to
  // the target; force loading so the events above can fire.
  if (videoElement.networkState !== HTMLMediaElement.NETWORK_LOADING) {
    videoElement.load()
  }
}

function setupPondVideo(): void {
  // Clean up listeners from previous invocations to prevent accumulation
  if (pondVideoCleanupController) {
    pondVideoCleanupController.abort()
  }

  const videoElement = document.getElementById(pondVideoId) as HTMLVideoElement | null
  if (!videoElement) return

  pondVideoCleanupController = new AbortController()
  const { signal } = pondVideoCleanupController

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

    if (autoplayEnabled) {
      // Restore timestamp first (safe while paused), then resume playback.
      if (savedTime) {
        videoElement.currentTime = parseFloat(savedTime)
      }
      playVideoWithWatchdog(videoElement)
    } else if (savedTime && parseFloat(savedTime) > 0) {
      // Seeking to 0 doesn't need the buffer-aware restore and would briefly
      // advance the video (breaking visual tests), so only restore non-zero
      // positions.
      restorePausedTimestamp(videoElement, parseFloat(savedTime), signal)
    }
  }

  // Wait for video metadata to load. readyState >= 1 (HAVE_METADATA) is sufficient
  // for setting currentTime. We listen for loadedmetadata, loadeddata, and canplay
  // because Safari may not reliably fire later events after DOM morphing or page refresh.
  if (videoElement.readyState >= 1) {
    console.debug("[setupPondVideo] Video already ready, readyState:", videoElement.readyState)
    restoreVideoState()
  } else {
    console.debug("[setupPondVideo] Waiting for video ready, readyState:", videoElement.readyState)
    let restored = false
    const restoreOnce = () => {
      if (restored) return
      restored = true
      restoreVideoState()
    }
    videoElement.addEventListener("loadedmetadata", restoreOnce, { once: true, signal })
    videoElement.addEventListener("loadeddata", restoreOnce, { once: true, signal })
    videoElement.addEventListener("canplay", restoreOnce, { once: true, signal })

    // Safari/WebKit may not eagerly load video metadata after a full page reload
    // when autoplay is disabled, despite preload="auto". Explicitly call load()
    // so the metadata events above will fire. However, calling load() while
    // Firefox is mid-source-selection (iterating hvc1→webm fallbacks) aborts the
    // chain. Defer the kick briefly so Firefox can finish source selection
    // naturally, while still unblocking Safari's stalled loader.
    if (savedTime && !autoplayEnabled) {
      if (videoElement.networkState !== HTMLMediaElement.NETWORK_LOADING) {
        videoElement.load()
      } else {
        setTimeout(() => {
          if (!restored && videoElement.readyState < 1) {
            videoElement.load()
          }
        }, 200)
      }
    }
  }

  // Save timestamp before page unload/refresh
  const saveTimestamp = () => {
    sessionStorage.setItem(sessionStoragePondVideoKey, videoElement.currentTime.toString())
    console.debug("[setupPondVideo] Saving video timestamp", videoElement.currentTime)
  }

  window.addEventListener("beforeunload", saveTimestamp, { signal })
  window.addEventListener("pagehide", saveTimestamp, { signal })

  // Save timestamp during playback
  videoElement.addEventListener(
    "timeupdate",
    () => {
      sessionStorage.setItem(sessionStoragePondVideoKey, videoElement.currentTime.toString())
    },
    { signal },
  )
}

// Initial setup
setupDarkMode()
setupHamburgerMenu()
setupSearch()
setupScrollHandler()
setupPondVideo()
setupAutoplayToggle()
setupRandomPostLink()

// The pond `<video>` and its listeners survive SPA navigation — see the
// video-container reconciliation in spa.inline.ts — so setupPondVideo runs
// only on initial document load.
document.addEventListener("nav", () => {
  setupHamburgerMenu()
  setupAutoplayToggle()
})
