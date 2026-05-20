/**
 * @jest-environment jest-fixed-jsdom
 */
import { describe, it, beforeEach, afterEach, expect, jest } from "@jest/globals"

import {
  invertLightness,
  invertPixelsHSL,
  isDarkMode,
  shouldProcess,
  processImage,
  revertImage,
  handleLoadEvent,
  processLoaded,
  revertProcessed,
  onThemeChange,
} from "./accurate-invert"

describe("invertLightness", () => {
  const EPS = 2 // tolerance for 8-bit channel rounding through HSL.
  it.each<[string, [number, number, number], [number, number, number]]>([
    ["pure black → white", [0, 0, 0], [255, 255, 255]],
    ["pure white → black", [255, 255, 255], [0, 0, 0]],
    ["mid gray fixed point", [128, 128, 128], [127, 127, 127]],
    ["yellow is a fixed point", [255, 255, 0], [255, 255, 0]],
    ["red is a fixed point", [255, 0, 0], [255, 0, 0]],
    ["green is a fixed point", [0, 255, 0], [0, 255, 0]],
    ["blue is a fixed point", [0, 0, 255], [0, 0, 255]],
    ["light pink → dark red", [255, 200, 200], [55, 0, 0]],
    ["light green → dark green", [200, 255, 200], [0, 55, 0]],
    ["light blue → dark blue", [200, 200, 255], [0, 0, 55]],
    ["magenta-ish (g<b)", [200, 100, 150], [155, 55, 105]],
  ])("%s", (_label, input, expected) => {
    const result = invertLightness(...input)
    expect(Math.abs(result[0] - expected[0])).toBeLessThanOrEqual(EPS)
    expect(Math.abs(result[1] - expected[1])).toBeLessThanOrEqual(EPS)
    expect(Math.abs(result[2] - expected[2])).toBeLessThanOrEqual(EPS)
  })
})

describe("invertPixelsHSL", () => {
  it("inverts every pixel in place, leaving alpha untouched", () => {
    const px = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 128])
    invertPixelsHSL(px)
    expect(Array.from(px.slice(0, 3))).toEqual([255, 255, 255])
    expect(px[3]).toBe(255)
    expect(Array.from(px.slice(4, 7))).toEqual([0, 0, 0])
    expect(px[7]).toBe(128)
  })
})

const setTheme = (theme: "dark" | "light"): void => {
  document.documentElement.setAttribute("data-theme", theme)
}

type CanvasCtxMock = {
  drawImage: jest.Mock
  getImageData: jest.Mock
  putImageData: jest.Mock
}

const installCanvasMocks = (
  overrides: Partial<{ ctx: CanvasCtxMock | null; blob: Blob | null }> = {},
) => {
  const ctx: CanvasCtxMock = {
    drawImage: jest.fn(),
    getImageData: jest.fn(() => ({
      data: new Uint8ClampedArray([255, 255, 255, 255]),
    })),
    putImageData: jest.fn(),
  }
  const getContext = jest.fn(() => (overrides.ctx === null ? null : (overrides.ctx ?? ctx)))
  const stubBlob =
    overrides.blob === undefined ? new Blob(["x"], { type: "image/png" }) : overrides.blob
  const toBlob = jest.fn((cb: BlobCallback) => cb(stubBlob))
  const createObjectURL = jest.fn(() => "blob:stub/123")
  const revokeObjectURL = jest.fn()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  HTMLCanvasElement.prototype.getContext = getContext as any
  HTMLCanvasElement.prototype.toBlob = toBlob
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = revokeObjectURL
  return { ctx, getContext, toBlob, createObjectURL, revokeObjectURL }
}

// `toBlob` invokes its callback synchronously in the mock, but the awaited
// Promise still resolves on a microtask. Fire-and-forget callers
// (`handleLoadEvent`, `processLoaded`, `onThemeChange`) need this between
// the trigger and the assertion that checks `dataset["invertProcessed"]`.
const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

const makeLoadedImg = (
  src = "https://x/img.png",
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
    expect(shouldProcess(makeLoadedImg("https://x/y.png", className))).toBe(expected)
  })
})

describe("processImage", () => {
  it("inverts pixels, stashes original src, swaps src, marks processed", async () => {
    const { toBlob, createObjectURL } = installCanvasMocks()
    const img = makeLoadedImg()
    await expect(processImage(img)).resolves.toBe(true)
    expect(img.src).toBe("blob:stub/123")
    expect(img.dataset["invertProcessed"]).toBe("1")
    expect(img.dataset["invertOriginalSrc"]).toBe("https://x/img.png")
    expect(toBlob).toHaveBeenCalledTimes(1)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
  })

  it("does nothing in light mode", async () => {
    installCanvasMocks()
    setTheme("light")
    const img = makeLoadedImg()
    await expect(processImage(img)).resolves.toBe(false)
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })

  it("processes force-hsl-invert images in light mode", async () => {
    installCanvasMocks()
    setTheme("light")
    const img = makeLoadedImg("https://x/y.png", "force-hsl-invert")
    await expect(processImage(img)).resolves.toBe(true)
    expect(img.dataset["invertProcessed"]).toBe("1")
  })

  it("is idempotent — second call short-circuits", async () => {
    installCanvasMocks()
    const img = makeLoadedImg()
    await processImage(img)
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
    installCanvasMocks()
    const img = makeLoadedImg()
    mutate(img)
    await expect(processImage(img)).resolves.toBe(false)
  })

  it("returns false when getContext returns null", async () => {
    installCanvasMocks({ ctx: null })
    await expect(processImage(makeLoadedImg())).resolves.toBe(false)
  })

  it("returns false on CORS-tainted canvas (getImageData throws)", async () => {
    installCanvasMocks({
      ctx: {
        drawImage: jest.fn(),
        getImageData: jest.fn(() => {
          throw new Error("SecurityError")
        }),
        putImageData: jest.fn(),
      },
    })
    const img = makeLoadedImg()
    await expect(processImage(img)).resolves.toBe(false)
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })

  it("returns false when toBlob yields null (encoder failure)", async () => {
    installCanvasMocks({ blob: null })
    const img = makeLoadedImg()
    await expect(processImage(img)).resolves.toBe(false)
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })

  it("preserves the first stashed original across re-process cycles", async () => {
    installCanvasMocks()
    const img = makeLoadedImg("https://x/orig.png")
    await processImage(img)
    revertImage(img)
    // Re-set complete since revert changed src.
    Object.defineProperty(img, "complete", { value: true, configurable: true })
    await processImage(img)
    expect(img.dataset["invertOriginalSrc"]).toBe("https://x/orig.png")
  })
})

describe("revertImage", () => {
  it("restores original src, clears the processed flag, revokes blob URL", async () => {
    const { revokeObjectURL } = installCanvasMocks()
    const img = makeLoadedImg("https://x/orig.png")
    await processImage(img)
    expect(revertImage(img)).toBe(true)
    expect(img.src).toBe("https://x/orig.png")
    expect(img.dataset["invertProcessed"]).toBeUndefined()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:stub/123")
  })

  it("returns false when nothing was stashed", () => {
    const img = makeLoadedImg()
    expect(revertImage(img)).toBe(false)
  })

  it("does not revoke a non-blob src on revert", async () => {
    const { revokeObjectURL } = installCanvasMocks({ blob: null })
    const img = makeLoadedImg("https://x/orig.png")
    img.dataset["invertOriginalSrc"] = "https://x/orig.png"
    revertImage(img)
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })
})

describe("handleLoadEvent", () => {
  it("processes when target is an eligible img", async () => {
    installCanvasMocks()
    const img = makeLoadedImg()
    handleLoadEvent({ target: img } as unknown as Event)
    await flushMicrotasks()
    expect(img.dataset["invertProcessed"]).toBe("1")
  })

  it.each([
    ["non-image", () => document.createElement("div")],
    ["img without the class", () => document.createElement("img")],
  ])("ignores %s targets", async (_label, makeTarget) => {
    installCanvasMocks()
    const target = makeTarget()
    handleLoadEvent({ target } as unknown as Event)
    await flushMicrotasks()
    expect((target as HTMLElement).dataset["invertProcessed"]).toBeUndefined()
  })
})

describe("processLoaded", () => {
  it("processes every decoded img.invert-in-dark-mode in the root", async () => {
    installCanvasMocks()
    const a = makeLoadedImg("https://x/a.png")
    const b = makeLoadedImg("https://x/b.png")
    document.body.append(a, b)
    processLoaded()
    await flushMicrotasks()
    expect(a.dataset["invertProcessed"]).toBe("1")
    expect(b.dataset["invertProcessed"]).toBe("1")
  })

  it("also picks up force-hsl-invert images even in light mode", async () => {
    installCanvasMocks()
    setTheme("light")
    const forced = makeLoadedImg("https://x/forced.png", "force-hsl-invert")
    const themed = makeLoadedImg("https://x/themed.png")
    document.body.append(forced, themed)
    processLoaded()
    await flushMicrotasks()
    expect(forced.dataset["invertProcessed"]).toBe("1")
    expect(themed.dataset["invertProcessed"]).toBeUndefined()
  })

  it("skips images that haven't decoded yet", async () => {
    installCanvasMocks()
    const img = document.createElement("img")
    img.classList.add("invert-in-dark-mode")
    Object.defineProperty(img, "complete", { value: false, configurable: true })
    Object.defineProperty(img, "naturalWidth", { value: 0, configurable: true })
    document.body.append(img)
    processLoaded()
    await flushMicrotasks()
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })

  it("scopes the search to the provided root", async () => {
    installCanvasMocks()
    const inside = makeLoadedImg("https://x/inside.png")
    const outside = makeLoadedImg("https://x/outside.png")
    const root = document.createElement("div")
    root.append(inside)
    document.body.append(root, outside)
    processLoaded(root)
    await flushMicrotasks()
    expect(inside.dataset["invertProcessed"]).toBe("1")
    expect(outside.dataset["invertProcessed"]).toBeUndefined()
  })
})

describe("revertProcessed", () => {
  it("reverts every processed img under root", async () => {
    installCanvasMocks()
    const a = makeLoadedImg("https://x/a.png")
    const b = makeLoadedImg("https://x/b.png")
    document.body.append(a, b)
    processLoaded()
    await flushMicrotasks()
    revertProcessed()
    expect(a.src).toBe("https://x/a.png")
    expect(b.src).toBe("https://x/b.png")
    expect(a.dataset["invertProcessed"]).toBeUndefined()
    expect(b.dataset["invertProcessed"]).toBeUndefined()
  })

  it("leaves force-hsl-invert images inverted across theme→light", async () => {
    installCanvasMocks()
    const forced = makeLoadedImg("https://x/forced.png", "force-hsl-invert")
    document.body.append(forced)
    await processImage(forced)
    expect(forced.dataset["invertProcessed"]).toBe("1")
    revertProcessed()
    expect(forced.dataset["invertProcessed"]).toBe("1")
    expect(forced.src).toBe("blob:stub/123")
  })
})

describe("onThemeChange", () => {
  it("processes loaded images when theme is dark", async () => {
    installCanvasMocks()
    const img = makeLoadedImg()
    document.body.append(img)
    setTheme("light")
    expect(img.dataset["invertProcessed"]).toBeUndefined()
    setTheme("dark")
    onThemeChange()
    await flushMicrotasks()
    expect(img.dataset["invertProcessed"]).toBe("1")
  })

  it("reverts processed images when theme is light", async () => {
    installCanvasMocks()
    const img = makeLoadedImg("https://x/img.png")
    document.body.append(img)
    await processImage(img)
    setTheme("light")
    onThemeChange()
    expect(img.src).toBe("https://x/img.png")
    expect(img.dataset["invertProcessed"]).toBeUndefined()
  })
})
