import { markWideInlines, observeWideInlines } from "./wide-inline"

let observer: ResizeObserver | null = null

document.addEventListener("nav", () => {
  observer?.disconnect()
  observer = observeWideInlines(document.body)
  // Web fonts change the boxes' widths once they load.
  void document.fonts.ready.then(() => markWideInlines(document.body))
})
