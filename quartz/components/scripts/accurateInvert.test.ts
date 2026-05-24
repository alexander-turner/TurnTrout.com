/**
 * @jest-environment jest-fixed-jsdom
 */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

import {
  handleLoadEvent,
  invertColorToken,
  invertCssColors,
  invertSvgSource,
  isDarkMode,
  isInsidePicture,
  isSvgSrc,
  onThemeChange,
  processImage,
  processLoaded,
  processPictureRaster,
  processSvgImage,
  revertImage,
  revertProcessed,
  shouldProcess,
} from "./accurateInvert"

describe("isSvgSrc", () => {
  it.each([
    ["https://x/chart.svg", true],
    ["https://x/chart.SVG", true],
    ["https://x/chart.svg?v=2", true],
    ["https://x/chart.svg#anchor", true],
    ["https://x/photo.png", false],
    ["data:image/png;base64,AAA", false],
  ])("%s → %s", (src, expected) => {
    expect(isSvgSrc(src)).toBe(expected)
  })
})

describe("invertColorToken", () => {
  it.each([
    ["white", "#000000"],
    ["#ffffff", "#000000"],
    ["#000000", "#ffffff"],
    ["rgb(200, 100, 50)", "#cd6937"],
  ])("inverts %s lightness → %s", (input, expected) => {
    expect(invertColorToken(input)).toBe(expected)
  })

  it.each(["none", "currentColor", "url(#grad)", "transparent", "garbage"])(
    "returns null for non-displayable token %s",
    (token) => {
      expect(invertColorToken(token)).toBeNull()
    },
  )
})

describe("invertCssColors", () => {
  it("rewrites recognized properties, leaves others alone", () => {
    const input = "fill: white; stroke: #000; opacity: 0.5; color: red"
    const out = invertCssColors(input)
    expect(out).toContain("fill: #000000")
    expect(out).toContain("stroke: #ffffff")
    expect(out).toContain("opacity: 0.5")
    expect(out).toContain("color:")
  })

  it("leaves non-displayable colors untouched", () => {
    expect(invertCssColors("fill: none")).toBe("fill: none")
  })
})

describe("invertSvgSource", () => {
  it("HSL-inverts fill / stroke / style declarations", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <rect fill="white" stroke="#000" />
      <path style="fill: rgb(200, 100, 50)" />
      <style>circle { fill: white; }</style>
    </svg>`
    const out = invertSvgSource(svg)
    expect(out).toContain('fill="#000000"')
    expect(out).toContain('stroke="#ffffff"')
    expect(out).toContain("fill: #cd6937")
    expect(out).toContain("fill: #000000")
  })

  it("returns input unchanged on parse error", () => {
    const broken = "<svg><not-closed>"
    expect(invertSvgSource(broken)).toBe(broken)
  })
})

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

const mockFetchText = (text: string, ok = true): jest.Mock => {
  const fn = jest.fn(async () =>
    Promise.resolve({ ok, status: ok ? 200 : 500, text: async () => text }),
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).fetch = fn
  return fn
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

describe("processPictureRaster", () => {
  it("stashes original, swaps src, marks processed only on successful load", () => {
    const img = makePictureWrappedImg("https://x/foo.avif")
    expect(processPictureRaster(img)).toBe(true)
    expect(img.dataset["invertOriginalSrc"]).toBe("https://x/foo.avif")
    expect(img.src).toBe("https://x/foo-inverted.avif")
    // Marker only lands after the swapped src finishes loading; until
    // then the CSS feColorMatrix fallback keeps approximating the
    // inversion so a 404 / slow swap doesn't flash to an unfiltered
    // light bitmap.
    expect(img.dataset["invertProcessed"]).toBeUndefined()
    dispatchSwapLoad(img)
    expect(img.dataset["invertProcessed"]).toBe("1")
  })

  it("leaves processed unset when the swap fails to load", () => {
    const img = makePictureWrappedImg("https://x/foo.avif")
    processPictureRaster(img)
    img.dispatchEvent(new Event("error"))
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })

  it("ignores a load event that arrives after the swap was reverted", () => {
    // Fast dark→light toggle: revert beats the inverted load to the
    // event queue, so the pending load handler fires for the original
    // src reload — *not* the inverted swap. Setting processed there
    // would short-circuit the next dark toggle in processImage.
    const img = makePictureWrappedImg("https://x/foo.avif")
    processPictureRaster(img)
    expect(img.src).toBe("https://x/foo-inverted.avif")
    revertImage(img)
    expect(img.src).toBe("https://x/foo.avif")
    dispatchSwapLoad(img)
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })

  it("marks processed immediately when the browser already picked the inverted source", () => {
    const img = makePictureWrappedImg("https://x/foo.avif")
    // currentSrc is what the browser actually loaded; <picture>
    // selection may resolve it to the inverted variant when
    // prefers-color-scheme matches the user's theme.
    Object.defineProperty(img, "currentSrc", {
      value: "https://x/foo-inverted.avif",
      configurable: true,
    })
    expect(processPictureRaster(img)).toBe(true)
    // Marker lands synchronously (no need to wait for a load that
    // would just be a cache hit), and the original is stashed so a
    // theme→light revert can restore it.
    expect(img.dataset["invertProcessed"]).toBe("1")
    expect(img.dataset["invertOriginalSrc"]).toBe("https://x/foo.avif")
    expect(img.src).toBe("https://x/foo-inverted.avif")
  })

  it("preserves the first stashed original across re-process cycles", () => {
    const img = makePictureWrappedImg("https://x/foo.avif")
    processPictureRaster(img)
    dispatchSwapLoad(img)
    revertImage(img)
    processPictureRaster(img)
    expect(img.dataset["invertOriginalSrc"]).toBe("https://x/foo.avif")
  })
})

describe("processImage", () => {
  it("routes picture-wrapped raster to processPictureRaster", async () => {
    const img = makePictureWrappedImg("https://x/photo.avif")
    await expect(processImage(img)).resolves.toBe(true)
    expect(img.src).toBe("https://x/photo-inverted.avif")
    dispatchSwapLoad(img)
    expect(img.dataset["invertProcessed"]).toBe("1")
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

  it("returns false for an unwrapped raster (no fallback canvas path)", async () => {
    // Unwrapped invert imgs should be wrapped at build time; if we see
    // one at runtime, do nothing rather than reading from the canvas.
    const img = makeLoadedImg("https://x/orphan.avif")
    await expect(processImage(img)).resolves.toBe(false)
  })

  it("routes .svg sources to the SVG path", async () => {
    mockFetchText('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="white"/></svg>')
    const img = makeLoadedImg("https://x/chart.svg")
    await expect(processImage(img)).resolves.toBe(true)
    expect(img.src.startsWith("data:image/svg+xml;utf8,")).toBe(true)
    expect(decodeURIComponent(img.src)).toContain('fill="#000000"')
  })

  it("ignores query/hash when detecting SVG sources", async () => {
    mockFetchText('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="black"/></svg>')
    const img = makeLoadedImg("https://x/chart.svg?v=2#id")
    await processImage(img)
    expect(img.src.startsWith("data:image/svg+xml;utf8,")).toBe(true)
  })
})

describe("processSvgImage", () => {
  it("returns false on fetch !ok", async () => {
    mockFetchText("", false)
    const img = makeLoadedImg("https://x/chart.svg")
    await expect(processSvgImage(img)).resolves.toBe(false)
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })

  it("returns false and clears in-flight flag on fetch throw", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).fetch = jest.fn(() => Promise.reject(new Error("net")))
    const img = makeLoadedImg("https://x/chart.svg")
    await expect(processSvgImage(img)).resolves.toBe(false)
    expect(img.dataset["invertProcessing"]).toBeUndefined()
  })

  it("guards against concurrent re-entry", async () => {
    const fetchFn = mockFetchText('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    const img = makeLoadedImg("https://x/chart.svg")
    img.dataset["invertProcessing"] = "1"
    await expect(processSvgImage(img)).resolves.toBe(false)
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe("revertImage", () => {
  it("restores the original src and clears the processed flag", () => {
    const img = makePictureWrappedImg("https://x/img.avif")
    processPictureRaster(img)
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
