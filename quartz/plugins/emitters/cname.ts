import chalk from "chalk"
import fs from "fs"

import DepGraph from "../../depgraph"
import { type FilePath, joinSegments } from "../../util/path"
import { type QuartzEmitterPlugin } from "../types"

export function extractDomainFromBaseUrl(baseUrl: string) {
  const url = new URL(`https://${baseUrl}`)
  return url.hostname
}

export const CNAME: QuartzEmitterPlugin = () => ({
  name: "CNAME",
  getQuartzComponents() {
    return []
  },
  async getDependencyGraph() {
    return new DepGraph<FilePath>()
  },
  async emit({ argv, cfg }): Promise<FilePath[]> {
    if (!cfg.configuration.baseUrl) {
      console.warn(chalk.yellow("CNAME emitter requires `baseUrl` to be set in your configuration"))
      return []
    }
    const path = joinSegments(argv.output, "CNAME")
    const content = extractDomainFromBaseUrl(cfg.configuration.baseUrl)
    if (!content) {
      return []
    }
    fs.writeFileSync(path, content)
    return [path] as FilePath[]
  },
})
