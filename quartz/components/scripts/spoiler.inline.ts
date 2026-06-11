import { handleSpoilerClick, handleSpoilerKeydown } from "./spoiler"

let spoilerAbortController: AbortController | null = null

document.addEventListener("nav", () => {
  spoilerAbortController?.abort()
  spoilerAbortController = new AbortController()
  const { signal } = spoilerAbortController

  document.addEventListener("click", handleSpoilerClick, { signal })
  document.addEventListener("keydown", handleSpoilerKeydown, { signal })
})
