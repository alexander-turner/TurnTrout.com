// skipcq: JS-W1028, JS-W1028
import type { JSX } from "preact"

// skipcq: JS-W1028
import React from "react"

import { type GlobalConfiguration } from "../cfg"
import { type QuartzPluginData } from "../plugins/vfile"
import { locale } from "./constants"

export type ValidDateType = keyof Required<QuartzPluginData>["dates"]

/**
 * Retrieves the date from plugin data based on the configured default date type.
 * @param cfg - Configuration object containing defaultDateType.
 * @param data - Plugin data object which may contain dates.
 * @returns The date corresponding to the defaultDateType, or undefined if not available.
 */
export function getDate(cfg: GlobalConfiguration, data: QuartzPluginData): Date | undefined {
  if (!cfg.defaultDateType) {
    throw new Error(
      "Field 'defaultDateType' was not set in the configuration object of quartz.config.ts. See https://quartz.jzhao.xyz/configuration#general-configuration for more details.",
    )
  }
  return data.dates?.[cfg.defaultDateType]
}

/**
 * Returns the ordinal suffix.
 * For example, 1 -> "st", 2 -> "nd", 3 -> "rd", 4 -> "th", etc.
 * Handles special cases like 11th, 12th, and 13th.
 * @param number
 * @returns The ordinal suffix as a string.
 */
export function getOrdinalSuffix(number: number): string {
  if (number > 31 || number < 0) {
    throw new Error("Number must be between 0 and 31")
  }

  if (number >= 11 && number <= 13) {
    return "th"
  }
  switch (number % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
  }
}

/**
 * Formats a Date object into a localized string with an ordinal suffix for the day and includes the year.
 * @param d - The Date object to format.
 * @param monthFormat - The format of the month ("long" or "short").
 * @param includeOrdinalSuffix - Whether to include the ordinal suffix.
 * @param formatOrdinalSuffix - Whether to format the ordinal suffix as a superscript. If true, then you need to set the innerHTML of the time element to the date string.
 * @returns The formatted date string, e.g., "August 1st, 2023".
 */
export function formatDate(
  d: Date,
  monthFormat: "long" | "short" = "short",
  includeOrdinalSuffix = true,
  formatOrdinalSuffix = true,
  extraOrdinalStyling?: string,
): string {
  let day: string | number = d.getDate()
  const month = d.toLocaleDateString(locale, { month: monthFormat })
  const year = d.getFullYear()
  let suffix = ""
  if (includeOrdinalSuffix) {
    suffix = getOrdinalSuffix(day)
    if (formatOrdinalSuffix) {
      suffix = `<span class="ordinal-suffix"${extraOrdinalStyling ? ` style="${extraOrdinalStyling}"` : ""}>${suffix}</span>`
      day = `<span class="date-ordinal-num">${day}</span>`
    }
  }
  return `${month} ${day}${suffix}, ${year}`
}

interface DateElementProps {
  monthFormat?: "long" | "short"
  includeOrdinalSuffix?: boolean
  cfg: GlobalConfiguration
  date: Date | string
  formatOrdinalSuffix?: boolean
}

// Parse a frontmatter date value. Day-only "YYYY-MM-DD" strings are parsed in
// local time so display and the `datetime` attribute don't shift by one day in
// timezones behind UTC.
const parseDate = (date: Date | string): Date => {
  if (date instanceof Date) return date
  const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/.exec(date)
  if (match?.groups) {
    const { year, month, day } = match.groups
    return new Date(Number(year), Number(month) - 1, Number(day))
  }
  return new Date(date)
}

// Render date element with proper datetime attribute
export const DateElement = ({
  date,
  monthFormat,
  includeOrdinalSuffix,
  formatOrdinalSuffix,
}: DateElementProps): JSX.Element => {
  const dateObj = parseDate(date)

  if (isNaN(dateObj.getTime())) {
    throw new Error(`date must be a valid Date object or date string: ${date}`)
  }

  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, "0")
  const day = String(dateObj.getDate()).padStart(2, "0")

  return (
    <time
      dateTime={`${year}-${month}-${day}`}
      // skipcq: JS-0440
      dangerouslySetInnerHTML={{
        __html: formatDate(dateObj, monthFormat, includeOrdinalSuffix, formatOrdinalSuffix, ""),
      }}
    />
  )
}
