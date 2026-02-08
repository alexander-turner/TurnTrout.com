/**
 * Elvish toggle functionality - switches between Tengwar and English translation on click.
 */

/** CSS fallback for users without JavaScript - shows both Tengwar and translation */
export const ELVISH_NOSCRIPT_CSS = `
  .elvish { cursor: default; text-decoration: none; }
  .elvish .elvish-tengwar::after { content: " — "; }
  .elvish .elvish-translation { display: inline !important; font-family: var(--font-main); }
`

/** Toggle the show-translation class and update aria-pressed */
export function toggleElvish(this: HTMLElement): void {
  this.classList.toggle("show-translation")
  const isShowing = this.classList.contains("show-translation")
  this.setAttribute("aria-pressed", isShowing ? "true" : "false")
}

/** Handle keydown - toggle on Enter or Space */
export function handleElvishKeydown(this: HTMLElement, e: KeyboardEvent): void {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault()
    toggleElvish.call(this)
  }
}

/** Handle click - toggle unless clicking a link inside */
export function handleElvishClick(this: HTMLElement, e: MouseEvent): void {
  if ((e.target as HTMLElement).closest("a")) return
  toggleElvish.call(this)
}

/** Create the screen reader help text element */
export function createHelpText(): HTMLSpanElement {
  const helpText = document.createElement("span")
  helpText.id = "elvish-help"
  helpText.className = "visually-hidden"
  helpText.textContent = "Toggle between Elvish and English translation"
  return helpText
}

/** Initialize all elvish elements on the page */
export function initializeElvishElements(): void {
  const elvishElements = document.querySelectorAll(".elvish")

  for (const el of elvishElements) {
    const element = el as HTMLElement
    // Prevent duplicate listeners on SPA navigation
    if (element.dataset.elvishInitialized) continue
    element.dataset.elvishInitialized = "true"

    // Add keyboard accessibility
    element.setAttribute("tabindex", "0")
    element.setAttribute("role", "button")
    element.setAttribute("aria-pressed", "false")
    element.setAttribute("aria-describedby", "elvish-help")

    element.addEventListener("click", handleElvishClick as EventListener)
    element.addEventListener("keydown", handleElvishKeydown as EventListener)
  }

  // Add hidden help text for screen readers (only if elvish elements exist)
  if (elvishElements.length > 0 && !document.getElementById("elvish-help")) {
    document.body.appendChild(createHelpText())
  }
}
