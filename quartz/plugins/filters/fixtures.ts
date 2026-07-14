import { type QuartzFilterPlugin } from "../types"

/**
 * Excludes pages under `fixtures/` from the build unless
 * `INCLUDE_FIXTURES=true` is set. Fixture pages back Playwright visual
 * regression tests and must not ship to readers — keeping them out at the
 * filter layer drops the HTML, the search index entries, the sitemap, and
 * the RSS feed in one pass.
 */
export const RemoveFixtures: QuartzFilterPlugin = () => ({
  name: "RemoveFixtures",
  shouldPublish(_ctx, [, vfile]) {
    if (process.env.INCLUDE_FIXTURES === "true") return true
    const filePath = vfile.data.filePath ?? vfile.path ?? ""
    return !filePath.includes("fixtures/")
  },
})
