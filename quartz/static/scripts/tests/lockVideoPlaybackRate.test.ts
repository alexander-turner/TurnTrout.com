/**
 * @jest-environment jsdom
 */

import { jest, describe, it, beforeEach, afterEach, expect } from "@jest/globals"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

import type { FullSlug } from "../../../util/path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Use native dispatchEvent to bypass custom type restrictions
const dispatchEvent = (event: Event) => {
  EventTarget.prototype.dispatchEvent.call(document, event)
}

const dispatchNavEvent = () => {
  document.dispatchEvent(new CustomEvent("nav", { detail: { url: "" as FullSlug } }))
}

const loadScript = () => {
  const scriptPath = join(__dirname, "..", "lockVideoPlaybackRate.js")
  const scriptContent = readFileSync(scriptPath, "utf-8")
  const fn = new Function(scriptContent)
  fn()
}

describe("lockVideoPlaybackRate", () => {
  let rafCallbacks: FrameRequestCallback[]
  let rafId: number

  beforeEach(() => {
    document.body.innerHTML = ""
    rafCallbacks = []
    rafId = 0

    global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return ++rafId
    }) as typeof global.requestAnimationFrame

    jest.spyOn(console, "debug").mockImplementation(jest.fn())
  })

  afterEach(() => {
    jest.clearAllMocks()
    document.body.innerHTML = ""
  })

  const runRafCallbacks = (times = 1) => {
    for (let i = 0; i < times; i++) {
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach((cb) => cb(performance.now()))
    }
  }

  describe("DOMContentLoaded event", () => {
    it("should apply to video.no-vsc elements on DOMContentLoaded", () => {
      const video = document.createElement("video")
      video.classList.add("no-vsc")
      document.body.appendChild(video)

      loadScript()
      dispatchEvent(new Event("DOMContentLoaded"))

      expect(video.onratechange).not.toBeNull()
    })

    it("should apply to video[loop][autoplay] elements on DOMContentLoaded", () => {
      const video = document.createElement("video")
      video.loop = true
      video.autoplay = true
      document.body.appendChild(video)

      loadScript()
      dispatchEvent(new Event("DOMContentLoaded"))

      expect(video.onratechange).not.toBeNull()
    })
  })

  describe("nav event (SPA navigation)", () => {
    it("should apply to videos on nav event", () => {
      const video = document.createElement("video")
      video.classList.add("no-vsc")
      document.body.appendChild(video)

      loadScript()
      dispatchNavEvent()

      expect(video.onratechange).not.toBeNull()
    })
  })

  describe("playback rate enforcement", () => {
    it("should reset playback rate when changed via onratechange", () => {
      const video = document.createElement("video")
      video.classList.add("no-vsc")
      document.body.appendChild(video)

      loadScript()
      dispatchEvent(new Event("DOMContentLoaded"))

      // Simulate extension changing playback rate
      video.playbackRate = 2.0
      video.onratechange?.(new Event("ratechange"))

      expect(video.playbackRate).toBe(1.0)
    })

    it("should not reset playback rate if already 1.0", () => {
      const video = document.createElement("video")
      video.classList.add("no-vsc")
      document.body.appendChild(video)

      loadScript()
      dispatchEvent(new Event("DOMContentLoaded"))

      video.playbackRate = 1.0
      video.onratechange?.(new Event("ratechange"))

      expect(video.playbackRate).toBe(1.0)
    })

    it("should enforce rate via requestAnimationFrame loop", () => {
      const video = document.createElement("video")
      video.classList.add("no-vsc")
      document.body.appendChild(video)

      loadScript()
      dispatchEvent(new Event("DOMContentLoaded"))

      // Run one rAF cycle
      runRafCallbacks()

      // Change rate
      video.playbackRate = 1.5
      runRafCallbacks()

      expect(video.playbackRate).toBe(1.0)
    })

    it("should handle video element being removed", () => {
      const video = document.createElement("video")
      video.classList.add("no-vsc")
      document.body.appendChild(video)

      loadScript()
      dispatchEvent(new Event("DOMContentLoaded"))

      // Remove video
      document.body.removeChild(video)

      // This should not throw
      expect(() => runRafCallbacks()).not.toThrow()
    })
  })

  describe("multiple videos", () => {
    it("should apply to all matching videos", () => {
      const video1 = document.createElement("video")
      video1.classList.add("no-vsc")
      const video2 = document.createElement("video")
      video2.loop = true
      video2.autoplay = true

      document.body.appendChild(video1)
      document.body.appendChild(video2)

      loadScript()
      dispatchEvent(new Event("DOMContentLoaded"))

      expect(video1.onratechange).not.toBeNull()
      expect(video2.onratechange).not.toBeNull()
    })
  })
})
