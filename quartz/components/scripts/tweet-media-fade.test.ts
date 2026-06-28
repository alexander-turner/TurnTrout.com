/**
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, it, jest } from "@jest/globals"

import { gridClipsBottom, updateTweetMediaFade } from "./tweet-media-fade"

const FADE_CLASS = "tweet-media-grid-fade-bottom"

const rect = (props: Partial<DOMRect>): DOMRect =>
  ({ width: 0, height: 0, bottom: 0, ...props }) as DOMRect

/** Build a grid whose box and cells return the supplied rects, plus optional intrinsic dimensions. */
function buildGrid(
  gridBottom: number,
  cells: { rect: DOMRect; width?: number; height?: number }[],
): HTMLElement {
  const grid = document.createElement("div")
  grid.className = "tweet-media-grid"
  jest.spyOn(grid, "getBoundingClientRect").mockReturnValue(rect({ bottom: gridBottom }))
  for (const cell of cells) {
    const img = document.createElement("img")
    img.className = "tweet-media"
    if (cell.width !== undefined) img.setAttribute("width", String(cell.width))
    if (cell.height !== undefined) img.setAttribute("height", String(cell.height))
    jest.spyOn(img, "getBoundingClientRect").mockReturnValue(cell.rect)
    grid.appendChild(img)
  }
  return grid
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe("gridClipsBottom", () => {
  it("is true when a bottom-edge image is taller than its rendered box", () => {
    // Box aspect 488/640 = 0.76; image aspect 0.5 < that, so cover clips top/bottom.
    const grid = buildGrid(640, [
      { rect: rect({ width: 488, height: 640, bottom: 640 }), width: 500, height: 1000 },
    ])
    expect(gridClipsBottom(grid)).toBe(true)
  })

  it("is false when the image fills its box at its natural aspect ratio", () => {
    // The Pokémon case: 2738×1818 (1.51) shown ~324px tall at 488px wide, uncropped.
    const grid = buildGrid(324, [
      { rect: rect({ width: 488, height: 324, bottom: 324 }), width: 2738, height: 1818 },
    ])
    expect(gridClipsBottom(grid)).toBe(false)
  })

  it("is false when the image is clipped only left and right", () => {
    // Box aspect 488/200 = 2.44; image aspect 3.0 is wider, so it crops sides, not top/bottom.
    const grid = buildGrid(200, [
      { rect: rect({ width: 488, height: 200, bottom: 200 }), width: 1500, height: 500 },
    ])
    expect(gridClipsBottom(grid)).toBe(false)
  })

  it("ignores cells that do not touch the grid's bottom edge", () => {
    // A clipped cell in the top row (bottom 320, grid bottom 640) is skipped.
    const grid = buildGrid(640, [
      { rect: rect({ width: 488, height: 320, bottom: 320 }), width: 500, height: 1000 },
    ])
    expect(gridClipsBottom(grid)).toBe(false)
  })

  it("considers any bottom-edge cell, returning true on the first clipped one", () => {
    const grid = buildGrid(640, [
      // First bottom-edge cell is a wide image (side-cropped, not clipped)...
      { rect: rect({ width: 488, height: 640, bottom: 640 }), width: 1600, height: 900 },
      // ...the second is a tall image clipped top/bottom, so the grid fades.
      { rect: rect({ width: 488, height: 640, bottom: 640 }), width: 500, height: 1000 },
    ])
    expect(gridClipsBottom(grid)).toBe(true)
  })

  it("skips cells with no intrinsic dimensions and no natural size", () => {
    const grid = buildGrid(640, [{ rect: rect({ width: 488, height: 640, bottom: 640 }) }])
    expect(gridClipsBottom(grid)).toBe(false)
  })

  it("skips zero-area cells", () => {
    const grid = buildGrid(0, [
      { rect: rect({ width: 0, height: 0, bottom: 0 }), width: 500, height: 1000 },
    ])
    expect(gridClipsBottom(grid)).toBe(false)
  })

  it("falls back to a loaded image's natural size when attributes are absent", () => {
    const grid = buildGrid(640, [{ rect: rect({ width: 488, height: 640, bottom: 640 }) }])
    const img = grid.querySelector("img") as HTMLImageElement
    Object.defineProperty(img, "naturalWidth", { value: 500 })
    Object.defineProperty(img, "naturalHeight", { value: 1000 })
    expect(gridClipsBottom(grid)).toBe(true)
  })
})

describe("updateTweetMediaFade", () => {
  it("adds the fade class when clipped and removes it when not", () => {
    const clipped = buildGrid(640, [
      { rect: rect({ width: 488, height: 640, bottom: 640 }), width: 500, height: 1000 },
    ])
    updateTweetMediaFade(clipped)
    expect(clipped.classList.contains(FADE_CLASS)).toBe(true)

    const fits = buildGrid(324, [
      { rect: rect({ width: 488, height: 324, bottom: 324 }), width: 2738, height: 1818 },
    ])
    fits.classList.add(FADE_CLASS)
    updateTweetMediaFade(fits)
    expect(fits.classList.contains(FADE_CLASS)).toBe(false)
  })
})
