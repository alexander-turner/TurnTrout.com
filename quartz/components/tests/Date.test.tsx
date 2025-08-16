import type { JSX } from "preact"

import { describe, it, expect } from "@jest/globals"

import { type GlobalConfiguration } from "../../cfg"
import { type ValidLocale } from "../../i18n"
import { type QuartzPluginData } from "../../plugins/vfile"
import { getOrdinalSuffix, formatDate, getDate, DateElement } from "../Date"

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
      expect(
        formatDate(date, locale as ValidLocale, monthFormat as "short" | "long", true, false),
      ).toBe(expected)
    },
  )

  it("uses default parameters when optional arguments are omitted", () => {
    const date = new Date("2023-09-05T12:00:00Z")
    // Only pass date to rely on all defaults
    expect(formatDate(date)).toBe(
      'Sep <span class="ordinal-num">5</span><span class="ordinal-suffix">th</span>, 2023',
    )
  })

  describe("HTML formatting", () => {
    it("formats ordinal suffix with HTML when formatOrdinalSuffix is true", () => {
      const date = new Date("2023-08-01T12:00:00Z")
      expect(formatDate(date, "en-US", "short", true, true)).toBe(
        'Aug <span class="ordinal-num">1</span><span class="ordinal-suffix">st</span>, 2023',
      )
    })

    it("includes plain ordinal suffix when includeOrdinalSuffix is true but formatOrdinalSuffix is false", () => {
      const date = new Date("2023-08-02T12:00:00Z")
      expect(formatDate(date, "en-US", "short", true, false)).toBe("Aug 2nd, 2023")
    })

    it("applies extra styling to ordinal suffix", () => {
      const date = new Date("2023-08-01T12:00:00Z")
      expect(formatDate(date, "en-US", "short", true, true, "color: red")).toBe(
        'Aug <span class="ordinal-num">1</span><span class="ordinal-suffix" style="color: red">st</span>, 2023',
      )
    })

    it("doesn't include ordinal suffix when includeOrdinalSuffix is false", () => {
      const date = new Date("2023-08-01T12:00:00Z")
      expect(formatDate(date, "en-US", "short", false, true)).toBe("Aug 1, 2023")
    })
  })
})

describe("getDate", () => {
  const sampleDate = new Date("2024-05-15T00:00:00Z")
  it("returns the correct date based on cfg.defaultDateType", () => {
    const cfg = { defaultDateType: "created", locale: "en-US" } as unknown as GlobalConfiguration
    const data = { dates: { created: sampleDate } } as unknown as QuartzPluginData
    expect(getDate(cfg, data)).toBe(sampleDate)
  })

  it("throws an error when defaultDateType is missing", () => {
    const cfg = { locale: "en-US" } as unknown as GlobalConfiguration
    const data = { dates: { created: sampleDate } } as unknown as QuartzPluginData
    expect(() => getDate(cfg, data)).toThrow("defaultDateType")
  })
})

// New tests for DateElement component

describe("DateElement", () => {
  const cfg = { locale: "en-US" } as unknown as GlobalConfiguration
  const validDate = new Date("2023-08-01T12:00:00Z")

  it("renders a <time> element with correct attributes and inner HTML", () => {
    const element = DateElement({
      cfg,
      date: validDate,
      includeOrdinalSuffix: true,
      formatOrdinalSuffix: true,
      monthFormat: "short",
    }) as JSX.Element

    expect(element.type).toBe("time")
    expect(element.props.dateTime).toBe(validDate.toISOString())
    expect(element.props.dangerouslySetInnerHTML.__html).toContain("ordinal-num")
    expect(element.props.dangerouslySetInnerHTML.__html).toContain("ordinal-suffix")
  })

  it("throws an error when provided an invalid date string", () => {
    const invalidDate = "not-a-date"
    expect(() =>
      DateElement({
        cfg,
        date: invalidDate,
        includeOrdinalSuffix: true,
        formatOrdinalSuffix: true,
      }),
    ).toThrow("valid Date object or date string")
  })

  it("throws an error when date is undefined", () => {
    expect(() =>
      // @ts-expect-error testing undefined date
      DateElement({ cfg, date: undefined, includeOrdinalSuffix: true, formatOrdinalSuffix: true }),
    ).toThrow("valid Date object")
  })
})
