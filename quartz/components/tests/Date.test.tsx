import { getOrdinalSuffix, formatDate } from "../Date"
import { ValidLocale } from "../../i18n"

describe("getOrdinalSuffix", () => {
  it.each([
    [1, "st"],
    [21, "st"],
    [31, "st"],
    [2, "nd"],
    [22, "nd"],
    [3, "rd"],
    [23, "rd"],
    [4, "th"],
    [5, "th"],
    [10, "th"],
    [11, "th"],
    [12, "th"],
    [13, "th"],
    [20, "th"],
    [30, "th"],
  ])('returns "%s" for %i', (day, expected) => {
    expect(getOrdinalSuffix(day)).toBe(expected)
  })

  it.each([32, -1])("throws an error for invalid day number %i", (day) => {
    expect(() => getOrdinalSuffix(day)).toThrow("must be between")
  })
})

describe("formatDate", () => {
  it.each([
    ["2023-08-01T12:00:00Z", "en-US", "short", "Aug 1st, 2023"],
    ["2023-08-01T12:00:00Z", "en-US", "long", "August 1st, 2023"],
    ["2023-08-02T12:00:00Z", "en-US", "short", "Aug 2nd, 2023"],
    ["2023-08-03T12:00:00Z", "en-US", "short", "Aug 3rd, 2023"],
    ["2023-08-04T12:00:00Z", "en-US", "short", "Aug 4th, 2023"],
    ["2023-08-11T12:00:00Z", "en-US", "short", "Aug 11th, 2023"],
    ["2023-08-21T12:00:00Z", "en-US", "short", "Aug 21st, 2023"],
    ["2023-01-15T12:00:00Z", "en-US", "short", "Jan 15th, 2023"],
    ["2024-12-31T12:00:00Z", "en-US", "short", "Dec 31st, 2024"],
  ])(
    "formats %s correctly with locale %s and month format %s",
    (dateString, locale, monthFormat, expected) => {
      const date = new Date(dateString)
      expect(formatDate(date, locale as ValidLocale, monthFormat as "short" | "long")).toBe(
        expected,
      )
    },
  )
})
