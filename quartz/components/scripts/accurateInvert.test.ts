/**
 * @jest-environment jest-fixed-jsdom
 */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

import {
  handleLoadEvent,
  invertDecodedImages,
  invertImage,
  invertPictureSrc,
  isDarkMode,
  isInsidePicture,
  onThemeChange,
  prepareForThemeChange,
  revertAllInverted,
  revertImage,
  shouldInvert,
  syncPictureSources,
} from "./accurateInvert"

const setTheme = (theme: "dark" | "light"): void => {
  document.documentElement.setAttribute("data-theme", theme)
}

const mockSystemDark = (dark: boolean): void => {
  Object.defineProperty(window, "matchMedia", {
    value: () => ({ matches: dark }),
    writable: true,
    configurable: true,
  })
}

/** Build a `<picture><source><img></picture>` matching the build-time
 * output of `wrapInDarkModePicture`. */
const makePictureWrappedImg = (src = "https://x/img.avif"): HTMLImageElement => {
  const picture = document.createElement("picture")
  const source = document.createElement("source")
  source.media = "(prefers-color-scheme: dark)"
  source.srcset = src.replace(/(\.\w+)$/, "-inverted$1")
  picture.appendChild(source)
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
  img.decode ??= () => Promise.resolve()
  return img
}

const dispatchSwapLoad = (img: HTMLImageElement): void => {
  Object.defineProperty(img, "currentSrc", { value: img.src, configurable: true })
  img.dispatchEvent(new Event("load"))
}

const getSourceSrcset = (img: HTMLImageElement): string =>
  img.parentElement!.querySelector("source")!.srcset

const getSourceMedia = (img: HTMLImageElement): string | null =>
  img.parentElement!.querySelector("source")!.getAttribute("media")

const finishPendingPictureSwaps = (): void => {
  for (const img of document.querySelectorAll<HTMLImageElement>("picture > img")) {
    if (!img.dataset["invertProcessed"]) dispatchSwapLoad(img)
  }
}

beforeEach(() => {
  document.body.innerHTML = ""
  setTheme("dark")
  mockSystemDark(true)
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

describe("shouldInvert", () => {
  it.each<[string, "dark" | "light", string, boolean]>([
    ["invert-in-dark-mode + dark theme", "dark", "invert-in-dark-mode", true],
    ["invert-in-dark-mode + light theme", "light", "invert-in-dark-mode", false],
    ["force-hsl-invert + dark theme", "dark", "force-hsl-invert", true],
    ["force-hsl-invert + light theme", "light", "force-hsl-invert", true],
  ])("%s → %s", (_label, theme, className, expected) => {
    setTheme(theme)
    expect(shouldInvert(makeLoadedImg("https://x/y.avif", className))).toBe(expected)
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

describe("invertPictureSrc", () => {
  it("stashes original, swaps src, marks processed only on successful load", () => {
    const img = makePictureWrappedImg("https://x/foo.avif")
    expect(invertPictureSrc(img)).toBe(true)
    expect(img.dataset["invertOriginalSrc"]).toBe("https://x/foo.avif")
    expect(img.src).toBe("https://x/foo-inverted.avif")
    expect(img.dataset["invertProcessed"]).toBeUndefined()
    dispatchSwapLoad(img)
    expect(img.dataset["invertProcessed"]).toBe("1")
  })

  it("leaves processed unset when the swap fails to load", () => {
    const img = makePictureWrappedImg("https://x/foo.avif")
    invertPictureSrc(img)
    img.dispatchEvent(new Event("error"))
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })

  it("ignores a load event that arrives after uninversion", () => {
    const img = makePictureWrappedImg("https://x/foo.avif")
    invertPictureSrc(img)
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
    expect(invertPictureSrc(img)).toBe(true)
    expect(img.dataset["invertProcessed"]).toBe("1")
    expect(img.dataset["invertOriginalSrc"]).toBe("https://x/foo.avif")
    expect(img.src).toBe("https://x/foo-inverted.avif")
  })

  it("preserves the first stashed original across re-invert cycles", () => {
    const img = makePictureWrappedImg("https://x/foo.avif")
    invertPictureSrc(img)
    dispatchSwapLoad(img)
    revertImage(img)
    invertPictureSrc(img)
    expect(img.dataset["invertOriginalSrc"]).toBe("https://x/foo.avif")
  })
})

describe("invertImage", () => {
  it("routes picture-wrapped image to invertPictureSrc", () => {
    const img = makePictureWrappedImg("https://x/photo.avif")
    expect(invertImage(img)).toBe(true)
    expect(img.src).toBe("https://x/photo-inverted.avif")
    dispatchSwapLoad(img)
    expect(img.dataset["invertProcessed"]).toBe("1")
  })

  it("routes picture-wrapped SVG to invertPictureSrc", () => {
    const img = makePictureWrappedImg("https://x/chart.svg")
    expect(invertImage(img)).toBe(true)
    expect(img.src).toBe("https://x/chart-inverted.svg")
  })

  it("does nothing in light mode", () => {
    setTheme("light")
    expect(invertImage(makePictureWrappedImg())).toBe(false)
  })

  it("is idempotent — second call short-circuits", () => {
    const img = makePictureWrappedImg("https://x/photo.avif")
    invertImage(img)
    dispatchSwapLoad(img)
    expect(invertImage(img)).toBe(false)
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
  ])("returns false when %s", (_label, mutate) => {
    const img = makePictureWrappedImg()
    mutate(img)
    expect(invertImage(img)).toBe(false)
  })

  it("returns false for an unwrapped image (no fallback path)", () => {
    const img = makeLoadedImg("https://x/orphan.avif")
    expect(invertImage(img)).toBe(false)
  })
})

describe("revertImage", () => {
  it("restores the original src and clears the processed flag", () => {
    const img = makePictureWrappedImg("https://x/img.avif")
    invertPictureSrc(img)
    dispatchSwapLoad(img)
    expect(revertImage(img)).toBe(true)
    expect(img.src).toBe("https://x/img.avif")
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })

  it("sets <source> srcset to original so system dark preference cannot override", () => {
    const img = makePictureWrappedImg("https://x/img.avif")
    invertPictureSrc(img)
    dispatchSwapLoad(img)
    expect(getSourceSrcset(img)).toBe("https://x/img-inverted.avif")
    revertImage(img)
    expect(getSourceSrcset(img)).toBe("https://x/img.avif")
  })

  it("returns false when there is no stashed original", () => {
    expect(revertImage(makeLoadedImg())).toBe(false)
  })
})

describe("handleLoadEvent", () => {
  it("inverts a loaded eligible image", () => {
    const img = makePictureWrappedImg()
    document.body.appendChild(img.parentElement as HTMLElement)
    handleLoadEvent({ target: img } as unknown as Event)

    finishPendingPictureSwaps()
    expect(img.dataset["invertProcessed"]).toBe("1")
  })

  it("ignores non-eligible targets", () => {
    handleLoadEvent({ target: document.createElement("div") } as unknown as Event)
    handleLoadEvent({ target: null } as unknown as Event)
  })
})

describe("invertDecodedImages", () => {
  it("inverts all eligible decoded imgs under root", () => {
    const a = makePictureWrappedImg("https://x/a.avif")
    const b = makePictureWrappedImg("https://x/b.avif")
    document.body.append(a.parentElement as HTMLElement, b.parentElement as HTMLElement)
    invertDecodedImages()

    finishPendingPictureSwaps()
    expect(a.dataset["invertProcessed"]).toBe("1")
    expect(b.dataset["invertProcessed"]).toBe("1")
  })

  it("skips imgs that haven't decoded yet", () => {
    const img = makePictureWrappedImg("https://x/a.avif")
    Object.defineProperty(img, "complete", { value: false, configurable: true })
    document.body.appendChild(img.parentElement as HTMLElement)
    invertDecodedImages()

    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })
})

describe("revertAllInverted", () => {
  it("uninverts every processed img under root", () => {
    const a = makePictureWrappedImg("https://x/a.avif")
    const b = makePictureWrappedImg("https://x/b.avif")
    document.body.append(a.parentElement as HTMLElement, b.parentElement as HTMLElement)
    invertDecodedImages()

    finishPendingPictureSwaps()
    revertAllInverted()
    expect(a.src).toBe("https://x/a.avif")
    expect(b.src).toBe("https://x/b.avif")
    expect(a.dataset["invertProcessed"]).toBeUndefined()
    expect(b.dataset["invertProcessed"]).toBeUndefined()
  })

  it("leaves force-hsl-invert images alone", () => {
    const forced = makePictureWrappedImg("https://x/forced.avif")
    forced.classList.add("force-hsl-invert")
    document.body.appendChild(forced.parentElement as HTMLElement)
    invertImage(forced)
    dispatchSwapLoad(forced)
    expect(forced.dataset["invertProcessed"]).toBe("1")
    revertAllInverted()
    expect(forced.dataset["invertProcessed"]).toBe("1")
    expect(forced.src).toBe("https://x/forced-inverted.avif")
  })
})

describe("syncPictureSources", () => {
  it.each<["dark" | "light", string]>([
    ["light", "https://x/a.avif"],
    ["dark", "https://x/a-inverted.avif"],
  ])("sets <source> srcset correctly in %s mode", (theme, expected) => {
    setTheme(theme)
    mockSystemDark(theme === "dark")
    const img = makePictureWrappedImg("https://x/a.avif")
    document.body.appendChild(img.parentElement as HTMLElement)
    syncPictureSources()
    expect(getSourceSrcset(img)).toBe(expected)
  })

  it("handles unprocessed images that have not loaded yet", () => {
    mockSystemDark(false)
    setTheme("light")
    const img = makePictureWrappedImg("https://x/lazy.avif")
    Object.defineProperty(img, "complete", { value: false, configurable: true })
    document.body.appendChild(img.parentElement as HTMLElement)
    syncPictureSources()
    expect(getSourceSrcset(img)).toBe("https://x/lazy.avif")
  })

  it("excludes force-hsl-invert images", () => {
    mockSystemDark(false)
    setTheme("light")
    const img = makePictureWrappedImg("https://x/forced.avif")
    img.classList.add("force-hsl-invert")
    document.body.appendChild(img.parentElement as HTMLElement)
    syncPictureSources()
    expect(getSourceSrcset(img)).toBe("https://x/forced-inverted.avif")
  })

  it("no-ops gracefully when <source> is absent", () => {
    mockSystemDark(false)
    setTheme("light")
    const img = makePictureWrappedImg("https://x/nosrc.avif")
    img.parentElement!.querySelector("source")!.remove()
    document.body.appendChild(img.parentElement as HTMLElement)
    expect(() => syncPictureSources()).not.toThrow()
  })

  it("removes media attribute when theme disagrees with system", () => {
    mockSystemDark(true)
    setTheme("light")
    const img = makePictureWrappedImg("https://x/a.avif")
    document.body.appendChild(img.parentElement as HTMLElement)
    syncPictureSources()
    expect(getSourceSrcset(img)).toBe("https://x/a.avif")
    expect(getSourceMedia(img)).toBeNull()
  })

  it("restores media attribute when theme agrees with system", () => {
    mockSystemDark(true)
    setTheme("dark")
    const img = makePictureWrappedImg("https://x/a.avif")
    document.body.appendChild(img.parentElement as HTMLElement)
    const source = img.parentElement!.querySelector("source")!
    source.removeAttribute("media")
    syncPictureSources()
    expect(getSourceMedia(img)).toBe("(prefers-color-scheme: dark)")
  })
})

describe("onThemeChange", () => {
  it("inverts loaded images when theme is dark", () => {
    mockSystemDark(true)
    const img = makePictureWrappedImg()
    document.body.appendChild(img.parentElement as HTMLElement)
    setTheme("light")
    expect(img.dataset["invertProcessed"]).toBeUndefined()
    setTheme("dark")
    onThemeChange()

    finishPendingPictureSwaps()
    expect(img.dataset["invertProcessed"]).toBe("1")
  })

  it("uninverts processed images when theme is light", () => {
    mockSystemDark(false)
    const img = makePictureWrappedImg("https://x/img.avif")
    document.body.appendChild(img.parentElement as HTMLElement)
    invertImage(img)
    dispatchSwapLoad(img)
    setTheme("light")
    onThemeChange()
    expect(img.src).toBe("https://x/img.avif")
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })

  it("syncs <source> srcset for lazy images not yet processed", () => {
    mockSystemDark(true)
    const img = makePictureWrappedImg("https://x/lazy.avif")
    Object.defineProperty(img, "complete", { value: false, configurable: true })
    document.body.appendChild(img.parentElement as HTMLElement)
    setTheme("light")
    onThemeChange()
    expect(getSourceSrcset(img)).toBe("https://x/lazy.avif")
  })
})

describe("prepareForThemeChange", () => {
  it("swaps to inverted src before dark-mode CSS applies", async () => {
    mockSystemDark(false)
    const img = makePictureWrappedImg("https://x/img.avif")
    document.body.appendChild(img.parentElement as HTMLElement)

    await prepareForThemeChange(true)
    expect(img.src).toBe("https://x/img-inverted.avif")
    expect(getSourceSrcset(img)).toBe("https://x/img-inverted.avif")
  })

  it("reverts to original src before light-mode CSS applies", async () => {
    mockSystemDark(false)
    const img = makePictureWrappedImg("https://x/img.avif")
    document.body.appendChild(img.parentElement as HTMLElement)
    invertImage(img)
    dispatchSwapLoad(img)

    await prepareForThemeChange(false)
    expect(img.src).toBe("https://x/img.avif")
    expect(getSourceSrcset(img)).toBe("https://x/img.avif")
    expect(getSourceMedia(img)).toBe("(prefers-color-scheme: dark)")
  })

  it("handles picture without source gracefully", async () => {
    mockSystemDark(false)
    const img = makePictureWrappedImg("https://x/img.avif")
    img.parentElement!.querySelector("source")!.remove()
    document.body.appendChild(img.parentElement as HTMLElement)

    await prepareForThemeChange(true)
    expect(img.src).toBe("https://x/img-inverted.avif")
  })

  it("syncs source for unprocessed images using img.src as fallback", async () => {
    mockSystemDark(true)
    const img = makePictureWrappedImg("https://x/img.avif")
    document.body.appendChild(img.parentElement as HTMLElement)

    await prepareForThemeChange(true)
    expect(getSourceSrcset(img)).toBe("https://x/img-inverted.avif")
  })

  it("is a no-op when no images need swapping", async () => {
    await prepareForThemeChange(true)
    await prepareForThemeChange(false)
  })
})

describe("stress tests", () => {
  it("rapid dark→light→dark→light toggle leaves everything consistent", () => {
    const imgs = ["https://x/a.avif", "https://x/b.avif", "https://x/c.avif"].map((src) => {
      const img = makePictureWrappedImg(src)
      document.body.appendChild(img.parentElement as HTMLElement)
      return img
    })

    mockSystemDark(true)
    setTheme("dark")
    onThemeChange()

    finishPendingPictureSwaps()

    for (let i = 0; i < 3; i++) {
      setTheme("light")
      onThemeChange()
      for (const img of imgs) {
        expect(img.src).toMatch(/(?<!-inverted)\.\w+$/)
        expect(getSourceSrcset(img)).toMatch(/(?<!-inverted)\.\w+$/)
      }
      setTheme("dark")
      onThemeChange()

      finishPendingPictureSwaps()
      for (const img of imgs) {
        expect(img.src).toMatch(/-inverted\.\w+$/)
        expect(getSourceSrcset(img)).toMatch(/-inverted\.\w+$/)
      }
    }
  })

  it("mixed loaded and lazy images all get correct <source> on light toggle", () => {
    mockSystemDark(true)
    const loaded = makePictureWrappedImg("https://x/loaded.avif")
    const lazy = makePictureWrappedImg("https://x/lazy.avif")
    Object.defineProperty(lazy, "complete", { value: false, configurable: true })
    document.body.append(loaded.parentElement as HTMLElement, lazy.parentElement as HTMLElement)

    setTheme("dark")
    onThemeChange()
    finishPendingPictureSwaps()
    expect(loaded.dataset["invertProcessed"]).toBe("1")
    expect(lazy.dataset["invertProcessed"]).toBeUndefined()

    setTheme("light")
    onThemeChange()
    expect(getSourceSrcset(loaded)).toBe("https://x/loaded.avif")
    expect(getSourceSrcset(lazy)).toBe("https://x/lazy.avif")
    expect(loaded.src).toBe("https://x/loaded.avif")
  })

  it("dark→light→dark restores <source> srcset and media", () => {
    mockSystemDark(true)
    const img = makePictureWrappedImg("https://x/rt.avif")
    document.body.appendChild(img.parentElement as HTMLElement)

    setTheme("dark")
    onThemeChange()

    finishPendingPictureSwaps()
    expect(getSourceSrcset(img)).toBe("https://x/rt-inverted.avif")
    expect(getSourceMedia(img)).toBe("(prefers-color-scheme: dark)")

    setTheme("light")
    onThemeChange()
    expect(getSourceSrcset(img)).toBe("https://x/rt.avif")
    expect(getSourceMedia(img)).toBeNull()

    setTheme("dark")
    onThemeChange()

    finishPendingPictureSwaps()
    expect(getSourceSrcset(img)).toBe("https://x/rt-inverted.avif")
    expect(getSourceMedia(img)).toBe("(prefers-color-scheme: dark)")
  })
})
