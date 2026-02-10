import { wrapScrollables, type ScrollIndicatorCleanup } from "./scroll-indicator-utils"

let cleanup: ScrollIndicatorCleanup | null = null
let abortController: AbortController | null = null

document.addEventListener("nav", () => {
  // Clean up previous observers and listeners
  cleanup?.disconnect()
  cleanup = null
  abortController?.abort()
  const controller = new AbortController()
  abortController = controller

  cleanup = wrapScrollables(document.body, controller.signal)
})
