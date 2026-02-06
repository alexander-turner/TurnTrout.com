import { type QuartzFilterPlugin } from "../types"

export const RemoveDrafts: QuartzFilterPlugin = () => ({
  name: "RemoveDrafts",
  shouldPublish(_ctx, [, vfile]) {
    // Use data.filePath which survives worker thread serialization
    const filePath = vfile.data.filePath ?? vfile.path ?? ""
    return !filePath.includes("drafts/") || filePath.includes("templates/")
  },
})
