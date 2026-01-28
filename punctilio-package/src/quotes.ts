/**
 * Smart quote transformation
 *
 * Converts straight quotes to typographically correct curly quotes,
 * handling contractions, possessives, and nested quotes.
 */

export interface QuoteOptions {
  /**
   * A boundary marker character used when transforming text that spans
   * multiple HTML elements. This character is treated as "transparent"
   * in the regex patterns - it won't affect quote matching but allows
   * the algorithm to work across element boundaries.
   *
   * Should be a character that doesn't appear in your text.
   * Default: "\uE000" (Unicode Private Use Area)
   */
  separator?: string
}

const DEFAULT_SEPARATOR = "\uE000"

// Unicode typography characters
const EM_DASH = "\u2014" // —
const LEFT_DOUBLE = "\u201C" // "
const RIGHT_DOUBLE = "\u201D" // "
const LEFT_SINGLE = "\u2018" // '
const RIGHT_SINGLE = "\u2019" // '
const ELLIPSIS = "\u2026" // …

/**
 * Converts standard quotes to typographic smart quotes.
 *
 * @param text - The text to transform
 * @param options - Configuration options
 * @returns The text with smart quotes
 */
export function niceQuotes(text: string, options: QuoteOptions = {}): string {
  const chr = options.separator ?? DEFAULT_SEPARATOR

  // Single quotes //
  // Ending comes first so as to not mess with the open quote
  const afterEndingSinglePatterns = `\\s\\.!?;,\\)${EM_DASH}\\-\\]"`
  const afterEndingSingle = `(?=${chr}?(?:s${chr}?)?(?:[${afterEndingSinglePatterns}]|$))`
  const endingSingle = `(?<=[^\\s${LEFT_DOUBLE}'])[']${afterEndingSingle}`
  text = text.replace(new RegExp(endingSingle, "gm"), RIGHT_SINGLE)

  // Contractions are sandwiched between two letters
  const contraction = `(?<=[A-Za-z])['${RIGHT_SINGLE}](?=${chr}?[a-zA-Z])`
  text = text.replace(new RegExp(contraction, "gm"), RIGHT_SINGLE)

  // Apostrophes always point down
  //  Whitelist for eg rock 'n' roll
  const apostropheWhitelist = `(?=n${RIGHT_SINGLE} )`
  const endQuoteNotContraction = `(?!${contraction})${RIGHT_SINGLE}${afterEndingSingle}`
  //  Convert to apostrophe if not followed by an end quote
  // Note: The character class uses LEFT_SINGLE and ASCII straight quote (U+0027)
  // NOT RIGHT_SINGLE - this is intentional for the algorithm to work correctly
  const apostropheRegex = new RegExp(
    `(?<=^|[^\\w])'(${apostropheWhitelist}|(?![^${LEFT_SINGLE}'\\n]*${endQuoteNotContraction}))`,
    "gm"
  )
  text = text.replace(apostropheRegex, RIGHT_SINGLE)

  // Beginning single quotes
  const beginningSingle = `((?:^|[\\s${LEFT_DOUBLE}${RIGHT_DOUBLE}\\-\\(])${chr}?)['](?=${chr}?\\S)`
  text = text.replace(new RegExp(beginningSingle, "gm"), `$1${LEFT_SINGLE}`)

  // Double quotes //
  const beginningDouble = new RegExp(
    `(?<=^|[\\s\\(\\/\\[\\{\\-${EM_DASH}${chr}])(?<beforeChr>${chr}?)["](?<afterChr>(${chr}[ .,])|(?=${chr}?\\.{3}|${chr}?[^\\s\\)\\${EM_DASH},!?${chr};:.\\}]))`,
    "gm"
  )
  text = text.replace(beginningDouble, `$<beforeChr>${LEFT_DOUBLE}$<afterChr>`)

  // Open quote after brace (generally in math mode)
  text = text.replace(new RegExp(`(?<=\\{)(${chr}? )?["]`, "g"), `$1${LEFT_DOUBLE}`)

  // note: Allowing 2 chrs in a row
  const endingDouble = `([^\\s\\(])["](${chr}?)(?=${chr}|[\\s/\\).,;${EM_DASH}:\\-\\}!?s]|$)`
  text = text.replace(new RegExp(endingDouble, "g"), `$1${RIGHT_DOUBLE}$2`)

  // If end of line, replace with right double quote
  text = text.replace(new RegExp(`["](${chr}?)$`, "g"), `${RIGHT_DOUBLE}$1`)
  // If single quote has a right double quote after it, replace with right single and then double
  text = text.replace(new RegExp(`'(?=${RIGHT_DOUBLE})`, "gu"), RIGHT_SINGLE)

  // Punctuation //
  // Periods inside quotes
  const periodRegex = new RegExp(
    `(?<![!?:\\.${ELLIPSIS}])(${chr}?)([${RIGHT_SINGLE}${RIGHT_DOUBLE}])(${chr}?)(?!\\.\\.\\.)\\.`,
    "g"
  )
  text = text.replace(periodRegex, "$1.$2$3")

  // Commas outside of quotes
  const commaRegex = new RegExp(`(?<![!?]),(${chr}?[${RIGHT_DOUBLE}${RIGHT_SINGLE}])`, "g")
  text = text.replace(commaRegex, "$1,")

  return text
}
