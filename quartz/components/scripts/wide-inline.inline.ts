import { markWideInlines, markWideInlinesOnResize } from "./wide-inline"

let stopMarking: (() => void) | null = null

document.addEventListener("nav", () => {
  stopMarking?.()
  stopMarking = markWideInlinesOnResize(document.body)
})

// Web fonts change the boxes' widths once they load.
document.fonts.addEventListener("loadingdone", () => markWideInlines(document.body))
