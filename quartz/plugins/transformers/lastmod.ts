import { Repository } from "@napi-rs/simple-git"
import chalk from "chalk"
import fs from "fs"
import path from "path"

import type { QuartzTransformerPlugin } from "../types"

export interface Options {
  priority: ("frontmatter" | "git" | "filesystem")[]
}

const defaultOptions: Options = {
  priority: ["frontmatter", "git", "filesystem"],
}

export function coerceDate(fp: string, d: MaybeDate): Date {
  const dt = typeof d === "number" ? new Date(d) : new Date(d as string)
  const invalidDate = isNaN(dt.getTime()) || dt.getTime() === 0
  if (invalidDate && d !== undefined) {
    console.log(
      `\nWarning: found invalid date "${d}" in \`${fp}\`. Supported formats: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format`,
    )
  }

  return invalidDate ? new Date() : dt
}

export type MaybeDate = undefined | string | number
type Frontmatter = Record<string, unknown>

/** Extract created date from frontmatter, checking standard field names */
function getCreatedFromFrontmatter(frontmatter: Frontmatter): MaybeDate {
  return (frontmatter.date as MaybeDate) || (frontmatter.date_published as MaybeDate)
}

/** Extract modified date from frontmatter, checking standard field names */
function getModifiedFromFrontmatter(frontmatter: Frontmatter): MaybeDate {
  return (
    (frontmatter.lastmod as MaybeDate) ||
    (frontmatter.updated as MaybeDate) ||
    (frontmatter["last-modified"] as MaybeDate) ||
    (frontmatter.date_updated as MaybeDate)
  )
}

/** Extract published date from frontmatter */
function getPublishedFromFrontmatter(frontmatter: Frontmatter): MaybeDate {
  return frontmatter.date_published as MaybeDate
}

export const CreatedModifiedDate: QuartzTransformerPlugin<Partial<Options> | undefined> = (
  userOpts,
) => {
  const opts = { ...defaultOptions, ...userOpts }
  return {
    name: "CreatedModifiedDate",
    markdownPlugins() {
      return [
        () => {
          let repo: Repository | undefined
          return async (_tree, file) => {
            let created: MaybeDate
            let modified: MaybeDate
            let published: MaybeDate

            const fp = file.data.filePath || ""
            const fullFp = path.isAbsolute(fp) ? fp : path.posix.join(file.cwd, fp)
            for (const source of opts.priority) {
              if (source === "filesystem") {
                const st = await fs.promises.stat(fullFp)
                // birthtimeMs returns 0 on Linux systems without birth time support
                if (st.birthtimeMs > 0) {
                  created ||= st.birthtimeMs
                }
                modified ||= st.mtimeMs
              } else if (source === "frontmatter" && file.data.frontmatter) {
                created ||= getCreatedFromFrontmatter(file.data.frontmatter)
                modified ||= getModifiedFromFrontmatter(file.data.frontmatter)
                published ||= getPublishedFromFrontmatter(file.data.frontmatter)
              } else if (source === "git") {
                if (!repo) {
                  // Get a reference to the main git repo.
                  // It's either the same as the workdir,
                  // or 1+ level higher in case of a submodule/subtree setup
                  repo = Repository.discover(file.cwd)
                }

                try {
                  modified ||= await repo.getFileLatestModifiedDateAsync(file.data.filePath || "")
                } catch {
                  console.log(
                    chalk.yellow(
                      `\nWarning: ${file.data.filePath} isn't yet tracked by git, last modification date is not available for this file`,
                    ),
                  )
                }
              }
            }

            file.data.dates = {
              created: coerceDate(fp, created),
              modified: coerceDate(fp, modified),
              published: coerceDate(fp, published),
            }
          }
        },
      ]
    },
  }
}

declare module "vfile" {
  interface DataMap {
    dates: {
      created: Date
      modified: Date
      published: Date
    }
  }
}
