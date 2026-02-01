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
  const scriptPath = join(__dirname, "..", "safari-autoplay.js")
  const scriptContent = readFileSync(scriptPath, "utf-8")
  const fn = new Function(scriptContent)
  fn()
}

describe("safari-autoplay", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  afterEach(() => {
    jest.clearAllMocks()
    document.body.innerHTML = ""
  })

  const createAutoplayVideo = () => {
    const video = document.createElement("video")
    video.autoplay = true
    video.muted = false
    document.body.appendChild(video)
    return video
  }

  describe("DOMContentLoaded event", () => {
    it("should attempt to play autoplay videos on DOMContentLoaded", () => {
      const video = createAutoplayVideo()
      const playSpy = jest.spyOn(video, "play").mockResolvedValue(undefined)

      loadScript()
      dispatchEvent(new Event("DOMContentLoaded"))

      expect(playSpy).toHaveBeenCalled()
    })

    it("should mute videos before playing", () => {
      const video = createAutoplayVideo()
      jest.spyOn(video, "play").mockResolvedValue(undefined)

      loadScript()
      dispatchEvent(new Event("DOMContentLoaded"))

      expect(video.muted).toBe(true)
    })
  })

  describe("nav event (SPA navigation)", () => {
    it("should attempt to play videos on nav event", () => {
      const video = createAutoplayVideo()
      const playSpy = jest.spyOn(video, "play").mockResolvedValue(undefined)

      loadScript()
      dispatchNavEvent()

      expect(playSpy).toHaveBeenCalled()
    })
  })

  describe("error handling", () => {
    it("should silently handle play rejection (autoplay blocked)", () => {
      const video = createAutoplayVideo()
      jest.spyOn(video, "play").mockRejectedValue(new Error("NotAllowedError"))

      loadScript()

      // Should not throw
      expect(() => {
        dispatchEvent(new Event("DOMContentLoaded"))
      }).not.toThrow()
    })

    it("should handle undefined play promise", () => {
      const video = createAutoplayVideo()
      // Some older browsers return undefined from play()
      jest.spyOn(video, "play").mockReturnValue(undefined as unknown as Promise<void>)

      loadScript()

      // Should not throw
      expect(() => {
        dispatchEvent(new Event("DOMContentLoaded"))
      }).not.toThrow()
    })
  })

  describe("multiple videos", () => {
    it("should attempt to play all autoplay videos", () => {
      const video1 = createAutoplayVideo()
      const video2 = createAutoplayVideo()

      const playSpy1 = jest.spyOn(video1, "play").mockResolvedValue(undefined)
      const playSpy2 = jest.spyOn(video2, "play").mockResolvedValue(undefined)

      loadScript()
      dispatchEvent(new Event("DOMContentLoaded"))

      expect(playSpy1).toHaveBeenCalled()
      expect(playSpy2).toHaveBeenCalled()
    })
  })

  describe("non-autoplay videos", () => {
    it("should not attempt to play videos without autoplay attribute", () => {
      const video = document.createElement("video")
      document.body.appendChild(video)
      const playSpy = jest.spyOn(video, "play").mockResolvedValue(undefined)

      loadScript()
      dispatchEvent(new Event("DOMContentLoaded"))

      expect(playSpy).not.toHaveBeenCalled()
    })
  })
})
