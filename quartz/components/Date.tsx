import { GlobalConfiguration } from "../cfg"
import { ValidLocale } from "../i18n"
import { QuartzPluginData } from "../plugins/vfile"
import React from "react"

export type ValidDateType = keyof Required<QuartzPluginData>["dates"]

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
 * @param locale - The locale string (default is "en-US").
 * @param monthFormat - The format of the month ("long" or "short").
 * @param includeOrdinalSuffix - Whether to include the ordinal suffix.
 * @param formatOrdinalSuffix - Whether to format the ordinal suffix as a superscript. If true, then you need to set the innerHTML of the time element to the date string.
 * @returns The formatted date string, e.g., "August 1st, 2023".
 */
export function formatDate(
  d: Date,
  locale: ValidLocale = "en-US",
  monthFormat: "long" | "short" = "short",
  includeOrdinalSuffix: boolean = true,
  formatOrdinalSuffix: boolean = false,
): string {
  const day = d.getDate()
  const month = d.toLocaleDateString(locale, { month: monthFormat })
  const year = d.getFullYear()
  let suffix: string = ""
  if (includeOrdinalSuffix) {
    suffix = getOrdinalSuffix(day)
    if (formatOrdinalSuffix) {
      suffix = `<sup class="ordinal-suffix">${suffix}</sup>`
    }
  }
  return `${month} ${day}${suffix}, ${year}`
}

interface DateElementProps {
  monthFormat?: "long" | "short"
  includeOrdinalSuffix?: boolean
  cfg: GlobalConfiguration
  fileData: QuartzPluginData
  formatOrdinalSuffix?: boolean
}

// Render date element with proper datetime attribute
export const DateElement = ({
  cfg,
  fileData,
  monthFormat,
  includeOrdinalSuffix,
  formatOrdinalSuffix,
}: DateElementProps): JSX.Element => {
  const date = fileData.frontmatter?.date_published
    ? new Date(fileData.frontmatter.date_published as string)
    : getDate(cfg, fileData)
  return date ? (
    <time
      dateTime={fileData.frontmatter?.date_published as string}
      dangerouslySetInnerHTML={{
        __html: formatDate(
          date,
          cfg.locale,
          monthFormat,
          includeOrdinalSuffix,
          formatOrdinalSuffix,
        ),
      }}
    />
  ) : (
    <></>
  )
}
