/**
 * punctilio - Smart typography transformations
 *
 * A library for converting plain ASCII punctuation into typographically
 * correct Unicode characters. Handles smart quotes, em-dashes, en-dashes,
 * minus signs, and more.
 *
 * @packageDocumentation
 */

export { niceQuotes, type QuoteOptions } from "./quotes.js"
export {
  hyphenReplace,
  enDashNumberRange,
  enDashDateRange,
  minusReplace,
  months,
  type DashOptions,
} from "./dashes.js"

/**
 * Options for the combined transform function
 */
export interface TransformOptions {
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

import { niceQuotes } from "./quotes.js"
import { hyphenReplace } from "./dashes.js"

/**
 * Applies all typography transformations: smart quotes and proper dashes.
 *
 * This is a convenience function that applies both `niceQuotes` and
 * `hyphenReplace` in sequence.
 *
 * @param text - The text to transform
 * @param options - Configuration options
 * @returns The text with all typography improvements applied
 *
 * @example
 * ```ts
 * import { transform } from '@alexander-turner/punctilio'
 *
 * transform('"Hello," she said - "it\'s pages 1-5."')
 * // → '"Hello," she said—"it's pages 1–5."'
 * ```
 */
export function transform(text: string, options: TransformOptions = {}): string {
  text = hyphenReplace(text, options)
  text = niceQuotes(text, options)
  return text
}

/**
 * Default separator character for boundary marking.
 * Uses Unicode Private Use Area character U+E000.
 */
export const DEFAULT_SEPARATOR = "\uE000"
