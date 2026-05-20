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

import { rgb, hsl, color as parseColor } from "d3-color"

import { forceHslInvertClass, invertInDarkModeClass } from "../constants"

const INVERT_SELECTOR = `img.${invertInDarkModeClass}, img.${forceHslInvertClass}`
// `:not(.force-hsl-invert)` keeps force-invert imgs inverted on theme switch.
const REVERTABLE_SELECTOR = `img.${invertInDarkModeClass}:not(.${forceHslInvertClass})[data-invert-processed]`

// SVG paint/colored properties we rewrite — both as XML attributes and as
// CSS declarations inside `style="…"` and `<style>` blocks. `currentColor`,
// `none`, paint refs like `url(#grad)`, and `transparent` fall through
// untouched because `d3-color`'s `color()` returns `null` or a non-
// displayable result for them.
const SVG_COLOR_ATTRS = [
  "fill",
  "stroke",
  "stop-color",
  "color",
  "flood-color",
  "lighting-color",
] as const
const SVG_COLOR_PROP_RE = new RegExp(
  `(?<prop>${SVG_COLOR_ATTRS.join("|")})(?<sep>\\s*:\\s*)(?<value>[^;}"']+)`,
  "gi",
)

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

/**
 * Inverts a single CSS color token's HSL lightness. Returns `null` when the
 * token isn't a displayable color (`none`, `currentColor`, `url(...)`,
 * `transparent`, garbage), letting callers leave the source untouched.
 */
export function invertColorToken(token: string): string | null {
  const c = parseColor(token)
  if (!c || !c.displayable()) return null
  const h = hsl(c)
  h.l = 1 - h.l
  return h.formatHex()
}

/** Rewrites color values inside a CSS declaration string (inline or block). */
export function invertCssColors(css: string): string {
  return css.replace(SVG_COLOR_PROP_RE, (match, ..._args) => {
    const groups = _args.at(-1) as { prop: string; sep: string; value: string }
    const inverted = invertColorToken(groups.value.trim())
    return inverted ? `${groups.prop}${groups.sep}${inverted}` : match
  })
}

/** True iff `src` points at an SVG (case-insensitive, ignores query/hash). */
export function isSvgSrc(src: string): boolean {
  const path = src.split(/[?#]/, 1)[0]
  return path.toLowerCase().endsWith(".svg")
}

/**
 * Parses SVG text, HSL-inverts every color-bearing attribute and CSS
 * declaration, and re-serializes. Returns the original text unchanged if
 * the document fails to parse.
 */
export function invertSvgSource(text: string): string {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml")
  if (doc.getElementsByTagName("parsererror").length > 0) return text
  for (const el of Array.from(doc.documentElement.querySelectorAll<Element>("*"))) {
    for (const attr of SVG_COLOR_ATTRS) {
      const v = el.getAttribute(attr)
      if (!v) continue
      const inverted = invertColorToken(v.trim())
      if (inverted) el.setAttribute(attr, inverted)
    }
    const style = el.getAttribute("style")
    if (style) el.setAttribute("style", invertCssColors(style))
    if (el.tagName.toLowerCase() === "style" && el.textContent) {
      el.textContent = invertCssColors(el.textContent)
    }
  }
  return new XMLSerializer().serializeToString(doc.documentElement)
}

/** Reads `<html data-theme>` — set synchronously by `detectInitialState.js`. */
export function isDarkMode(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark"
}

/** True iff this image should be HSL-processed in the current theme. */
export function shouldProcess(img: HTMLImageElement): boolean {
  return img.classList.contains(forceHslInvertClass) || isDarkMode()
}

/**
 * Raster path: draws img to canvas, HSL-inverts pixels, stashes the
 * original src, swaps src to a PNG data URL, marks the img processed.
 * Returns false when the canvas is CORS-tainted; the SVG `feColorMatrix`
 * filter fallback covers those cases.
 */
export function processRasterImage(img: HTMLImageElement): boolean {
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

/**
 * SVG path: fetches the source, HSL-inverts every color attribute /
 * CSS declaration, and swaps src to an inverted `data:image/svg+xml`
 * URL — preserving vector fidelity (the canvas path would rasterize).
 * `invertProcessing` guards against concurrent re-entry (a fresh `load`
 * event plus a theme-change sweep could otherwise both fire fetches);
 * `invertProcessed` is only set on success, so the CSS filter fallback
 * remains in effect until the swap lands.
 */
export async function processSvgImage(img: HTMLImageElement): Promise<boolean> {
  if (img.dataset["invertProcessing"]) return false
  img.dataset["invertProcessing"] = "1"
  try {
    const response = await fetch(img.src)
    if (!response.ok) return false
    const text = await response.text()
    const inverted = invertSvgSource(text)
    if (!img.dataset["invertOriginalSrc"]) {
      img.dataset["invertOriginalSrc"] = img.src
    }
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(inverted)}`
    img.dataset["invertProcessed"] = "1"
    return true
  } catch {
    return false
  } finally {
    delete img.dataset["invertProcessing"]
  }
}

/**
 * Dispatches to the raster or SVG path. Returns `false` for ineligible
 * images (wrong theme, already processed, not yet decoded); otherwise
 * a `Promise<boolean>` resolving to whether the inversion actually swapped
 * the src.
 */
export function processImage(img: HTMLImageElement): Promise<boolean> {
  if (!shouldProcess(img)) return Promise.resolve(false)
  if (img.dataset["invertProcessed"]) return Promise.resolve(false)
  if (!img.complete || img.naturalWidth === 0) return Promise.resolve(false)
  if (isSvgSrc(img.src)) return processSvgImage(img)
  return Promise.resolve(processRasterImage(img))
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
