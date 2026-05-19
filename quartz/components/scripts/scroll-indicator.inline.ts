import { attachVerticalScrollIndicator, wrapScrollables } from "./scroll-indicator-utils"

let observers: ResizeObserver[] = []
let abortController: AbortController | null = null

document.addEventListener("nav", () => {
  for (const observer of observers) observer.disconnect()
  abortController?.abort()
  const controller = new AbortController()
  abortController = controller
  observers = wrapScrollables(document.body, controller.signal)
  const sidebarObserver = attachVerticalScrollIndicator(
    document.getElementById("right-sidebar"),
    controller.signal,
  )
  if (sidebarObserver) observers.push(sidebarObserver)
})
