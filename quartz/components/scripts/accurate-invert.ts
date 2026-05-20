/**
 * Per-pixel HSL inversion in canvas: inverts the HSL `L` channel while
 * keeping `H` and `S` exact (no sRGB-matrix approximation, which is what
 * CSS `hue-rotate` and our SVG `feColorMatrix` fallback both do).
 *
 * Loaded via `PageShell.beforeDOMLoaded` → bundled into `prescript.js` →
 * runs synchronously in `<head>` before the body parses. That means the
 * capture-phase `load` listener installed by the inline bootstrap is
 * attached *before any `<img>` is created*, so it catches every image
 * load event in time for first paint.
 *
 * Two opt-in classes:
 *   - `.invert-in-dark-mode`: only active when `<html data-theme="dark">`.
 *     Reverts on theme switch to light.
 *   - `.force-hsl-invert`: always active, regardless of theme. Used for
 *     demo subfigures and any image we want pre-inverted at the source.
 *
 * The CSS rules on these classes apply the inline SVG filter as the
 * noscript / pre-JS fallback; once we set `data-invert-processed`, a
 * more specific CSS rule drops the SVG filter so the canvas result
 * isn't double-inverted.
 *
 * Cross-origin images without `Access-Control-Allow-Origin` taint the
 * canvas, making `getImageData` / `toDataURL` throw a SecurityError; we
 * swallow it and leave the SVG fallback in effect for those images.
 */

import { forceHslInvertClass, invertInDarkModeClass } from "../constants"

const INVERT_SELECTOR = `img.${invertInDarkModeClass}, img.${forceHslInvertClass}`
// `:not(.force-hsl-invert)` keeps force-invert imgs inverted on theme switch.
const REVERTABLE_SELECTOR = `img.${invertInDarkModeClass}:not(.${forceHslInvertClass})[data-invert-processed]`

/**
 * Closed-form HSL lightness inversion: for each channel x in {r,g,b},
 * `x' = x + 255 - max - min`. Derivation: HSL inversion preserves hue
 * and saturation, so chroma C = M - m is invariant and L' = 1 - L gives
 * M' = 255 - m and m' = 255 - M. The relative position of the middle
 * channel within [m, M] is also invariant, which collapses the per-pixel
 * transform to a single additive offset.
 */
export function invertLightness(r: number, g: number, b: number): [number, number, number] {
  const delta = 255 - Math.max(r, g, b) - Math.min(r, g, b)
  return [r + delta, g + delta, b + delta]
}

/** Mutates pixel buffer in place: HSL lightness inversion on every pixel. */
export function invertPixelsHSL(pixels: Uint8ClampedArray): void {
  for (let i = 0; i < pixels.length; i += 4) {
    const red = pixels[i]
    const green = pixels[i + 1]
    const blue = pixels[i + 2]
    const delta = 255 - Math.max(red, green, blue) - Math.min(red, green, blue)
    pixels[i] = red + delta
    pixels[i + 1] = green + delta
    pixels[i + 2] = blue + delta
  }
}

/** Reads `<html data-theme>` — set synchronously by `detectInitialState.js`. */
export function isDarkMode(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark"
}

/** True iff this image should be HSL-processed in the current theme. */
export function shouldProcess(img: HTMLImageElement): boolean {
  return img.classList.contains(forceHslInvertClass) || isDarkMode()
}

function encodeCanvas(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png")
  })
}

/**
 * Draws img to canvas, HSL-inverts pixels, stashes the original src,
 * swaps src to a blob: URL with the inverted PNG, and marks the img
 * processed. Returns false when the image isn't eligible (light mode for
 * theme-gated imgs), isn't decoded yet, or when the canvas is
 * CORS-tainted (the SVG fallback covers those cases).
 *
 * Uses `toBlob` + `URL.createObjectURL` instead of `toDataURL` — `toBlob`
 * skips the base64 encoding step (a hot spot in WebKit's canvas encoder)
 * and produces a blob: URL the browser can render without re-parsing a
 * giant base64 PNG.
 */
export async function processImage(img: HTMLImageElement): Promise<boolean> {
  if (!shouldProcess(img)) return false
  if (img.dataset["invertProcessed"]) return false
  if (!img.complete || img.naturalWidth === 0) return false

  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) return false

  try {
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    invertPixelsHSL(imageData.data)
    ctx.putImageData(imageData, 0, 0)
    const blob = await encodeCanvas(canvas)
    if (!blob) return false
    if (!img.dataset["invertOriginalSrc"]) {
      img.dataset["invertOriginalSrc"] = img.src
    }
    img.src = URL.createObjectURL(blob)
    img.dataset["invertProcessed"] = "1"
    return true
  } catch {
    return false
  }
}

/** Restore a processed image to its original src (theme switched to light). */
export function revertImage(img: HTMLImageElement): boolean {
  const original = img.dataset["invertOriginalSrc"]
  if (!original) return false
  const current = img.src
  if (current.startsWith("blob:")) {
    URL.revokeObjectURL(current)
  }
  img.src = original
  delete img.dataset["invertProcessed"]
  return true
}

/**
 * Capture-phase document listener. `load` doesn't bubble, so capture is
 * required to catch it at the document level — which is what lets a
 * single listener installed in `<head>` cover every `<img>` in the body.
 */
export function handleLoadEvent(event: Event): void {
  const target = event.target
  if (target instanceof HTMLImageElement && target.matches(INVERT_SELECTOR)) {
    void processImage(target)
  }
}

/** Sweep `root` for already-decoded eligible images and process them. */
export function processLoaded(root: Document | Element = document): void {
  const images = root.querySelectorAll<HTMLImageElement>(INVERT_SELECTOR)
  for (const img of images) {
    if (img.complete && img.naturalWidth > 0) {
      void processImage(img)
    }
  }
}

/** Revert every processed image under `root` (used when theme → light). */
export function revertProcessed(root: Document | Element = document): void {
  const images = root.querySelectorAll<HTMLImageElement>(REVERTABLE_SELECTOR)
  for (const img of images) {
    revertImage(img)
  }
}

/** Reactive bridge between the theme attribute and image state. */
export function onThemeChange(): void {
  if (isDarkMode()) {
    processLoaded()
  } else {
    revertProcessed()
  }
}
