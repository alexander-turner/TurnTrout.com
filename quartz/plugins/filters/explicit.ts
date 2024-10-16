import { QuartzFilterPlugin } from "../types"

export const ExplicitPublish: QuartzFilterPlugin = () => ({
  name: "ExplicitPublish",
  shouldPublish(_ctx, [, vfile]) {
    return vfile.data?.frontmatter?.publish ?? false
  },
})
