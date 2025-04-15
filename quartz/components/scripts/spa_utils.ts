/**
 * Generates a unique storage key for a given Location object, ignoring the hash.
 *
 * @param location - The Location object.
 * @returns A string suitable for use as a sessionStorage key.
 */
export function locationToStorageKey(location: Location): string {
  const url = new URL(location.toString())
  url.hash = ""
  return `scrollPos:${url.toString()}`
}

/**
 * Checks if a URL is local (same origin as the current window).
 *
 * @param href - The URL string to check.
 * @returns True if the URL has the same origin as the current window, false otherwise.
 */
export function isLocalUrl(href: string): boolean {
  try {
    const url = new URL(href)
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
