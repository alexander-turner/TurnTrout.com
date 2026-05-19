import { attachVerticalScrollIndicator, wrapScrollables } from "./scroll-indicator-utils"

let observers: ResizeObserver[] = []
let abortController: AbortController | null = null

document.addEventListener("nav", () => {
  for (const observer of observers) observer.disconnect()
  abortController?.abort()
  const controller = new AbortController()
  abortController = controller
  observers = wrapScrollables(document.body, controller.signal)
  const sidebar = document.getElementById("right-sidebar")
  if (sidebar) observers.push(attachVerticalScrollIndicator(sidebar, controller.signal))
})
