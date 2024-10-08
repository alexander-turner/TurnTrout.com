import { minusReplace } from "../minus_sign"

describe("minusReplace", () => {
  it.each([
    ["The temperature is -5 degrees.", "The temperature is −5 degrees."],
    ["This is a well-known fact.", "This is a well-known fact."],
    ["The value is -3.14.", "The value is −3.14."],
    ["The value is - 3.", "The value is − 3."],
    ["Values are -1, -2, and -3.", "Values are −1, −2, and −3."],
    ["Use the -option flag.", "Use the -option flag."],
    ["(-3)", "(−3)"],
  ])("transforms '%s' to '%s'", (input, expected) => {
    expect(minusReplace(input)).toBe(expected)
  })
})
