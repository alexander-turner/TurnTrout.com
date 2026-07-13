import { type QuartzFilterPlugin } from "../types"

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
    return !filePath.includes("partials/")
  },
})
