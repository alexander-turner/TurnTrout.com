export function throttle(func: () => void, delay: number) {
  let timeout: number | null = null
  return () => {
    if (!timeout) {
      func()
      timeout = window.setTimeout(() => {
        timeout = null
      }, delay)
    }
  }
}

export function registerEscapeHandler(outsideContainer: HTMLElement | null, cb: () => void) {
  if (!outsideContainer) return

  function click(e: MouseEvent) {
    if (e.target !== outsideContainer) return
    e.preventDefault()
    cb()
  }

  function esc(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault()
      cb()
    }
  }

  outsideContainer.addEventListener("click", click)
  window.addEventListener("keydown", esc)
}

export function removeAllChildren(node: HTMLElement) {
  while (node.firstChild) {
    node.removeChild(node.firstChild)
  }
}

let timeoutAction: number
let timeoutEnable: number

export const withoutTransition = (action: () => void) => {
  clearTimeout(timeoutAction)
  clearTimeout(timeoutEnable)

  const style = document.createElement("style")
  style.textContent = `body * {
     -webkit-transition: none !important;
     -moz-transition: none !important;
     -o-transition: none !important;
     -ms-transition: none !important;   
      transition: none !important;
    }
  `

  const disableTransitions = () => document.head.appendChild(style)
  const enableTransitions = () => document.head.removeChild(style)

  if (typeof window.getComputedStyle !== "undefined") {
    disableTransitions()
    action()
    void window.getComputedStyle(style).opacity // Force reflow
    enableTransitions()
    return
  }

  if (typeof window.requestAnimationFrame !== "undefined") {
    disableTransitions()
    action()
    window.requestAnimationFrame(enableTransitions)
    return
  }

  disableTransitions()
  timeoutAction = window.setTimeout(() => {
    action()
    timeoutEnable = window.setTimeout(enableTransitions, 120)
  }, 120)
}

export function wrapWithoutTransition<T extends (...args: never[]) => ReturnType<T>>(
  func: T,
): (...args: Parameters<T>) => ReturnType<T> {
  return (...args) => {
    let result!: ReturnType<T>
    document.documentElement.classList.add("temporary-transition")

    withoutTransition(() => {
      result = func(...args)
    })
    setTimeout(() => {
      document.documentElement.classList.remove("temporary-transition")
    }, 1000)
    return result
  }
}
