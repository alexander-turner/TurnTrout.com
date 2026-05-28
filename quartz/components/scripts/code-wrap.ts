/**
 * Soft-wrap toggle for `<pre>` code blocks.
 *
 * Adds a button alongside the existing copy button that toggles a
 * `.soft-wrap` class on every `<pre>` on the page. CSS in `clipboard.scss`
 * responds to that class by switching the block from `overflow-x: auto`
 * to wrapped lines. The preference persists across sessions via
 * `localStorage`, so a reader who turns wrapping on stays in wrap mode
 * on subsequent visits and across SPA navigation.
 */

export const WRAP_CLASS = "soft-wrap"
export const STORAGE_KEY = "code-soft-wrap"
const INITIALIZED_FLAG = "wrapInitialized"

// VS Code / GitHub-style word-wrap glyph.
export const svgWrap =
  '<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true"><path fill-rule="evenodd" d="M1 3.75A.75.75 0 0 1 1.75 3h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 3.75Zm0 4A.75.75 0 0 1 1.75 7H12a2.5 2.5 0 0 1 0 5H8.56l.97.97a.75.75 0 1 1-1.06 1.06l-2.25-2.25a.75.75 0 0 1 0-1.06l2.25-2.25a.75.75 0 1 1 1.06 1.06l-.97.97H12a1 1 0 0 0 0-2H1.75A.75.75 0 0 1 1 7.75ZM1.75 12h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1 0-1.5Z"></path></svg>'

/** Read the persisted soft-wrap preference. Defaults to `false`. */
export function getWrapPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    // Storage may be unavailable in private mode or sandboxed iframes;
    // fall back to the default (no wrap) rather than break the page.
    return false
  }
}

/** Persist the soft-wrap preference. Silently no-ops if storage is unavailable. */
export function setWrapPreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false")
  } catch {
    // See `getWrapPreference` — silently ignore storage failures.
  }
}

/** Sync a single button's a11y state to the current preference. */
function syncButtonState(button: HTMLButtonElement, enabled: boolean): void {
  button.setAttribute("aria-pressed", enabled ? "true" : "false")
  button.setAttribute("aria-label", enabled ? "Disable soft-wrap" : "Enable soft-wrap")
}

/** Apply `enabled` to every `<pre>` and every wrap button currently in the DOM. */
export function applyWrapState(enabled: boolean): void {
  document.querySelectorAll("pre").forEach((pre) => {
    pre.classList.toggle(WRAP_CLASS, enabled)
  })
  document.querySelectorAll(".code-wrap-button").forEach((button) => {
    syncButtonState(button as HTMLButtonElement, enabled)
  })
}

/** Flip the persisted preference and update the DOM to match. */
export function toggleWrap(): void {
  const next = !getWrapPreference()
  setWrapPreference(next)
  applyWrapState(next)
}

/** Build a wrap-toggle button that drives the global preference. */
export function createWrapButton(): HTMLButtonElement {
  const button = document.createElement("button")
  button.className = "code-wrap-button"
  button.type = "button"
  syncButtonState(button, getWrapPreference())
  button.innerHTML = svgWrap
  button.addEventListener("click", toggleWrap)
  return button
}

/** Attach a wrap button to every code block that doesn't already have one. */
export function initializeWrapButtons(): void {
  const enabled = getWrapPreference()
  const pres = document.querySelectorAll("pre")
  for (const pre of pres) {
    const el = pre as HTMLElement
    if (el.dataset[INITIALIZED_FLAG]) continue
    const codeBlock = el.querySelector("code")
    if (!codeBlock) continue
    el.dataset[INITIALIZED_FLAG] = "true"
    el.classList.toggle(WRAP_CLASS, enabled)
    el.prepend(createWrapButton())
  }
}
