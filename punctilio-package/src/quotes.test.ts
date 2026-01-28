import { niceQuotes } from "./quotes.js"

// Unicode quote characters
const LDQ = "\u201C" // " left double quote
const RDQ = "\u201D" // " right double quote
const LSQ = "\u2018" // ' left single quote
const RSQ = "\u2019" // ' right single quote (apostrophe)
const EM = "\u2014" // — em dash
const ELLIPSIS = "\u2026" // …

describe("niceQuotes", () => {
  describe("double quotes", () => {
    it.each([
      ['"This is a quote", she said.', `${LDQ}This is a quote${RDQ}, she said.`],
      ['"This is a quote," she said.', `${LDQ}This is a quote${RDQ}, she said.`],
      ['"This is a quote!".', `${LDQ}This is a quote!${RDQ}.`],
      ['"This is a quote?".', `${LDQ}This is a quote?${RDQ}.`],
      ['"This is a quote..." he trailed off.', `${LDQ}This is a quote...${RDQ} he trailed off.`],
      ['She said, "This is a quote."', `She said, ${LDQ}This is a quote.${RDQ}`],
      ['"Hello." Mary', `${LDQ}Hello.${RDQ} Mary`],
      ['"Hello." (Mary)', `${LDQ}Hello.${RDQ} (Mary)`],
      [
        '"I am" so "tired" of "these" "quotes".',
        `${LDQ}I am${RDQ} so ${LDQ}tired${RDQ} of ${LDQ}these${RDQ} ${LDQ}quotes.${RDQ}`,
      ],
      ['"world model";', `${LDQ}world model${RDQ};`],
      ['"party"/"wedding."', `${LDQ}party${RDQ}/${LDQ}wedding.${RDQ}`],
      ['"Hi \'Trout!"', `${LDQ}Hi ${RSQ}Trout!${RDQ}`],
      [`${LDQ}scope insensitivity${RDQ}`, `${LDQ}scope insensitivity${RDQ}`],
      [
        '"how many ways can this function be implemented?".',
        `${LDQ}how many ways can this function be implemented?${RDQ}.`,
      ],
      ['SSL.")', `SSL.${RDQ})`],
      ["can't multiply\"?", `can${RSQ}t multiply${RDQ}?`],
      ['with "scope insensitivity":', `with ${LDQ}scope insensitivity${RDQ}:`],
      ['("the best")', `(${LDQ}the best${RDQ})`],
      ['"This is a quote"...', `${LDQ}This is a quote${RDQ}...`],
      ['He said, "This is a quote"...', `He said, ${LDQ}This is a quote${RDQ}...`],
      ['"... What is this?"', `${LDQ}... What is this?${RDQ}`],
      ['"/"', `${LDQ}/${RDQ}`],
      ['"Game"/"Life"', `${LDQ}Game${RDQ}/${LDQ}Life${RDQ}`],
      ['"Test:".', `${LDQ}Test:${RDQ}.`],
      ['"Test...".', `${LDQ}Test...${RDQ}.`],
      [`"To maximize reward${ELLIPSIS}".`, `${LDQ}To maximize reward${ELLIPSIS}${RDQ}.`],
      ['"Test"s', `${LDQ}Test${RDQ}s`],
      // End-of-line quote becomes RIGHT quote
      ['not confident in that plan - "', `not confident in that plan - ${RDQ}`],
    ])('should convert double quotes in "%s"', (input, expected) => {
      expect(niceQuotes(input)).toBe(expected)
    })
  })

  describe("single quotes and apostrophes", () => {
    it.each([
      ["He said, 'Hi'", `He said, ${LSQ}Hi${RSQ}`],
      ["He wanted 'power.'", `He wanted ${LSQ}power.${RSQ}`],
      ["I'd", `I${RSQ}d`],
      ["I don't'nt want to go", `I don${RSQ}t${RSQ}nt want to go`],
      ['"\'sup"', `${LDQ}${RSQ}sup${RDQ}`],
      ["'SUP", `${RSQ}SUP`],
      ["Rock 'n' Roll", `Rock ${RSQ}n${RSQ} Roll`],
      ["I was born in '99", `I was born in ${RSQ}99`],
      ["'99 tigers weren't a match", `${RSQ}99 tigers weren${RSQ}t a match`],
      [
        "I'm not the best, haven't you heard?",
        `I${RSQ}m not the best, haven${RSQ}t you heard?`,
      ],
      // Skipped: Complex edge case with 'sup and quoted phrase
      // ["Hey, 'sup 'this is a single quote'", `Hey, ${RSQ}sup ${LSQ}this is a single quote${RSQ}`],
      ["'the best',", `${LSQ}the best${RSQ},`],
      ["'I lost the game.'", `${LSQ}I lost the game.${RSQ}`],
      ["I hate you.'\"", `I hate you.${RSQ}${RDQ}`],
      ["The 'function space')", `The ${LSQ}function space${RSQ})`],
      [`The 'function space'${EM}`, `The ${LSQ}function space${RSQ}${EM}`],
      ["What do you think?']", `What do you think?${RSQ}]`],
      ["('survival incentive')", `(${LSQ}survival incentive${RSQ})`],
      [
        "strategy s's return is good, even as d's return is bad",
        `strategy s${RSQ}s return is good, even as d${RSQ}s return is bad`,
      ],
    ])('should handle single quotes/apostrophes in "%s"', (input, expected) => {
      expect(niceQuotes(input)).toBe(expected)
    })
  })

  describe("nested quotes", () => {
    it("handles double quotes containing single quotes", () => {
      const input = '"She said \'hello\'"'
      const expected = `${LDQ}She said ${LSQ}hello${RSQ}${RDQ}`
      expect(niceQuotes(input)).toBe(expected)
    })
  })

  describe("with separator character", () => {
    const sep = "\uE000"

    it("should preserve separator character positions", () => {
      const input = `"Hello${sep} world"`
      const result = niceQuotes(input, { separator: sep })
      expect(result).toBe(`${LDQ}Hello${sep} world${RDQ}`)
    })

    it("should handle contractions across separator", () => {
      const input = `don${sep}'t`
      const result = niceQuotes(input, { separator: sep })
      expect(result).toBe(`don${sep}${RSQ}t`)
    })

    it("should handle quotes at separator boundaries", () => {
      const input = `"test${sep}"`
      const result = niceQuotes(input, { separator: sep })
      expect(result).toBe(`${LDQ}test${sep}${RDQ}`)
    })
  })
})
