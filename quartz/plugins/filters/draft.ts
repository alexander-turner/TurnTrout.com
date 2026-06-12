import { type QuartzFilterPlugin } from "../types"

/** A file is a draft when it lives under a `drafts/` directory but is not a template. */
export function isDraftPath(filePath: string): boolean {
  return filePath.includes("drafts/") && !filePath.includes("templates/")
}

export const RemoveDrafts: QuartzFilterPlugin = () => ({
  name: "RemoveDrafts",
  shouldPublish(_ctx, [, vfile]) {
    // Use data.filePath which survives worker thread serialization.
    // Falls back to empty string if path is unknown — defaults to "publish".
    const filePath = vfile.data.filePath ?? vfile.path ?? ""
    return !isDraftPath(filePath)
  },
})
