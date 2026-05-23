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

import { hsl, color as parseColor } from "d3-color"

import { forceHslInvertClass, invertInDarkModeClass } from "../constants"

const INVERT_SELECTOR = `img.${invertInDarkModeClass}, img.${forceHslInvertClass}`
// `:not(.force-hsl-invert)` keeps force-invert imgs inverted on theme switch.
const REVERTABLE_SELECTOR = `img.${invertInDarkModeClass}:not(.${forceHslInvertClass})[data-invert-processed]`

// URLs of original bitmaps that have already been pinned, so we don't
// duplicate pins when multiple invert imgs share a source. Stale entries
// are pruned by `pruneStalePins` on SPA navigation.
const pinnedOriginalUrls = new Set<string>()
const PIN_CONTAINER_ID = "invert-pin-container"

function getPinContainer(): HTMLElement {
  const existing = document.getElementById(PIN_CONTAINER_ID)
  if (existing) return existing
  const container = document.createElement("div")
  container.id = PIN_CONTAINER_ID
  container.setAttribute("aria-hidden", "true")
  container.style.cssText =
    "position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;"
  document.body.appendChild(container)
  return container
}

/**
 * Pins the original bitmap in the renderer's image cache by appending an
 * off-screen `<img>` inside a hidden container. A heap-only `new Image()`
 * is not enough — Chromium typically skips decoding for not-in-DOM images
 * and purges decoded bitmaps under memory pressure. An in-DOM (but
 * visually hidden) `<img>` is treated as a live render-tree node, so the
 * original stays decoded for the lifetime of the page. When the
 * dark→light revert sets `<img>.src` back to the original URL, the swap
 * resolves from the shared decode cache within the same paint frame
 * instead of flashing the stale canvas-inverted bitmap during reload.
 */
function pinOriginalBitmap(originalSrc: string): void {
  if (pinnedOriginalUrls.has(originalSrc)) return
  pinnedOriginalUrls.add(originalSrc)
  const pin = document.createElement("img")
  // Match the request mode of the originating <img>: invert imgs on the
  // site carry crossorigin="anonymous" so canvas drawImage / getImageData
  // doesn't taint. Chromium's decode cache is keyed by URL + CORS mode,
  // so the pin's bitmap is only shared with the visible img if both
  // requests are CORS-anonymous.
  pin.crossOrigin = "anonymous"
  pin.alt = ""
  pin.dataset["invertCachePin"] = "1"
  pin.src = originalSrc
  getPinContainer().appendChild(pin)
}

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
  `(?<prop>${SVG_COLOR_ATTRS.join("|")})(?<sep>\\s*:\\s*)(?<value>\\S[^;}"']*)`,
  "gi",
)

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
    if (!img.classList.contains(forceHslInvertClass)) {
      pinOriginalBitmap(img.dataset["invertOriginalSrc"])
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
    if (!img.classList.contains(forceHslInvertClass)) {
      pinOriginalBitmap(img.dataset["invertOriginalSrc"])
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

/**
 * Drop pin imgs whose URL is no longer used by any invert img in `root`.
 * Called on SPA navigation: without this, pins accumulate monotonically
 * across pages (Quartz pjax replaces the content area but not `<body>`,
 * so the pin container survives every nav). Pruning bounds pin memory to
 * the current page's revertable imgs.
 */
export function pruneStalePins(root: Document | Element = document): void {
  const container = document.getElementById(PIN_CONTAINER_ID)
  if (!container) return
  const live = new Set<string>()
  for (const img of root.querySelectorAll<HTMLImageElement>(INVERT_SELECTOR)) {
    if (img.classList.contains(forceHslInvertClass)) continue
    const url = img.dataset["invertOriginalSrc"] ?? img.src
    if (url) live.add(url)
  }
  for (const pin of Array.from(container.children) as HTMLImageElement[]) {
    if (!live.has(pin.src)) {
      pinnedOriginalUrls.delete(pin.src)
      pin.remove()
    }
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
