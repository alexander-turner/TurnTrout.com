import { rehype } from "rehype"
import {
  allowAcronyms,
  rehypeTagAcronyms,
  isRomanNumeral,
  REGEX_ACRONYM,
  smallCapsSeparators,
  REGEX_ABBREVIATION,
  validSmallCapsPhrase,
  allCapsContinuation,
  REGEX_ALL_CAPS_PHRASE,
} from "../tagacronyms"
import seedrandom from "seedrandom"

// Test: Should wrap acronyms in <abbr> tags with class "small-caps"
const nasaIn = "<p>NASA launched a new satellite for NOAA to study GCRs.</p>"
const nasaOut =
  '<p><abbr class="small-caps">nasa</abbr> launched a new satellite for <abbr class="small-caps">noaa</abbr> to study <abbr class="small-caps">gcr</abbr>s.</p>'

const GPTJ =
  "<p>Similarly, recent work by [Hernandez et al. (2023)](https://arxiv.org/abs/2304.00740) edits factual associations and features in GPT-J (6B)</p>"
const GPTJOut =
  '<p>Similarly, recent work by [Hernandez et al. (2023)](https://arxiv.org/abs/2304.00740) edits factual associations and features in <abbr class="small-caps">gpt-j</abbr> (<abbr class="small-caps">6b</abbr>)</p>'

function testTagAcronymsHTML(inputHTML: string) {
  return rehype()
    .data("settings", { fragment: true })
    .use(rehypeTagAcronyms)
    .processSync(inputHTML)
    .toString()
}

describe("rehypeTagAcronyms", () => {
  it.each([
    [nasaIn, nasaOut],
    [GPTJ, GPTJOut],
    ["<p>GPT-2-XL</p>", '<p><abbr class="small-caps">gpt-2-xl</abbr></p>'],
    ["<p>MIRI-relevant math</p>", '<p><abbr class="small-caps">miri</abbr>-relevant math</p>'],
    [
      "<p>I HATE YOU but YOU ARE SWEET-I LIKE YOU</p>",
      '<p><abbr class="small-caps">i hate you</abbr> but <abbr class="small-caps">you are sweet-i like you</abbr></p>',
    ],
  ])("should wrap acronyms in <abbr> tags with class 'small-caps'", (input, expectedOutput) => {
    const processedHtml: string = testTagAcronymsHTML(input)
    expect(processedHtml).toBe(expectedOutput)
  })
})

// Check that eg 100km becomes <abbr>100km</abbr>
describe("Abbreviations", () => {
  // Test: These should be wrapped in <abbr> tags
  const textIn: Array<string> = ["10ZB", ".1EXP", "10BTC", "100.0KM", "5K", "5k"]
  for (const text of textIn) {
    it(`should wrap ${text} in <abbr> tags`, () => {
      const processedHtml: string = testTagAcronymsHTML(`<p>${text}</p>`)
      expect(processedHtml).toBe(`<p><abbr class="small-caps">${text.toLowerCase()}</abbr></p>`)
    })
  }

  // Test: These should not be wrapped in <abbr> tags
  const ignoreIn: Array<string> = ["10", "", "5 K", "\nKM"]
  for (const text of ignoreIn) {
    it(`should not wrap ${text} in <abbr> tags`, () => {
      const processedHtml: string = testTagAcronymsHTML(`<p>${text}</p>`)
      expect(processedHtml).toBe(`<p>${text}</p>`)
    })
  }
})

describe("All-caps tests", () => {
  // Test: These should be wrapped in <abbr> tags
  const textIn: Array<string> = allowAcronyms.concat([
    "AUP",
    "FBI",
    "CHAI",
    "ALÉNA",
    "ELROND'S",
    "ELROND’S",
    "I HATE YOU",
  ])
  for (const text of textIn) {
    it(`should wrap ${text} in <abbr> tags`, () => {
      const processedHtml: string = testTagAcronymsHTML(`<p>${text}</p>`)
      expect(processedHtml).toBe(`<p><abbr class="small-caps">${text.toLowerCase()}</abbr></p>`)
    })
  }

  // Test: These should not be wrapped in <abbr> tags
  const ignoreIn: Array<string> = ["AI", "TlDR", "fbi", "FX.TE"]
  for (const text of ignoreIn) {
    it(`should not wrap ${text} in <abbr> tags`, () => {
      const processedHtml: string = testTagAcronymsHTML(`<p>${text}</p>`)
      expect(processedHtml).toBe(`<p>${text}</p>`)
    })
  }

  const romanNumerals: Array<string> = ["III", "VII", "MXC", "IV", "IX"]
  for (const numeral of romanNumerals) {
    it(`should not wrap ${numeral} in <abbr> tags`, () => {
      const input = `<p>${numeral}</p>`
      const processedHtml: string = testTagAcronymsHTML(input)
      expect(processedHtml).toBe(input)
    })
  }
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

  it.each(validNumerals)("should identify %s as a valid Roman numeral", (numeral) => {
    expect(isRomanNumeral(numeral)).toBe(true)
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
  ]

  it.each(commonAcronyms)("should match common acronym: %s", (acronym) => {
    testAcronym({ input: acronym, expectedMatch: acronym, expectedAcronym: acronym })
  })

  it.each(commonAcronyms)("should not match when contiguous with lowercase: %sa", (acronym) => {
    expect(REGEX_ACRONYM.test(acronym + "a")).toBe(false)
  })

  it.each(commonAcronyms)("should match when ending with 's': %ss", (acronym) => {
    testAcronym({
      input: acronym + "s",
      expectedMatch: acronym + "s",
      expectedAcronym: acronym,
      expectedSuffix: "s",
    })
  })

  it.each(commonAcronyms)("should match when ending with 'x': %sx", (acronym) => {
    testAcronym({
      input: acronym + "x",
      expectedMatch: acronym + "x",
      expectedAcronym: acronym,
      expectedSuffix: "x",
    })
  })

  it.each(smallCapsSeparators.split(""))("should match acronyms separated by '%s'", (separator) => {
    testAcronym({
      input: `FBI${separator}CIA`,
      expectedMatch: `FBI${separator}CIA`,
      expectedAcronym: `FBI${separator}CIA`,
    })
  })

  const foreignAcronyms = ["CAFÉ", "RÉSUMÉ", "ÜBER", "FAÇADE"]
  it.each(foreignAcronyms)("should match foreign acronyms with accents: %s", (acronym) => {
    testAcronym({ input: acronym, expectedMatch: acronym, expectedAcronym: acronym })
  })

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
  ]
  it.each(invalidCases)("should not match invalid cases: %s", (case_) => {
    expect(REGEX_ACRONYM.test(case_)).toBe(false)
  })

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

  it("should correctly capture acronym with 's' suffix and punctuation", () => {
    testAcronym({
      input: "NASAs.",
      expectedMatch: "NASAs",
      expectedAcronym: "NASA",
      expectedSuffix: "s",
    })
  })

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
    it.each(allCapsSentences.concat(["O'BRIEN'S", "What are you TALKING ABOUT ? !"]))(
      "should match phrase: '%s'",
      (input) => {
        expect(REGEX_ALL_CAPS_PHRASE.test(input)).toBe(true)
      },
    )
  })

  describe("Should Not Match", () => {
    it.each(notAllCapsSentences)("should not match phrase: '%s'", (input) => {
      expect(REGEX_ALL_CAPS_PHRASE.test(input)).toBe(false)
    })
  })
})
