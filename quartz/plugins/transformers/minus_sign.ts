import { QuartzTransformerPlugin } from "../types"

/**
 * Replaces hyphens (-) that precede numbers with minus signs (−).
 *
 * @param {string} text
 * @returns {string} The modified string
 */
export const minusReplace = (text: string): string => {
  const numberMatch = /(^|[\s(])-(\s?\d*\.?\d+)/g
  return text.replace(numberMatch, "$1−$2")
}

export const MinusReplaceTransform: QuartzTransformerPlugin = () => {
  return {
    name: "MinusReplace",
    textTransform(_ctx, src) {
      if (src instanceof Buffer) {
        src = src.toString()
      }
      return minusReplace(src)
    },
  }
}
