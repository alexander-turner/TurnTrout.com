import type { QuartzTransformerPlugin } from "../types"

export type MaybeDate = undefined | string | number

export function coerceDate(fp: string, d: MaybeDate): Date {
  const parsedDate = typeof d === "number" ? new Date(d) : new Date(d as string)
  const isInvalidDate = isNaN(parsedDate.getTime()) || parsedDate.getTime() === 0
  if (isInvalidDate && d !== undefined) {
    console.log(
      `\nWarning: found invalid date "${d}" in \`${fp}\`. Supported formats: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format`,
    )
  }
  return isInvalidDate ? new Date() : parsedDate
}

export const CreatedModifiedDate: QuartzTransformerPlugin = () => ({
  name: "CreatedModifiedDate",
  markdownPlugins() {
    return [
      () => async (_tree, file) => {
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
