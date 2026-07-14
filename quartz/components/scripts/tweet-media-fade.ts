// Decides, from the live layout, whether a tweet media grid should fade its
// bottom edge into the card. A grid fades only when a cell on that edge holds an
// image taller than its rendered box, so `object-fit: cover` clips the image's
// top and bottom and the bottom edge cuts through image content. A fully visible
// image—or one clipped only left/right—keeps its real bottom edge and gets no
// fade. Geometry is read at runtime because the single-image height cap is
// viewport-dependent: the same photo can be clipped on a wide screen yet fit on
// a narrow one.

// Aspect-ratio slack: ignore sub-pixel rounding so an uncropped image never
// reads as marginally clipped.
const ASPECT_EPSILON = 0.01
// A cell counts as touching the grid's bottom edge when its bottom sits within
// this many pixels of the grid's bottom.
const EDGE_EPSILON = 1

const FADE_CLASS = "tweet-media-grid-fade-bottom"

/** Intrinsic aspect ratio from the width/height attributes, falling back to a loaded image's natural size. */
function intrinsicAspect(media: Element): number | null {
  const width = Number(media.getAttribute("width"))
  const height = Number(media.getAttribute("height"))
  if (width > 0 && height > 0) return width / height
  if (media instanceof HTMLImageElement && media.naturalWidth > 0 && media.naturalHeight > 0) {
    return media.naturalWidth / media.naturalHeight
  }
  return null
}

/** Whether the grid's bottom edge cuts through clipped image content. */
export function gridClipsBottom(grid: Element): boolean {
  const gridBottom = grid.getBoundingClientRect().bottom
  for (const media of grid.querySelectorAll(".tweet-media")) {
    const rect = media.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) continue
    if (gridBottom - rect.bottom > EDGE_EPSILON) continue
    const aspect = intrinsicAspect(media)
    if (aspect === null) continue
    if (aspect < rect.width / rect.height - ASPECT_EPSILON) return true
  }
  return false
}

/** Toggle the bottom-fade class on a grid to match its current geometry. */
export function updateTweetMediaFade(grid: Element): void {
  grid.classList.toggle(FADE_CLASS, gridClipsBottom(grid))
}
