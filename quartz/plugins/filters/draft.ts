import { type QuartzFilterPlugin } from "../types"

/** A file is a draft when it lives under a `drafts/` directory but is not a template. */
export function isDraftPath(filePath: string): boolean {
  // Match `drafts` as a whole path segment so siblings like `old-drafts/` or
  // `drafts-archive/` aren't misclassified as drafts.
  const segments = filePath.split("/")
  return segments.includes("drafts") && !segments.includes("templates")
}

export const RemoveDrafts: QuartzFilterPlugin = () => ({
  name: "RemoveDrafts",
  shouldPublish(ctx, [, vfile]) {
    // Drafts are previewed locally: keep them when running the dev server.
    if (ctx.argv?.serve) {
      return true
    }
    // Use data.filePath which survives worker thread serialization.
    // Falls back to empty string if path is unknown — defaults to "publish".
    const filePath = vfile.data.filePath ?? vfile.path ?? ""
    return !isDraftPath(filePath)
  },
})
