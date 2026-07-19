import { type QuartzFilterPlugin } from "../types"

/**
 * A file is a partial when it lives under a `partials/` directory. Match
 * `partials` as a whole path segment so siblings like `old-partials/` aren't
 * misclassified.
 */
function isPartialPath(filePath: string): boolean {
  return filePath.split("/").includes("partials")
}

/**
 * Excludes pages under `partials/` from the build. Partials are content
 * fragments included into other pages (e.g. the `font-stats` table, the
 * `inversion-demo` figure) and must not ship as standalone routes — dropping
 * them at the filter layer removes the HTML, the search index entry, the
 * sitemap entry, the RSS entry, and the all-posts listing in one pass.
 */
export const RemovePartials: QuartzFilterPlugin = () => ({
  name: "RemovePartials",
  shouldPublish(_ctx, [, vfile]) {
    const filePath = vfile.data.filePath ?? vfile.path ?? ""
    return !isPartialPath(filePath)
  },
})
