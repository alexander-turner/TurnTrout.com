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
 * Only runs in dark mode (`data-theme="dark"` on `<html>`). A
 * MutationObserver on that attribute reverts processed images back to
 * their originals when the user switches to light, and re-processes on
 * switch back to dark. The CSS rule on `.invert-in-dark-mode` applies
 * the inline SVG filter as the noscript / pre-JS fallback; once we set
 * `data-invert-processed`, a more specific CSS rule drops the SVG
 * filter so the canvas result isn't double-inverted.
 *
 * Cross-origin images without `Access-Control-Allow-Origin` taint the
 * canvas, making `getImageData` / `toDataURL` throw a SecurityError; we
 * swallow it and leave the SVG fallback in effect for those images.
 */

import { rgb, hsl } from "d3-color"

const INVERT_SELECTOR = "img.invert-in-dark-mode"
const PROCESSED_SELECTOR = "img.invert-in-dark-mode[data-invert-processed]"

/** True HSL lightness inversion via d3-color (hue and saturation exact). */
export function invertLightness(r: number, g: number, b: number): [number, number, number] {
  const c = hsl(rgb(r, g, b))
  c.l = 1 - c.l
  const out = c.rgb()
  return [out.r, out.g, out.b]
}

/** Mutates pixel buffer in place: HSL lightness inversion on every pixel. */
export function invertPixelsHSL(pixels: Uint8ClampedArray): void {
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b] = invertLightness(pixels[i], pixels[i + 1], pixels[i + 2])
    pixels[i] = r
    pixels[i + 1] = g
    pixels[i + 2] = b
  }
}

/** Reads `<html data-theme>` — set synchronously by `detectInitialState.js`. */
export function isDarkMode(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark"
}

/**
 * Draws img to canvas, HSL-inverts pixels, stashes the original src,
 * swaps src to the resulting data URL, and marks the img processed.
 * Returns false in light mode, when the img isn't decoded yet, or when
 * the canvas is CORS-tainted (the SVG fallback covers those cases).
 */
export function processImage(img: HTMLImageElement): boolean {
  if (!isDarkMode()) return false
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
    if (!img.dataset["invertOriginalSrc"]) {
      img.dataset["invertOriginalSrc"] = img.src
    }
    img.src = canvas.toDataURL()
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
    processImage(target)
  }
}

/** Sweep `root` for already-decoded eligible images and process them. */
export function processLoaded(root: Document | Element = document): void {
  const images = root.querySelectorAll<HTMLImageElement>(INVERT_SELECTOR)
  for (const img of images) {
    if (img.complete && img.naturalWidth > 0) {
      processImage(img)
    }
  }
}

/** Revert every processed image under `root` (used when theme → light). */
export function revertProcessed(root: Document | Element = document): void {
  const images = root.querySelectorAll<HTMLImageElement>(PROCESSED_SELECTOR)
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
