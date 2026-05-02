/**
 * Checks if a URL is local (same origin as the current window).
 *
 * @param href - The URL string to check.
 * @returns True if the URL has the same origin as the current window, false otherwise.
 */
export function isLocalUrl(href: string): boolean {
  try {
    // Base URL resolves protocol-relative and relative inputs against the current page
    const url = new URL(href, window.location.href)
    return window.location.origin === url.origin
  } catch {
    return false
  }
}
