import type { QuartzTransformerPlugin } from "../types"

export type MaybeDate = undefined | string | number

// Match a day-only "YYYY-MM-DD" string to parse as local midnight.
// Without this, JS parses such strings as UTC midnight, causing display dates
// to shift back a day in timezones behind UTC.
const DAY_ONLY_DATE_RE = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/

export function coerceDate(fp: string, d: MaybeDate): Date {
  let parsedDate: Date
  if (typeof d === "string") {
    const match = DAY_ONLY_DATE_RE.exec(d)
    if (match?.groups) {
      const { year, month, day } = match.groups
      parsedDate = new Date(Number(year), Number(month) - 1, Number(day))
    } else {
      parsedDate = new Date(d)
    }
  } else {
    parsedDate = new Date(d as number)
  }
  const isInvalidDate = isNaN(parsedDate.getTime()) || parsedDate.getTime() === 0
  if (isInvalidDate && d !== undefined) {
    throw new Error(
      `Invalid date "${d}" in \`${fp}\`. Supported formats: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format`,
    )
  }
  return isInvalidDate ? new Date() : parsedDate
}

export const CreatedModifiedDate: QuartzTransformerPlugin = () => ({
  name: "CreatedModifiedDate",
  markdownPlugins() {
    return [
      () => (_tree, file) => {
        const fp = file.data.filePath || ""
        const published = file.data.frontmatter?.date_published as MaybeDate
        const modified = file.data.frontmatter?.date_updated as MaybeDate

        file.data.dates = {
          created: coerceDate(fp, published),
          modified: coerceDate(fp, modified),
          published: coerceDate(fp, published),
        }
      },
    ]
  },
})

declare module "vfile" {
  interface DataMap {
    dates: {
      created: Date
      modified: Date
      published: Date
    }
  }
}
