import { type QuartzFilterPlugin } from "../types"

export const RemoveDrafts: QuartzFilterPlugin = () => ({
  name: "RemoveDrafts",
  shouldPublish(_ctx, [, vfile]) {
    // Use data.filePath which survives worker thread serialization.
    // Falls back to empty string if path is unknown — defaults to "publish".
    const filePath = vfile.data.filePath ?? vfile.path ?? ""
    // Match whole path segments so "old-drafts/" / "drafts.md" aren't treated
    // as the "drafts" folder, and templates publish even inside drafts/.
    const segments = filePath.split("/")
    return !segments.includes("drafts") || segments.includes("templates")
  },
})
