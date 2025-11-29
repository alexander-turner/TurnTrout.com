import { type QuartzFilterPlugin } from "../types"

export const RemoveDrafts: QuartzFilterPlugin = () => ({
  name: "RemoveDrafts",
  shouldPublish(_ctx, [, vfile]) {
    return !vfile.path.includes("drafts/") || vfile.path.includes("templates/")
  },
})
