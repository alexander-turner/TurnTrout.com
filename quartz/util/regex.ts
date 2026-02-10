/**
 * Shared regex pattern constants for matching text with full Latin alphabet support.
 * These patterns use Unicode property escapes to match accented characters (é, ñ, ü, etc.)
 * in addition to basic ASCII letters.
 */

/**
 * Unicode letter pattern for use in string regex patterns.
 * Matches any Unicode letter character including accented Latin characters.
 * Use with 'u' flag: new RegExp(pattern, 'u')
 */
export const UNICODE_LETTER = "\\p{L}"

/**
 * Pattern matching letters and digits (alphanumeric).
 * Equivalent to \w but with full Unicode letter support.
 */
export const UNICODE_WORD_CHAR = "[\\p{L}\\d_]"

/**
 * Pattern for matching word characters in lookbehind/lookahead assertions.
 * Includes Unicode letters for full Latin alphabet support.
 */
export const UNICODE_LETTER_LOOKAROUND = "(?<=\\p{L})|(?=\\p{L})"
