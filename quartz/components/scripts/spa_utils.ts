export const DEBOUNCE_WAIT_MS = 100

/**
 * Checks if a URL is local (same origin as the current window).
 *
 * @param href - The URL string to check.
 * @returns True if the URL has the same origin as the current window, false otherwise.
 */
export function isLocalUrl(href: string): boolean {
  try {
    // Provide the current location as the base URL for resolving protocol-relative URLs
    const url = new URL(href, window.location.href)
    if (typeof window !== "undefined" && window.location) {
      if (window.location.origin === url.origin) {
        return true
      }
    }
  } catch {
    // Malformed URLs or environments without window.location will return false
  }
  return false
}
