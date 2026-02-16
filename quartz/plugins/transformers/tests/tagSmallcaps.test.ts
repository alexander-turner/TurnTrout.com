import { describe, expect, it } from "@jest/globals"
import { type Parent, type Text } from "hast"
import { h } from "hastscript"
import { rehype } from "rehype"
import seedrandom from "seedrandom"

import {
  allowAcronyms,
  rehypeTagSmallcaps,
  isRomanNumeral,
  REGEX_ACRONYM,
  smallCapsSeparators,
  REGEX_ABBREVIATION,
  validSmallCapsPhrase,
  allCapsContinuation,
  REGEX_ALL_CAPS_PHRASE,
  skipSmallcaps,
  skipSmallcapsClasses,
  shouldSkipNode,
  capitalizeAfterEnding,
  shouldCapitalizeMatch,
  INLINE_ELEMENTS,
  processMatchedText,
  isInAllowList,
  shouldIgnoreNumericAbbreviation,
  replaceSCInNode,
  PUNCTUATION_BEFORE_MATCH,
} from "../tagSmallcaps"

function testTagSmallcapsHTML(inputHTML: string) {
  return rehype()
    .data("settings", { fragment: true })
    .use(rehypeTagSmallcaps)
    .processSync(inputHTML)
    .toString()
}

describe("rehypeTagSmallcaps", () => {
  // Test basic acronym wrapping with representative cases
  const acronymCases = [
    [
      "<p>NASA launched a new satellite for NOAA to study GCRs.</p>",
      '<p><abbr class="small-caps">Nasa</abbr> launched a new satellite for <abbr class="small-caps">noaa</abbr> to study <abbr class="small-caps">gcr</abbr>s.</p>',
    ],
    ["<p>GPT-2-XL</p>", '<p><abbr class="small-caps">Gpt-2-xl</abbr></p>'],
    ["<p>MIRI-relevant math</p>", '<p><abbr class="small-caps">Miri</abbr>-relevant math</p>'],
    ["<p>E2EE encryption</p>", '<p><abbr class="small-caps">E2ee</abbr> encryption</p>'],
    ["<p>E2E testing</p>", "<p>E2E testing</p>"],
    ["<p>TP-Link routers</p>", "<p>TP-Link routers</p>"],
    // Test all-caps phrases
    [
      "<p>I HATE YOU but YOU ARE SWEET-I LIKE YOU</p>",
      '<p><abbr class="small-caps">I hate you</abbr> but <abbr class="small-caps">you are sweet-i like you</abbr></p>',
    ],
    [
      "<p>I HATE YOU<br>I LIKE YOU</p>",
      '<p><abbr class="small-caps">I hate you</abbr><br><abbr class="small-caps">I like you</abbr></p>',
    ],
    [
      "<p>The NATO. ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>",
      '<p>The <abbr class="small-caps">nato</abbr>. <abbr class="small-caps">Abcdefghijklmnopqrstuvwxyz</abbr></p>',
    ],
    ["<p>IID</p>", '<p><abbr class="small-caps">Iid</abbr></p>'],
    [
      "<p>The observations are IID</p>",
      '<p>The observations are <abbr class="small-caps">iid</abbr></p>',
    ],
  ]
  it.each(acronymCases)("should properly format: %s", (input, expected) => {
    expect(testTagSmallcapsHTML(input)).toBe(expected)
  })
})

describe("Abbreviations and Units", () => {
  // Test numeric abbreviations (e.g., 100km)
  const validCases = ["10ZB", ".1EXP", "10BTC", "100.0KM", "5K"].map((text) => [
    text,
    `<p><abbr class="small-caps">${text.toLowerCase()}</abbr></p>`,
  ])
  it.each(validCases)("should wrap %s correctly", (input, expected) => {
    expect(testTagSmallcapsHTML(`<p>${input}</p>`)).toBe(expected)
  })

  // Test invalid cases
  const invalidCases = ["10", "", "5 K", "\nKM"]
  it.each(invalidCases)("should not wrap %s", (text) => {
    const input = `<p>${text}</p>`
    expect(testTagSmallcapsHTML(input)).toBe(input)
  })
})

describe("All-caps and Roman Numerals", () => {
  // Test valid acronyms
  const validAcronyms = [...new Set([...allowAcronyms, "AUP", "FBI", "CHAI", "ALÉNA", "ELROND'S"])]
  it.each(validAcronyms)("should wrap valid acronym: %s", (text) => {
    const targetAcronym = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
    expect(testTagSmallcapsHTML(`<p>${text}</p>`)).toBe(
      `<p><abbr class="small-caps">${targetAcronym}</abbr></p>`,
    )
  })

  // Test invalid cases
  const invalidCases = ["AI", "TlDR", "fbi", "FX.TE"]
  it.each(invalidCases)("should not wrap invalid case: %s", (text) => {
    const input = `<p>${text}</p>`
    expect(testTagSmallcapsHTML(input)).toBe(input)
  })

  // Test roman numerals
  const romanNumerals = ["III", "VII", "MXC", "IV", "IX"]
  it.each(romanNumerals)("should preserve roman numeral: %s", (numeral) => {
    const input = `<p>${numeral}</p>`
    expect(testTagSmallcapsHTML(input)).toBe(input)
  })
})

// Fuzz test for isRomanNumeral
describe("Roman numeral tests", () => {
  const rng = seedrandom("fixed-seed-for-deterministic-tests")

  // Helper function to generate valid Roman numerals
  function generateValidRomanNumeral(): string {
    const romanDigits = [
      ["", "M", "MM", "MMM"],
      ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM"],
      ["", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC"],
      ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"],
    ]

    return romanDigits.map((digit) => digit[Math.floor(rng() * digit.length)]).join("")
  }

  // Generate 100 valid Roman numerals
  const validNumerals = Array.from({ length: 100 }, generateValidRomanNumeral)

  it.each([...validNumerals, "IV"])("should identify %s as a valid Roman numeral", (numeral) => {
    expect(isRomanNumeral(numeral)).toBe(true)
  })

  const numeralSentences = ["I use the roman numeral XVII.", "I use the roman numeral XVII "]
  it.each(numeralSentences)("should identify %s to contain a valid Roman numeral", (sentence) => {
    const input = `<p>${sentence}</p>`
    const processedHtml: string = testTagSmallcapsHTML(input)
    expect(processedHtml).toBe(input) // should not wrap the numeral in <abbr> tags
  })

  // Test some edge cases
  const edgeCases = ["", "MMMM", "CCCC", "XXXX", "IIII", "VV", "LL", "DD"]
  it.each(edgeCases)("should identify %s as an invalid Roman numeral", (numeral) => {
    expect(isRomanNumeral(numeral)).toBe(false)
  })

  // Test some invalid inputs
  const invalidInputs = ["ABC", "123", "MLKI", "IVXLCDM", "mxvi", "X I V"]
  it.each(invalidInputs)("should identify %s as an invalid Roman numeral", (input) => {
    expect(isRomanNumeral(input)).toBe(false)
  })
})

describe("REGEX_ACRONYM tests", () => {
  function testAcronym({
    input,
    expectedMatch,
    expectedAcronym,
    expectedSuffix = "",
  }: {
    input: string
    expectedMatch: string
    expectedAcronym: string
    expectedSuffix?: string
  }) {
    const match = REGEX_ACRONYM.exec(input)
    expect(match).not.toBeNull()
    if (match) {
      expect(match[0]).toBe(expectedMatch)
      expect(match.groups?.acronym).toBe(expectedAcronym)
      expect(match.groups?.suffix || "").toBe(expectedSuffix)
    }
  }

  const commonAcronyms = [
    "NASA",
    "FBI",
    "CIA",
    "NATO",
    "UNESCO",
    "WHO",
    "UNICEF",
    "OPEC",
    "NAFTA",
    "ASAP",
    "IAEA",
    "INTERPOL",
    "UNHCR",
    "LGBTQ",
    "POTUS",
    "CAFÉ",
    "ÉCOLE",
    "ÊTRE",
    "CRÈME",
    "THÉÂTRE",
    "E2EE",
    "A1B2C3",
  ]

  // eslint-disable-next-line jest/expect-expect
  it.each(commonAcronyms)("should match common acronym: %s", (acronym) => {
    testAcronym({ input: acronym, expectedMatch: acronym, expectedAcronym: acronym })
  })

  it.each(commonAcronyms)("should not match when contiguous with lowercase: %sa", (acronym) => {
    expect(REGEX_ACRONYM.test(`${acronym}a`)).toBe(false)
  })

  // eslint-disable-next-line jest/expect-expect
  it.each(commonAcronyms)("should match when ending with 's': %ss", (acronym) => {
    testAcronym({
      input: `${acronym}s`,
      expectedMatch: `${acronym}s`,
      expectedAcronym: acronym,
      expectedSuffix: "s",
    })
  })

  // eslint-disable-next-line jest/expect-expect
  it.each(commonAcronyms)("should match when ending with 'x': %sx", (acronym) => {
    testAcronym({
      input: `${acronym}x`,
      expectedMatch: `${acronym}x`,
      expectedAcronym: acronym,
      expectedSuffix: "x",
    })
  })

  // eslint-disable-next-line jest/expect-expect
  it.each(smallCapsSeparators.split(""))("should match acronyms separated by '%s'", (separator) => {
    testAcronym({
      input: `FBI${separator}CIA`,
      expectedMatch: `FBI${separator}CIA`,
      expectedAcronym: `FBI${separator}CIA`,
    })
  })

  const foreignAcronyms = ["CAFÉ", "RÉSUMÉ", "ÜBER", "FAÇADE"]
  // eslint-disable-next-line jest/expect-expect
  it.each(foreignAcronyms)("should match foreign acronyms with accents: %s", (acronym) => {
    testAcronym({ input: acronym, expectedMatch: acronym, expectedAcronym: acronym })
  })

  // eslint-disable-next-line jest/expect-expect
  it("Should match when sandwiched by accented uppercase characters", () => {
    testAcronym({ input: " ÉÉÉ ", expectedMatch: "ÉÉÉ", expectedAcronym: "ÉÉÉ" })
  })

  const punctuationCases = [
    ["NASA.", "NASA"],
    ["FBI,", "FBI"],
    ["CIA!", "CIA"],
    ["NATO?", "NATO"],
    ["UNESCO:", "UNESCO"],
    ["WHO;", "WHO"],
    ["UNICEF'", "UNICEF"],
    ['OPEC"', "OPEC"],
  ]
  // eslint-disable-next-line jest/expect-expect
  it.each(punctuationCases)(
    "should match acronym followed by punctuation: %s",
    (input, expected) => {
      testAcronym({ input, expectedMatch: expected, expectedAcronym: expected, expectedSuffix: "" })
    },
  )

  const invalidCases = [
    "NASa",
    "fBI",
    "CIa",
    "NaTO",
    "UNESCo",
    "WHo",
    "UNICEf",
    "OPEc",
    "NAFTAing",
    "ASAPly",
    "IAEAish",
    "INTERPOLesque",
    "CAFé",
    "éCOLE",
    "êTRE",
    "CRèME",
    "THéÂTRE",
  ]
  it.each(invalidCases)("should not match invalid cases: %s", (case_) => {
    expect(REGEX_ACRONYM.test(case_)).toBe(false)
  })

  // eslint-disable-next-line jest/expect-expect
  it.each(smallCapsSeparators.split(""))("should match acronyms separated by '%s'", (separator) => {
    testAcronym({
      input: `FBI${separator}CIA`,
      expectedMatch: `FBI${separator}CIA`,
      expectedAcronym: `FBI${separator}CIA`,
    })
  })

  it("should correctly capture multiple acronyms in a string", () => {
    const input = "The FBIs and CIAs work with NATOs"
    const globalRegex = new RegExp(REGEX_ACRONYM.source, "g")
    const matches = Array.from(input.matchAll(globalRegex))
    expect(matches).toHaveLength(3)
    expect(matches[0].groups?.acronym).toBe("FBI")
    expect(matches[0].groups?.suffix).toBe("s")
    expect(matches[1].groups?.acronym).toBe("CIA")
    expect(matches[1].groups?.suffix).toBe("s")
    expect(matches[2].groups?.acronym).toBe("NATO")
    expect(matches[2].groups?.suffix).toBe("s")
  })

  // eslint-disable-next-line jest/expect-expect
  it("should correctly capture acronym with 's' suffix and punctuation", () => {
    testAcronym({
      input: "NASAs.",
      expectedMatch: "NASAs",
      expectedAcronym: "NASA",
      expectedSuffix: "s",
    })
  })

  // eslint-disable-next-line jest/expect-expect
  it("should correctly capture acronym with 'x' suffix and punctuation", () => {
    testAcronym({
      input: "FBIx,",
      expectedMatch: "FBIx",
      expectedAcronym: "FBI",
      expectedSuffix: "x",
    })
  })
})

describe("REGEX_ABBREVIATION tests", () => {
  function testAbbreviation({
    input,
    expectedNumber,
    expectedAbbreviation,
  }: {
    input: string
    expectedNumber: string
    expectedAbbreviation: string
  }) {
    const fullExpectedMatch = `${expectedNumber}${expectedAbbreviation}`
    const match = REGEX_ABBREVIATION.exec(input)
    expect(match).not.toBeNull()
    if (match) {
      expect(match[0]).toBe(fullExpectedMatch)
      expect(match.groups?.number).toBe(expectedNumber)
      expect(match.groups?.abbreviation).toBe(expectedAbbreviation)
    }
  }

  // eslint-disable-next-line jest/expect-expect
  it.each([
    ["100km", "100", "km"],
    ["3.3km", "3.3", "km"],
    ["5TB", "5", "TB"],
    ["-2.5MB", "2.5", "MB"],
    ["300k", "300", "k"],
    ["300W", "300", "W"],
  ])("should match abbreviation: %s", (input, expectedNumber, expectedAbbreviation) => {
    testAbbreviation({ input, expectedNumber, expectedAbbreviation })
  })

  it.each(["1000", "KM", "1000 km", "1000-km", "1000.km", "5N"])(
    "should not match invalid abbreviations: %s",
    (input) => {
      expect(REGEX_ABBREVIATION.test(input)).toBe(false)
    },
  )
})

const allCapsSentences = ["I LOVE SHREK", "WHERE DID YOU GO", "X-CAFÉ", "THE GPT-2 RESULTS"]
describe("validSmallCapsPhrase Regex Tests", () => {
  const validSmallCapsPhraseRegex = new RegExp(validSmallCapsPhrase)
  describe("Should Match", () => {
    it.each(allCapsSentences)("should match phrase: '%s'", (input) => {
      expect(validSmallCapsPhraseRegex.test(input)).toBe(true)
    })
  })

  describe("Should Not Match", () => {
    it.each(["I", "XY", "Wht A R E you T alKIng about"])("should not match: '%s'", (input) => {
      expect(validSmallCapsPhraseRegex.test(input)).toBe(false)
    })

    it.each(["C-A, POWER"])("should not match: '%s'", (input) => {
      const startingRegexp = new RegExp(`^${validSmallCapsPhraseRegex.source}`)
      expect(startingRegexp.test(input)).toBe(false)
    })
  })
})

describe("allCapsContinuation Regex Tests", () => {
  const allCapsContinuationRegex = new RegExp(allCapsContinuation)

  describe("Should Match", () => {
    const dashPhrases = ["-HI", " HI", "- - - -HI"]

    it.each(dashPhrases)("should match continuation: '%s'", (input) => {
      expect(allCapsContinuationRegex.test(input)).toBe(true)
    })

    it("should not match a single word", () => {
      expect(allCapsContinuationRegex.test("HI")).toBe(false)
    })
  })
})

const notAllCapsSentences = ["I AM HI", "YO YO YO how are you", "What ARE you TALKING about"]
describe("REGEX_ALL_CAPS_PHRASE Regex Tests", () => {
  describe("Should Match", () => {
    const validPhrases = [
      ...allCapsSentences,
      "O'BRIEN'S",
      "What are you TALKING ABOUT ? !",
      "THE FBI AGENT",
      "MY FBI AGENT",
      "SOME LONG-PHRASE HERE",
      "THIS IS A TEST",
    ]

    it.each(validPhrases)("should match phrase: %s", (input) => {
      expect(REGEX_ALL_CAPS_PHRASE.test(input)).toBe(true)
    })
  })

  describe("Should Not Match", () => {
    const invalidPhrases = [
      ...notAllCapsSentences,
      // Single letter at start of sentence
      "A FBI",
      "I. A FBI",
      "Hello! A FBI",
      "What? A FBI",
      // Other invalid cases
      "A",
      "AB",
      "A B",
      "The FBI", // Single word after article
      "A B C", // Multiple single letters
    ]

    it.each(invalidPhrases)("should not match phrase: %s", (input) => {
      expect(REGEX_ALL_CAPS_PHRASE.test(input)).toBe(false)
    })
  })

  // Test the full HTML transformation
  const htmlCases = [
    ["<p>A FBI AGENT watched.</p>", '<p>A <abbr class="small-caps">fbi agent</abbr> watched.</p>'],
    [
      "<p>Hello! A FBI AGENT watched.</p>",
      '<p>Hello! A <abbr class="small-caps">fbi agent</abbr> watched.</p>',
    ],
    [
      "<p>THE FBI AGENT watched.</p>",
      '<p><abbr class="small-caps">The fbi agent</abbr> watched.</p>',
    ],
  ]

  it.each(htmlCases)("should correctly transform HTML: %s", (input, expected) => {
    expect(testTagSmallcapsHTML(input)).toBe(expected)
  })
})

describe("skipFormatting", () => {
  // Dynamically generate test cases for each skipSmallcapsClasses
  const classTestCases = skipSmallcapsClasses.map((className) => ({
    desc: `should return true for ${className} class`,
    element: h("div", { class: className }),
    expected: true,
  }))

  const additionalTestCases = [
    {
      desc: "should return true for multiple classes including no-formatting",
      element: h("div", { class: "other-class no-formatting" }),
      expected: true,
    },
    {
      desc: "should return false for other classes",
      element: h("div", { class: "some-other-class" }),
      expected: false,
    },
    {
      desc: "should return false for no classes",
      element: h("div"),
      expected: false,
    },
    {
      desc: "should return true for style tag",
      element: h("style"),
      expected: true,
    },
    {
      desc: "should return false for text node",
      element: { type: "text", value: "test text" },
      expected: false,
    },
  ]

  const testCases = [...classTestCases, ...additionalTestCases]

  it.each(testCases)("$desc", ({ element, expected }) => {
    expect(skipSmallcaps(element)).toBe(expected)
  })
})

describe("no-formatting tests", () => {
  it.each(["AUP", ...allowAcronyms])(
    "should not wrap acronyms in no-formatting blocks: %s",
    (acronym: string) => {
      const input = `<div class="no-formatting"><p>${acronym}</p></div>`
      const processedHtml = testTagSmallcapsHTML(input)
      expect(processedHtml).toBe(input)
    },
  )

  it("should not wrap acronyms in no-smallcaps blocks", () => {
    const input = '<div class="no-smallcaps"><p>NASA launched a new satellite.</p></div>'
    const processedHtml = testTagSmallcapsHTML(input)
    expect(processedHtml).toBe(input)
  })

  it("should not error when no ancestors are provided", () => {
    const input = "test"
    const processedHtml = testTagSmallcapsHTML(input)
    expect(processedHtml).toBe(input)
  })

  it("should not wrap acronyms in code blocks", () => {
    const input = "<code>NASA launched a new satellite.</code>"
    const processedHtml = testTagSmallcapsHTML(input)
    expect(processedHtml).toBe(input)
  })

  it("should handle nested formatting blocks correctly", () => {
    const input = `
      <div class="no-formatting">
        <p>NASA outside</p>
        <div>
          <p>NASA inside</p>
        </div>
      </div>
      <p>NASA after</p>`
    const expected = `
      <div class="no-formatting">
        <p>NASA outside</p>
        <div>
          <p>NASA inside</p>
        </div>
      </div>
      <p><abbr class="small-caps">Nasa</abbr> after</p>`
    const processedHtml = testTagSmallcapsHTML(input)
    expect(processedHtml).toBe(expected)
  })

  it("should handle elvish class correctly", () => {
    const input = '<span class="elvish">NASA</span>'
    const processedHtml = testTagSmallcapsHTML(input)
    expect(processedHtml).toBe(input)
  })

  it("should not double-wrap abbreviations", () => {
    const input = "<abbr>NASA</abbr>"
    const processedHtml = testTagSmallcapsHTML(input)
    expect(processedHtml).toBe(input)
  })

  it("should not wrap acronyms in language-tagged code blocks", () => {
    const input =
      '<code data-language="pseudocode"><em>IF human can understand THEN do something</em></code>'
    const processedHtml = testTagSmallcapsHTML(input)
    expect(processedHtml).toBe(input)
  })

  it("should not wrap acronyms in style tags", () => {
    const input = "<style>BODY { color: red; }</style>"
    const processedHtml = testTagSmallcapsHTML(input)
    expect(processedHtml).toBe(input)
  })

  it("should not wrap acronyms in katex tags", () => {
    const input = '<span class="katex">NASA</span>'
    const processedHtml = testTagSmallcapsHTML(input)
    expect(processedHtml).toBe(input)
  })
})

describe("shouldSkipNode", () => {
  // Helper function to create a text node
  const createTextNode = (value: string): Text => ({ type: "text", value })

  const testCases = [
    {
      desc: "should return true for text in no-formatting div",
      node: createTextNode("NASA"),
      ancestors: [h("div", { class: "no-formatting" })],
      expected: true,
    },
    {
      desc: "should return true for text in no-smallcaps div",
      node: createTextNode("NASA"),
      ancestors: [h("div", { class: "no-smallcaps" })],
      expected: true,
    },
    {
      desc: "should return true for text in code element",
      node: createTextNode("NASA"),
      ancestors: [h("code")],
      expected: true,
    },
    {
      desc: "should return true for text in elvish class",
      node: createTextNode("NASA"),
      ancestors: [h("span", { class: "elvish" })],
      expected: true,
    },
    {
      desc: "should return true for text in abbr element",
      node: createTextNode("NASA"),
      ancestors: [h("abbr")],
      expected: true,
    },
    {
      desc: "should return true for text in nested no-formatting",
      node: createTextNode("NASA"),
      ancestors: [h("div", { class: "no-formatting" })],
      expected: true,
    },
  ]
  it.each(testCases)("$desc", ({ node, ancestors, expected }) => {
    expect(shouldSkipNode(node, ancestors)).toBe(expected)
  })
})

describe("Capitalization tests", () => {
  const capitalCases = [
    [
      "First sentence. NASA is cool.",
      'First sentence. <abbr class="small-caps">Nasa</abbr> is cool.',
    ],
    ["Hello. I LOVE CATS.", 'Hello. <abbr class="small-caps">I love cats</abbr>.'],
    ["What? FBI agent.", 'What? <abbr class="small-caps">Fbi</abbr> agent.'],
    [
      "NATO and NATO",
      '<abbr class="small-caps">Nato</abbr> and <abbr class="small-caps">nato</abbr>',
    ],
    [
      "First sentence. CAFÉ is nice.",
      'First sentence. <abbr class="small-caps">Café</abbr> is nice.',
    ],
    ["Hello. ÊTRE OU NE PAS ÊTRE.", 'Hello. <abbr class="small-caps">Être ou ne pas être</abbr>.'],
    ["What? ÉCOLE time.", 'What? <abbr class="small-caps">École</abbr> time.'],
    [
      "CRÈME and CRÈME",
      '<abbr class="small-caps">Crème</abbr> and <abbr class="small-caps">crème</abbr>',
    ],
    ["i.e. MIRI", 'i.e. <abbr class="small-caps">miri</abbr>'],
    ["I.E. MIRI", 'I.E. <abbr class="small-caps">miri</abbr>'],
    ["e.g. MIRI", 'e.g. <abbr class="small-caps">miri</abbr>'],
    ["E.G. MIRI", 'E.G. <abbr class="small-caps">miri</abbr>'],
  ]

  it.each(capitalCases)("should properly capitalize: %s", (input, expected) => {
    expect(testTagSmallcapsHTML(`<p>${input}</p>`)).toBe(`<p>${expected}</p>`)
  })

  const midSentenceCases = [
    ["The NASA program", 'The <abbr class="small-caps">nasa</abbr> program'],
    ["A FBI agent", 'A <abbr class="small-caps">fbi</abbr> agent'],
    ["The CAFÉ opened", 'The <abbr class="small-caps">café</abbr> opened'],
    ["A ÉCOLE student", 'A <abbr class="small-caps">école</abbr> student'],
  ]

  it.each(midSentenceCases)("should not capitalize mid-sentence: %s", (input, expected) => {
    expect(testTagSmallcapsHTML(`<p>${input}</p>`)).toBe(`<p>${expected}</p>`)
  })

  const nestedElementCases = [
    [
      "<p><em>First sentence. NASA is here.</em></p>",
      '<p><em>First sentence. <abbr class="small-caps">Nasa</abbr> is here.</em></p>',
    ],
    [
      "<p>What, why is the <em><strong>FBI agent</strong></em> here?</p>",
      '<p>What, why is the <em><strong><abbr class="small-caps">fbi</abbr> agent</strong></em> here?</p>',
    ],
    [
      "<p><strong>First sentence.</strong> NASA is here.</p>",
      '<p><strong>First sentence.</strong> <abbr class="small-caps">Nasa</abbr> is here.</p>',
    ],
    [
      "<p>First sentence. <strong>CAFÉ is here.</strong></p>",
      '<p>First sentence. <strong><abbr class="small-caps">Café</abbr> is here.</strong></p>',
    ],
    [
      "<p><em>First sentence. ÉCOLE is here.</em></p>",
      '<p><em>First sentence. <abbr class="small-caps">École</abbr> is here.</em></p>',
    ],
    [
      "<p>What, why is the <strong>CAFÉ open</strong> here?</p>",
      '<p>What, why is the <strong><abbr class="small-caps">café</abbr> open</strong> here?</p>',
    ],
    [
      "<p>What, why is the <em><strong>ÉCOLE empty</strong></em> now?</p>",
      '<p>What, why is the <em><strong><abbr class="small-caps">école</abbr> empty</strong></em> now?</p>',
    ],
  ]

  it.each(nestedElementCases)(
    "should handle capitalization in nested elements: %s",
    (input, expected) => {
      expect(testTagSmallcapsHTML(input)).toBe(expected)
    },
  )

  const inlineElementCases = Array.from(INLINE_ELEMENTS)
    .map((tag) => [
      [
        `<p>First sentence. <${tag}>NASA is here.</${tag}></p>`,
        `<p>First sentence. <${tag}><abbr class="small-caps">Nasa</abbr> is here.</${tag}></p>`,
      ],
      [
        `<p><${tag}>The NASA program</${tag}></p>`,
        `<p><${tag}>The <abbr class="small-caps">nasa</abbr> program</${tag}></p>`,
      ],
      [
        `<p>First sentence. <${tag}>The <strong>NASA</strong> program.</${tag}></p>`,
        `<p>First sentence. <${tag}>The <strong><abbr class="small-caps">nasa</abbr></strong> program.</${tag}></p>`,
      ],
      [
        `<p><${tag}>NASA</${tag}> and <${tag}>FBI</${tag}></p>`,
        `<p><${tag}><abbr class="small-caps">Nasa</abbr></${tag}> and <${tag}><abbr class="small-caps">fbi</abbr></${tag}></p>`,
      ],
    ])
    .flat()

  it.each(inlineElementCases)("should handle inline elements correctly: %s", (input, expected) => {
    expect(testTagSmallcapsHTML(input)).toBe(expected)
  })
})

describe("capitalizeAfterEnding regex", () => {
  const validCases = [
    // Basic sentence endings
    ["F"], // Start with a letter
    ["  S"], // Start with spaces
    ["Previous sentence. A"],
    ["Question? B"],
    ["Exclamation! C"],
    ["   Multiple spaces.    X"],

    // Accented capitals
    ["É"], // Start with accented capital
    ["  È"], // Start with space and accented capital
    ["Previous sentence. É"],
    ["Question? Ê"],
    ["Exclamation! Ë"],
    ["   Multiple spaces.    Ô"],

    // Mixed punctuation and spacing
    ["...! A"],
    ["?! B"],
    [".   C"], // Multiple spaces after period
    ["!    É"], // Multiple spaces after exclamation with accent
    ["?.   Ô"], // Multiple punctuation with spaces
  ]

  const invalidCases = [
    // Basic invalid cases
    "not capitalized",
    "mid sentence Word",
    "no period just spaces  still same",
    ".lowercase after period",
    "?lowercase after question",
    "!lowercase after exclamation",
    "Ends with period.",
    "Ends with space ",
    "No final capital A.",
    "Multiple. Sentences. Here",

    // Accented invalid cases
    "not capitalized é",
    "mid sentence Éword",
    "no period just spaces  é still same",
    ".lowercase after period é",
    "?lowercase after question è",
    "!lowercase after exclamation ê",
    "No final capital É.",

    // Edge cases
    "A.B", // No space after period
    "A?B", // No space after question mark
    "A!B", // No space after exclamation
    ".A", // Just punctuation and capital
    "?A", // Just punctuation and capital
    "!A", // Just punctuation and capital
  ]

  it.each(validCases)("should match end of sentence with capital: %s", (text) => {
    expect(capitalizeAfterEnding.test(text)).toBe(true)
  })

  it.each(invalidCases)("should not match: %s", (text) => {
    expect(capitalizeAfterEnding.test(text)).toBe(false)
  })
})

describe("capitalizeMatch", () => {
  // Helper to create a text node with a parent
  const createTextContext = (text: string, index = 0) => {
    const node = { type: "text", value: text } as Text
    const parent = { type: "element", children: [node] } as Parent
    return { node, parent, index }
  }

  // Helper to create a match array with index
  const createMatch = (matchText: string, index: number): RegExpMatchArray => {
    const match = [matchText] as RegExpMatchArray
    match.index = index
    return match
  }

  // Get all punctuation characters from PUNCTUATION_BEFORE_MATCH
  const punctuationChars = Array.from(PUNCTUATION_BEFORE_MATCH.source.slice(1, -1))

  type TestCase = [string, string, number, boolean]
  const testCases: TestCase[] = [
    // Basic position cases
    ["start of first node", "NASA is cool", 0, true],
    ["after period", "First. NASA is cool", 7, true],
    ["after question mark", "What? NASA is cool", 6, true],
    ["after exclamation", "Wow! NASA is cool", 5, true],
    ["multiple spaces after period", "First.   NASA is cool", 9, true],
    ["mid-sentence", "The NASA program", 4, false],
    ["after comma", "Hello, NASA program", 7, false],
    ["after semicolon", "First; NASA next", 7, false],
    ["empty text before match", "NASA", 0, true],
    ["only punctuation and spaces before", ".  NASA", 3, true],
    ["period without space", "First.NASA", 6, false],
    ["multiple sentences", "First. Second. NASA", 15, true],

    // Test each punctuation character from PUNCTUATION_BEFORE_MATCH
    ...punctuationChars.map(
      (char): TestCase => [`opening ${char}`, `${char}NASA) is cool`, 1, true],
    ),

    // Mixed punctuation and position cases
    ["punctuation after period", "First. (NASA) is cool", 8, true],
    ["punctuation mid-sentence", "The (NASA) program", 5, false],
    ["multiple punctuation mid-sentence", "The ([{NASA}]) program", 7, false],
    ["punctuation after other punctuation", "Hello, (NASA) program", 8, false],

    // Edge cases with PUNCTUATION_BEFORE_MATCH characters
    ["only punctuation", "(NASA)", 1, true],
    ["multiple punctuation only", "([{NASA}])", 3, true],
    ["mixed spaces and punctuation", "  (  NASA  )", 5, true],
    ["punctuation with no spaces", "(NASA)", 1, true],
    ["nested punctuation", "((NASA))", 2, true],

    // Test combinations of punctuation
    ["all punctuation types", `${punctuationChars.join("")}NASA`, punctuationChars.length, true],
    [
      "mixed punctuation and spaces",
      `  ${punctuationChars.join(" ")} NASA`,
      punctuationChars.length * 2 + 2,
      true,
    ],
  ]

  it.each(testCases)("%s", (desc, text, matchIndex, expected) => {
    const { node, parent, index } = createTextContext(text)
    const match = createMatch("NASA", matchIndex)
    expect(shouldCapitalizeMatch(match, node, index, [parent])).toBe(expected)
  })

  // Special case for undefined match index
  it("should not capitalize when match index is undefined", () => {
    const { node, parent, index } = createTextContext("NASA")
    const match = createMatch("NASA", undefined as unknown as number)
    expect(shouldCapitalizeMatch(match, node, index, [parent])).toBe(false)
  })

  // Test nested inline elements
  it("should handle nested inline elements at start", () => {
    const textNode = { type: "text", value: "NASA is cool" } as Text
    const strong = { type: "element", tagName: "strong", children: [textNode] } as Parent
    const em = { type: "element", tagName: "em", children: [strong] } as Parent
    const paragraphNode = { type: "element", tagName: "p", children: [em] } as Parent

    const match = createMatch("NASA", 0)
    expect(shouldCapitalizeMatch(match, textNode, 0, [paragraphNode, em, strong])).toBe(true)
  })

  it("should handle nested inline elements mid-sentence", () => {
    const textNode = { type: "text", value: "NASA is cool" } as Text
    const strong = { type: "element", tagName: "strong", children: [textNode] } as Parent
    const paragraphNode = {
      type: "element",
      tagName: "p",
      children: [
        { type: "text", value: "The " } as Text,
        strong,
        { type: "text", value: " program" } as Text,
      ],
    } as Parent

    const match = createMatch("NASA", 0)
    expect(shouldCapitalizeMatch(match, textNode, 1, [paragraphNode, strong])).toBe(false)
  })
})

describe("processMatchedText", () => {
  const testCases = [
    {
      desc: "should capitalize first letter when shouldCapitalize is true",
      input: "NASA",
      shouldCapitalize: true,
      expected: "Nasa",
    },
    {
      desc: "should lowercase all letters when shouldCapitalize is false",
      input: "NASA",
      shouldCapitalize: false,
      expected: "nasa",
    },
    {
      desc: "should handle accented characters when capitalizing",
      input: "ÉCOLE",
      shouldCapitalize: true,
      expected: "École",
    },
    {
      desc: "should handle accented characters when lowercasing",
      input: "ÉCOLE",
      shouldCapitalize: false,
      expected: "école",
    },
    {
      desc: "should handle mixed case input when capitalizing",
      input: "nAsA",
      shouldCapitalize: true,
      expected: "Nasa",
    },
    {
      desc: "should handle mixed case input when lowercasing",
      input: "nAsA",
      shouldCapitalize: false,
      expected: "nasa",
    },
  ]

  it.each(testCases)("$desc", ({ input, shouldCapitalize, expected }) => {
    expect(processMatchedText(input, shouldCapitalize)).toBe(expected)
  })
})

describe("isInAllowList", () => {
  const validCases = [
    // Exact matches
    ...allowAcronyms,
    // With 's' suffix
    ...allowAcronyms.map((a) => `${a}s`),
    // With 'x' suffix
    ...allowAcronyms.map((a) => `${a}x`),
  ]

  it.each(validCases)("should return true for allowed text: %s", (text) => {
    expect(isInAllowList(text)).toBe(true)
  })

  const invalidCases = [
    // Modified versions (excluding mp4 which is allowed in both cases)
    ...allowAcronyms.filter((a) => a.toLowerCase() !== "mp4").map((a) => a.toLowerCase()),
    // Modified versions with 'ing' suffix
    ...allowAcronyms.map((a) => `${a}ing`),
    // Random invalid cases
    "NOTINLIST",
    "NOTINLISTs",
    "NOTINLISTx",
    "RANDOM",
    "RANDOMs",
    "RANDOMx",
  ]

  it.each(invalidCases)("should return false for non-allowed text: %s", (text) => {
    expect(isInAllowList(text)).toBe(false)
  })
})

describe("shouldIgnoreNumericAbbreviation", () => {
  const validCases = [
    // Ordinals
    "1st",
    "2nd",
    "3rd",
    "4th",
    "11th",
    "21st",
    "22nd",
    "23rd",
    "100th",
    // Units with numbers
    "5ghz",
    "10GHZ",
    "2.5hz",
    "100Hz",
  ]

  it.each(validCases)("should return true for numeric abbreviation: %s", (text) => {
    expect(shouldIgnoreNumericAbbreviation(text)).toBe(true)
  })

  const invalidCases = [
    // No numbers
    "th",
    "st",
    "nd",
    "rd",
    "hz",
    "ghz",
    // Invalid formats
    "abc1st",
    "hz5",
    "ghz10",
    // Other cases
    "100m",
    "5km",
    "10kg",
    "1.5mb",
  ]

  it.each(invalidCases)("should return false for non-numeric abbreviation: %s", (text) => {
    expect(shouldIgnoreNumericAbbreviation(text)).toBe(false)
  })
})

describe("replaceSCInNode", () => {
  // Helper function to create a text node with parent
  const createNodeWithParent = (
    text: string,
  ): { node: Text; parent: Parent; ancestors: Parent[] } => {
    const node = { type: "text", value: text } as Text
    const parent = { type: "element", tagName: "p", children: [node] } as Parent
    return { node, parent, ancestors: [parent] }
  }

  // Helper to get the HTML string from parent's children
  const getHTML = (parent: Parent): string => {
    return parent.children
      .map((child) => {
        if (child.type === "text") return child.value
        if (child.type === "element") {
          const el = child as import("hast").Element
          const className = el.properties?.className
          const classAttr = className
            ? ` class="${Array.isArray(className) ? className.join(" ") : className}"`
            : ""

          const content = el.children?.[0]?.type === "text" ? (el.children[0] as Text).value : ""
          return `<${el.tagName}${classAttr}>${content}</${el.tagName}>`
        }
        return ""
      })
      .join("")
  }

  describe("Processing order and priority", () => {
    it("should prioritize allowlist over roman numerals", () => {
      const { node, parent, ancestors } = createNodeWithParent(
        "IID is a roman numeral but also whitelisted",
      )
      replaceSCInNode(node, ancestors)
      expect(getHTML(parent)).toBe(
        '<abbr class="small-caps">Iid</abbr> is a roman numeral but also whitelisted',
      )
    })

    it("should preserve roman numerals when not whitelisted", () => {
      const { node, parent, ancestors } = createNodeWithParent("Chapter XIV discusses")
      replaceSCInNode(node, ancestors)
      expect(getHTML(parent)).toBe("Chapter XIV discusses")
    })

    it("should preserve numeric abbreviations when not whitelisted", () => {
      const { node, parent, ancestors } = createNodeWithParent("The 1st place winner")
      replaceSCInNode(node, ancestors)
      expect(getHTML(parent)).toBe("The 1st place winner")
    })
  })

  describe("Match type handling", () => {
    it("should handle all-caps phrases", () => {
      const { node, parent, ancestors } = createNodeWithParent("They said I LOVE CODING HERE")
      replaceSCInNode(node, ancestors)
      expect(getHTML(parent)).toBe('They said <abbr class="small-caps">i love coding here</abbr>')
    })

    it("should handle acronyms with suffixes", () => {
      const { node, parent, ancestors } = createNodeWithParent("Multiple NASAs and FBIs")
      replaceSCInNode(node, ancestors)
      expect(getHTML(parent)).toBe(
        'Multiple <abbr class="small-caps">nasa</abbr>s and <abbr class="small-caps">fbi</abbr>s',
      )
    })

    it("should handle numeric abbreviations", () => {
      const { node, parent, ancestors } = createNodeWithParent("100km and 5TB storage")
      replaceSCInNode(node, ancestors)
      expect(getHTML(parent)).toBe(
        '<abbr class="small-caps">100km</abbr> and <abbr class="small-caps">5tb</abbr> storage',
      )
    })
  })

  describe("Error handling", () => {
    it("should throw error if node is not child of parent", () => {
      const node = { type: "text", value: "test" } as Text
      const parent = { type: "element", children: [] } as Parent
      expect(() => replaceSCInNode(node, [parent])).toThrow(
        "replaceSCInNode: node is not the child of its parent",
      )
    })
  })

  describe("Capitalization in context", () => {
    it("should capitalize at start of sentence", () => {
      const { node, parent, ancestors } = createNodeWithParent("NASA is cool. NASA is great.")
      replaceSCInNode(node, ancestors)
      expect(getHTML(parent)).toBe(
        '<abbr class="small-caps">Nasa</abbr> is cool. <abbr class="small-caps">Nasa</abbr> is great.',
      )
    })

    it("should not capitalize mid-sentence", () => {
      const { node, parent, ancestors } = createNodeWithParent("The NASA program")
      replaceSCInNode(node, ancestors)
      expect(getHTML(parent)).toBe('The <abbr class="small-caps">nasa</abbr> program')
    })
  })

  describe("Special cases", () => {
    it("should handle accented characters", () => {
      const { node, parent, ancestors } = createNodeWithParent("CAFÉ and ÉCOLE")
      replaceSCInNode(node, ancestors)
      expect(getHTML(parent)).toBe(
        '<abbr class="small-caps">Café</abbr> and <abbr class="small-caps">école</abbr>',
      )
    })

    it("should handle punctuation around matches", () => {
      const { node, parent, ancestors } = createNodeWithParent("(NASA), [FBI]; {CIA}!")
      replaceSCInNode(node, ancestors)
      expect(getHTML(parent)).toBe(
        '(<abbr class="small-caps">Nasa</abbr>), [<abbr class="small-caps">fbi</abbr>]; {<abbr class="small-caps">cia</abbr>}!',
      )
    })
  })

  describe("SVG context", () => {
    it("should use tspan instead of abbr when inside SVG", () => {
      const node = { type: "text", value: "Loss of GPT2-XL" } as Text
      const textEl = {
        type: "element",
        tagName: "text",
        children: [node],
        properties: {},
      } as Parent
      const svgEl = {
        type: "element",
        tagName: "svg",
        children: [textEl],
        properties: {},
      } as Parent
      replaceSCInNode(node, [svgEl, textEl])
      expect(getHTML(textEl)).toBe('Loss of <tspan class="small-caps">gpt2-xl</tspan>')
    })
  })
})
