/**
 * Spoiler toggle functionality - reveals/hides spoiler content on click.
 * Uses event delegation so a single document-level listener handles every
 * `.spoiler-container`, including ones morphed in after SPA navigation.
 */

const REVEALED_CLASS = "revealed"

/**
 * Toggle the revealed state of a spoiler container and sync the
 * aria-expanded / aria-hidden attributes on its overlay and content.
 * @param container - The `.spoiler-container` element to toggle
 */
export function toggleSpoiler(container: HTMLElement): void {
  const revealed = container.classList.toggle(REVEALED_CLASS)

  const overlay = container.querySelector(".spoiler-overlay")
  if (overlay) {
    overlay.setAttribute("aria-expanded", String(revealed))
    overlay.setAttribute("aria-hidden", String(revealed))
  }

  const content = container.querySelector(".spoiler-content")
  if (content) {
    content.setAttribute("aria-hidden", String(!revealed))
  }
}

/**
 * Document-level click handler that toggles the nearest spoiler container.
 * @param e - The click event
 */
export function handleSpoilerClick(e: MouseEvent): void {
  const target = e.target as HTMLElement | null
  const container = target?.closest<HTMLElement>(".spoiler-container")
  if (container) {
    toggleSpoiler(container)
  }
}

/**
 * Document-level keydown handler that toggles a spoiler when its overlay is
 * focused and the user presses Enter or Space.
 * @param e - The keydown event
 */
export function handleSpoilerKeydown(e: KeyboardEvent): void {
  if (e.key !== "Enter" && e.key !== " ") return

  const target = e.target as HTMLElement | null
  const overlay = target?.closest<HTMLElement>(".spoiler-overlay")
  if (!overlay) return

  const container = overlay.closest<HTMLElement>(".spoiler-container")
  if (container) {
    e.preventDefault()
    toggleSpoiler(container)
  }
}
