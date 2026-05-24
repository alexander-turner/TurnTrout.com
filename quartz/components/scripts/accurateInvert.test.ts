/**
 * @jest-environment jest-fixed-jsdom
 */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

import {
  handleLoadEvent,
  isDarkMode,
  isInsidePicture,
  onThemeChange,
  processImage,
  processLoaded,
  processPictureImage,
  revertImage,
  revertProcessed,
  shouldProcess,
} from "./accurateInvert"

const setTheme = (theme: "dark" | "light"): void => {
  document.documentElement.setAttribute("data-theme", theme)
}

/** Build a `<picture><img></picture>` so `processImage` routes the img
 * through the precomputed-variant path (no canvas read). */
const makePictureWrappedImg = (src = "https://x/img.avif"): HTMLImageElement => {
  const picture = document.createElement("picture")
  const img = makeLoadedImg(src)
  picture.appendChild(img)
  return img
}

const makeLoadedImg = (
  src = "https://x/img.avif",
  className = "invert-in-dark-mode",
): HTMLImageElement => {
  const img = document.createElement("img")
  img.classList.add(className)
  img.src = src
  Object.defineProperty(img, "complete", { value: true, configurable: true })
  Object.defineProperty(img, "naturalWidth", { value: 1, configurable: true })
  Object.defineProperty(img, "naturalHeight", { value: 1, configurable: true })
  return img
}

const flushAsync = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

/** Dispatch a `load` event matching the swap's intended target. The
 * client guards `data-invert-processed` on `isInvertedUrl(img.currentSrc)`
 * so the real `currentSrc` (which the browser updates after a
 * successful fetch) needs simulating. */
const dispatchSwapLoad = (img: HTMLImageElement): void => {
  Object.defineProperty(img, "currentSrc", { value: img.src, configurable: true })
  img.dispatchEvent(new Event("load"))
}

/** Sweep helper for tests that exercise `processLoaded` / `onThemeChange`
 * and then assert the processed marker landed on every picture-wrapped
 * img. */
const finishPendingPictureSwaps = (): void => {
  for (const img of document.querySelectorAll<HTMLImageElement>("picture > img")) {
    if (!img.dataset["invertProcessed"]) dispatchSwapLoad(img)
  }
}

beforeEach(() => {
  document.body.innerHTML = ""
  setTheme("dark")
})
afterEach(() => {
  jest.restoreAllMocks()
  document.documentElement.removeAttribute("data-theme")
})

describe("isDarkMode", () => {
  it.each<["dark" | "light", boolean]>([
    ["dark", true],
    ["light", false],
  ])("data-theme=%s yields %s", (theme, expected) => {
    setTheme(theme)
    expect(isDarkMode()).toBe(expected)
  })

  it("returns false when data-theme is absent", () => {
    document.documentElement.removeAttribute("data-theme")
    expect(isDarkMode()).toBe(false)
  })
})

describe("shouldProcess", () => {
  it.each<[string, "dark" | "light", string, boolean]>([
    ["invert-in-dark-mode + dark theme", "dark", "invert-in-dark-mode", true],
    ["invert-in-dark-mode + light theme", "light", "invert-in-dark-mode", false],
    ["force-hsl-invert + dark theme", "dark", "force-hsl-invert", true],
    ["force-hsl-invert + light theme", "light", "force-hsl-invert", true],
  ])("%s → %s", (_label, theme, className, expected) => {
    setTheme(theme)
    expect(shouldProcess(makeLoadedImg("https://x/y.avif", className))).toBe(expected)
  })
})

describe("isInsidePicture", () => {
  it("returns true when parent is a <picture>", () => {
    expect(isInsidePicture(makePictureWrappedImg())).toBe(true)
  })

  it("returns false for a bare img", () => {
    expect(isInsidePicture(document.createElement("img"))).toBe(false)
  })

  it("returns false when parent is some other element", () => {
    const div = document.createElement("div")
    const img = document.createElement("img")
    div.appendChild(img)
    expect(isInsidePicture(img)).toBe(false)
  })
})

describe("processPictureImage", () => {
  it("stashes original, swaps src, marks processed only on successful load", () => {
    const img = makePictureWrappedImg("https://x/foo.avif")
    expect(processPictureImage(img)).toBe(true)
    expect(img.dataset["invertOriginalSrc"]).toBe("https://x/foo.avif")
    expect(img.src).toBe("https://x/foo-inverted.avif")
    expect(img.dataset["invertProcessed"]).toBeUndefined()
    dispatchSwapLoad(img)
    expect(img.dataset["invertProcessed"]).toBe("1")
  })

  it("leaves processed unset when the swap fails to load", () => {
    const img = makePictureWrappedImg("https://x/foo.avif")
    processPictureImage(img)
    img.dispatchEvent(new Event("error"))
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })

  it("ignores a load event that arrives after the swap was reverted", () => {
    const img = makePictureWrappedImg("https://x/foo.avif")
    processPictureImage(img)
    expect(img.src).toBe("https://x/foo-inverted.avif")
    revertImage(img)
    expect(img.src).toBe("https://x/foo.avif")
    dispatchSwapLoad(img)
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })

  it("marks processed immediately when the browser already picked the inverted source", () => {
    const img = makePictureWrappedImg("https://x/foo.avif")
    Object.defineProperty(img, "currentSrc", {
      value: "https://x/foo-inverted.avif",
      configurable: true,
    })
    expect(processPictureImage(img)).toBe(true)
    expect(img.dataset["invertProcessed"]).toBe("1")
    expect(img.dataset["invertOriginalSrc"]).toBe("https://x/foo.avif")
    expect(img.src).toBe("https://x/foo-inverted.avif")
  })

  it("preserves the first stashed original across re-process cycles", () => {
    const img = makePictureWrappedImg("https://x/foo.avif")
    processPictureImage(img)
    dispatchSwapLoad(img)
    revertImage(img)
    processPictureImage(img)
    expect(img.dataset["invertOriginalSrc"]).toBe("https://x/foo.avif")
  })
})

describe("processImage", () => {
  it("routes picture-wrapped image to processPictureImage", async () => {
    const img = makePictureWrappedImg("https://x/photo.avif")
    await expect(processImage(img)).resolves.toBe(true)
    expect(img.src).toBe("https://x/photo-inverted.avif")
    dispatchSwapLoad(img)
    expect(img.dataset["invertProcessed"]).toBe("1")
  })

  it("routes picture-wrapped SVG to processPictureImage", async () => {
    const img = makePictureWrappedImg("https://x/chart.svg")
    await expect(processImage(img)).resolves.toBe(true)
    expect(img.src).toBe("https://x/chart-inverted.svg")
  })

  it("does nothing in light mode", async () => {
    setTheme("light")
    await expect(processImage(makePictureWrappedImg())).resolves.toBe(false)
  })

  it("is idempotent — second call short-circuits", async () => {
    const img = makePictureWrappedImg("https://x/photo.avif")
    await processImage(img)
    dispatchSwapLoad(img)
    await expect(processImage(img)).resolves.toBe(false)
  })

  it.each([
    [
      "image hasn't decoded yet",
      (img: HTMLImageElement) => {
        Object.defineProperty(img, "complete", { value: false, configurable: true })
      },
    ],
    [
      "broken image (naturalWidth=0)",
      (img: HTMLImageElement) => {
        Object.defineProperty(img, "naturalWidth", { value: 0, configurable: true })
      },
    ],
  ])("returns false when %s", async (_label, mutate) => {
    const img = makePictureWrappedImg()
    mutate(img)
    await expect(processImage(img)).resolves.toBe(false)
  })

  it("returns false for an unwrapped image (no fallback path)", async () => {
    const img = makeLoadedImg("https://x/orphan.avif")
    await expect(processImage(img)).resolves.toBe(false)
  })
})

describe("revertImage", () => {
  it("restores the original src and clears the processed flag", () => {
    const img = makePictureWrappedImg("https://x/img.avif")
    processPictureImage(img)
    dispatchSwapLoad(img)
    expect(revertImage(img)).toBe(true)
    expect(img.src).toBe("https://x/img.avif")
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })

  it("returns false when there is no stashed original", () => {
    expect(revertImage(makeLoadedImg())).toBe(false)
  })
})

describe("handleLoadEvent", () => {
  it("processes a loaded eligible image", async () => {
    const img = makePictureWrappedImg()
    document.body.appendChild(img.parentElement as HTMLElement)
    handleLoadEvent({ target: img } as unknown as Event)
    await flushAsync()
    finishPendingPictureSwaps()
    expect(img.dataset["invertProcessed"]).toBe("1")
  })

  it("ignores non-eligible targets", () => {
    handleLoadEvent({ target: document.createElement("div") } as unknown as Event)
    handleLoadEvent({ target: null } as unknown as Event)
  })
})

describe("processLoaded", () => {
  it("processes all eligible decoded imgs under root", async () => {
    const a = makePictureWrappedImg("https://x/a.avif")
    const b = makePictureWrappedImg("https://x/b.avif")
    document.body.append(a.parentElement as HTMLElement, b.parentElement as HTMLElement)
    processLoaded()
    await flushAsync()
    finishPendingPictureSwaps()
    expect(a.dataset["invertProcessed"]).toBe("1")
    expect(b.dataset["invertProcessed"]).toBe("1")
  })

  it("skips imgs that haven't decoded yet", async () => {
    const img = makePictureWrappedImg("https://x/a.avif")
    Object.defineProperty(img, "complete", { value: false, configurable: true })
    document.body.appendChild(img.parentElement as HTMLElement)
    processLoaded()
    await flushAsync()
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })
})

describe("revertProcessed", () => {
  it("reverts every processed img under root", async () => {
    const a = makePictureWrappedImg("https://x/a.avif")
    const b = makePictureWrappedImg("https://x/b.avif")
    document.body.append(a.parentElement as HTMLElement, b.parentElement as HTMLElement)
    processLoaded()
    await flushAsync()
    finishPendingPictureSwaps()
    revertProcessed()
    expect(a.src).toBe("https://x/a.avif")
    expect(b.src).toBe("https://x/b.avif")
    expect(a.dataset["invertProcessed"]).toBeUndefined()
    expect(b.dataset["invertProcessed"]).toBeUndefined()
  })

  it("leaves force-hsl-invert images alone (REVERTABLE_SELECTOR excludes them)", async () => {
    const forced = makePictureWrappedImg("https://x/forced.avif")
    forced.classList.add("force-hsl-invert")
    document.body.appendChild(forced.parentElement as HTMLElement)
    await processImage(forced)
    dispatchSwapLoad(forced)
    expect(forced.dataset["invertProcessed"]).toBe("1")
    revertProcessed()
    expect(forced.dataset["invertProcessed"]).toBe("1")
    expect(forced.src).toBe("https://x/forced-inverted.avif")
  })
})

describe("onThemeChange", () => {
  it("processes loaded images when theme is dark", async () => {
    const img = makePictureWrappedImg()
    document.body.appendChild(img.parentElement as HTMLElement)
    setTheme("light")
    expect(img.dataset["invertProcessed"]).toBeUndefined()
    setTheme("dark")
    onThemeChange()
    await flushAsync()
    finishPendingPictureSwaps()
    expect(img.dataset["invertProcessed"]).toBe("1")
  })

  it("reverts processed images when theme is light", async () => {
    const img = makePictureWrappedImg("https://x/img.avif")
    document.body.appendChild(img.parentElement as HTMLElement)
    await processImage(img)
    dispatchSwapLoad(img)
    setTheme("light")
    onThemeChange()
    expect(img.src).toBe("https://x/img.avif")
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })
})
