/**
 * Dash and hyphen transformation
 *
 * Converts hyphens and dashes to typographically correct em-dashes,
 * en-dashes, and minus signs based on context.
 */

export interface DashOptions {
  /**
   * A boundary marker character used when transforming text that spans
   * multiple HTML elements. This character is treated as "transparent"
   * in the regex patterns.
   *
   * Should be a character that doesn't appear in your text.
   * Default: "\uE000" (Unicode Private Use Area)
   */
  separator?: string
}

const DEFAULT_SEPARATOR = "\uE000"

/**
 * List of month names (full and abbreviated) for date range detection
 */
export const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
].join("|")

/**
 * Replaces hyphens with en-dashes in number ranges.
 *
 * Handles:
 * - Simple ranges: "1-5" → "1–5"
 * - Page numbers: "p.206-207" → "p.206–207"
 * - Dollar amounts: "$100-$200" → "$100–$200"
 * - Comma-formatted numbers: "1,000-2,000" → "1,000–2,000"
 *
 * Does NOT replace:
 * - Spaced ranges: "1 - 5" (ambiguous, could be subtraction)
 * - Version numbers with decimals: "1.5-1.8"
 *
 * @param text - The text to transform
 * @param options - Configuration options
 * @returns The text with en-dashes in number ranges
 *
 * @example
 * ```ts
 * enDashNumberRange("pages 10-15")
 * // → "pages 10–15"
 * ```
 */
export function enDashNumberRange(text: string, options: DashOptions = {}): string {
  const chr = options.separator ?? DEFAULT_SEPARATOR
  return text.replace(
    new RegExp(
      `\\b(?<![a-zA-Z.])((?:p\\.?|\\$)?\\d[\\d.,]*${chr}?)-(${chr}?\\$?\\d[\\d.,]*)(?!\\.\\d)\\b`,
      "g"
    ),
    "$1–$2"
  )
}

/**
 * Replaces hyphens with en-dashes in month/date ranges.
 *
 * Handles full and abbreviated month names:
 * - "January-March" → "January–March"
 * - "Jan-Mar" → "Jan–Mar"
 *
 * @param text - The text to transform
 * @param options - Configuration options
 * @returns The text with en-dashes in date ranges
 *
 * @example
 * ```ts
 * enDashDateRange("January-March 2024")
 * // → "January–March 2024"
 * ```
 */
export function enDashDateRange(text: string, options: DashOptions = {}): string {
  const chr = options.separator ?? DEFAULT_SEPARATOR
  return text.replace(
    new RegExp(`\\b(${months}${chr}?)-(${chr}?(?:${months}))\\b`, "g"),
    "$1–$2"
  )
}

/**
 * Replaces hyphens with proper minus signs (−) in numerical contexts.
 *
 * Handles negative numbers at:
 * - Start of string/line
 * - After whitespace
 * - After opening parenthesis
 * - After opening quote
 *
 * @param text - The text to transform
 * @param options - Configuration options
 * @returns The text with minus signs
 *
 * @example
 * ```ts
 * minusReplace("The temperature was -5 degrees")
 * // → "The temperature was −5 degrees"
 * ```
 */
export function minusReplace(text: string, options: DashOptions = {}): string {
  const chr = options.separator ?? DEFAULT_SEPARATOR
  const minusRegex = new RegExp(`(^|[\\s\\(${chr}""])-(\\s?\\d*\\.?\\d+)`, "gm")
  return text.replaceAll(minusRegex, "$1−$2")
}

/**
 * Comprehensive dash replacement for typographic correctness.
 *
 * Applies multiple transformations:
 * 1. Converts hyphens to minus signs in numerical contexts
 * 2. Converts surrounded dashes (- or --) to em-dashes (—)
 * 3. Removes spaces around em-dashes (per modern style)
 * 4. Preserves space after em-dash at start of line
 * 5. Adds space after em-dash following quotation marks
 * 6. Converts number ranges to en-dashes (1-5 → 1–5)
 * 7. Converts date ranges to en-dashes (Jan-Mar → Jan–Mar)
 *
 * Does NOT modify:
 * - Horizontal rules (---)
 * - Compound modifiers (well-known, browser-specific)
 * - Hyphens in quoted blockquotes ("> - item")
 *
 * @param text - The text to transform
 * @param options - Configuration options
 * @returns The text with proper dashes
 *
 * @example
 * ```ts
 * hyphenReplace("This is a - test")
 * // → "This is a—test"
 *
 * hyphenReplace("Since--as you know")
 * // → "Since—as you know"
 *
 * hyphenReplace("Pages 1-5")
 * // → "Pages 1–5"
 * ```
 */
export function hyphenReplace(text: string, options: DashOptions = {}): string {
  const chr = options.separator ?? DEFAULT_SEPARATOR

  text = minusReplace(text, options)

  // Handle dashes with potential spaces and optional marker character
  //  Being right after chr is a sufficient condition for being an em
  //  dash, as it indicates the start of a new line
  const preDash = new RegExp(`((?<markerBeforeTwo>${chr}?)[ ]+|(?<markerBeforeThree>${chr}))`)
  // Want eg " - " to be replaced with "—"
  const surroundedDash = new RegExp(
    `(?<=[^\\s>]|^)${preDash.source}[~–—-]+[ ]*(?<markerAfter>${chr}?)([ ]+|$)`,
    "g"
  )

  // Replace surrounded dashes with em dash
  text = text.replace(surroundedDash, "$<markerBeforeTwo>$<markerBeforeThree>—$<markerAfter>")

  // "Since--as you know" should be "Since—as you know"
  const multipleDashInWords = new RegExp(
    `(?<=[A-Za-z\\d])(?<markerBefore>${chr}?)[~–—-]{2,}(?<markerAfter>${chr}?)(?=[A-Za-z\\d ])`,
    "g"
  )
  text = text.replace(multipleDashInWords, "$<markerBefore>—$<markerAfter>")

  // Handle dashes at the start of a line
  text = text.replace(new RegExp(`^(${chr})?[-]+ `, "gm"), "$1— ")

  // Create a regex for spaces around em dashes, allowing for optional spaces around the em dash
  const spacesAroundEM = new RegExp(
    `(?<markerBefore>${chr}?)[ ]*—[ ]*(?<markerAfter>${chr}?)[ ]*`,
    "g"
  )
  // Remove spaces around em dashes
  text = text.replace(spacesAroundEM, "$<markerBefore>—$<markerAfter>")

  // Handle special case after quotation marks
  const postQuote = new RegExp(`(?<quote>[.!?]${chr}?['"'"]${chr}?|…)${spacesAroundEM.source}`, "g")
  text = text.replace(postQuote, "$<quote> $<markerBefore>—$<markerAfter> ")

  // Handle em dashes at the start of a line
  const startOfLine = new RegExp(`^${spacesAroundEM.source}(?<after>[A-Z0-9])`, "gm")
  text = text.replace(startOfLine, "$<markerBefore>—$<markerAfter> $<after>")

  text = enDashNumberRange(text, options)
  text = enDashDateRange(text, options)

  return text
}
