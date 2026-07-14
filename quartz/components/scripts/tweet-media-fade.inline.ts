import { updateTweetMediaFade } from "./tweet-media-fade"

let observer: ResizeObserver | null = null
const pendingImages: { img: HTMLImageElement; onLoad: () => void }[] = []

function teardown(): void {
  observer?.disconnect()
  observer = null
  for (const { img, onLoad } of pendingImages) img.removeEventListener("load", onLoad)
  pendingImages.length = 0
}

function setup(): void {
  teardown()
  // The cap on a single image is viewport-relative, so re-measure on resize.
  observer = new ResizeObserver((entries) => {
    for (const entry of entries) updateTweetMediaFade(entry.target)
  })
  for (const grid of document.querySelectorAll(".tweet-media-grid")) {
    updateTweetMediaFade(grid)
    observer.observe(grid)
    // Images without width/height attributes have no box until they load.
    for (const img of grid.querySelectorAll<HTMLImageElement>("img.tweet-media")) {
      if (img.complete) continue
      const onLoad = () => updateTweetMediaFade(grid)
      img.addEventListener("load", onLoad)
      pendingImages.push({ img, onLoad })
    }
  }
}

document.addEventListener("nav", setup)
