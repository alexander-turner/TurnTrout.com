/**
 * Escapes HTML special characters to prevent XSS and HTML injection.
 * Handles all 5 critical characters: &, <, >, ", '
 *
 * @param unsafe - The string containing potentially unsafe HTML characters
 * @returns The escaped string safe for use in HTML content and attributes
 */
export const escapeHTML = (unsafe: string): string => {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}
