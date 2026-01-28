import { transform, DEFAULT_SEPARATOR } from "./index.js"

// Unicode characters
const LDQ = "\u201C" // " left double quote
const RDQ = "\u201D" // " right double quote
const RSQ = "\u2019" // ' right single quote
const EM = "\u2014" // — em dash
const EN = "\u2013" // – en dash

describe("transform", () => {
  it("applies both quote and dash transformations", () => {
    const input = '"Hello," she said - "it\'s pages 1-5."'
    const expected = `${LDQ}Hello${RDQ}, she said${EM}${LDQ}it${RSQ}s pages 1${EN}5.${RDQ}`
    expect(transform(input)).toBe(expected)
  })

  it("handles complex mixed content", () => {
    const input = 'I was born in \'99 - "the best year" - and pages 10-20 are my favorite.'
    const expected = `I was born in ${RSQ}99${EM}${LDQ}the best year${RDQ}${EM}and pages 10${EN}20 are my favorite.`
    expect(transform(input)).toBe(expected)
  })

  it("preserves separator character", () => {
    const sep = DEFAULT_SEPARATOR
    const input = `"Hello${sep}" - test`
    const result = transform(input, { separator: sep })
    expect(result).toContain(sep)
  })
})

describe("DEFAULT_SEPARATOR", () => {
  it("is the Unicode Private Use Area character U+E000", () => {
    expect(DEFAULT_SEPARATOR).toBe("\uE000")
  })
})
