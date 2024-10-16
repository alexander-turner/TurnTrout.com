import { rehype } from "rehype"
import { rehypeTagAcronyms } from "../tagacronyms"

// Test: Should wrap acronyms in <abbr> tags with class "small-caps"
const nasaIn = "<p>NASA launched a new satellite for NOAA to study GCRs.</p>"
const nasaOut =
  '<p><abbr class="small-caps">NASA</abbr> launched a new satellite for <abbr class="small-caps">NOAA</abbr> to study <abbr class="small-caps">GCR</abbr>s.</p>'

const GPTJ =
  "<p>Similarly, recent work by [Hernandez et al. (2023)](https://arxiv.org/abs/2304.00740) edits factual associations and features in GPT-J (6B)</p>"
const GPTJOut =
  '<p>Similarly, recent work by [Hernandez et al. (2023)](https://arxiv.org/abs/2304.00740) edits factual associations and features in <abbr class="small-caps">GPT-J</abbr> (<abbr class="small-caps">6B</abbr>)</p>'

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
    ["<p>GPT-2-XL</p>", '<p><abbr class="small-caps">GPT-2-XL</abbr></p>'],
    ["<p>MIRI-relevant math</p>", '<p><abbr class="small-caps">MIRI</abbr>-relevant math</p>'],
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
      expect(processedHtml).toBe(`<p><abbr class="small-caps">${text.toUpperCase()}</abbr></p>`)
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
  const textIn: Array<string> = ["AUP", "FBI", "TL;DR", "CHAI", "ALÉNA", "CCC", "ELROND'S", "ELROND’S"]
  for (const text of textIn) {
    it(`should wrap ${text} in <abbr> tags`, () => {
      const processedHtml: string = testTagAcronymsHTML(`<p>${text}</p>`)
      expect(processedHtml).toBe(`<p><abbr class="small-caps">${text}</abbr></p>`)
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

  const romanNumerals: Array<string> = ["III", "VII", "MXC", "XIVIL"]
  for (const numeral of romanNumerals) {
    it(`should not wrap ${numeral} in <abbr> tags`, () => {
      const input = `<p>${numeral}</p>`
      const processedHtml: string = testTagAcronymsHTML(input)
      expect(processedHtml).toBe(input)
    })
  }
})
