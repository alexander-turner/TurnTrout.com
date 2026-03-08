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
  getDependencyGraph() {
    return Promise.resolve(new DepGraph<FilePath>())
  },
  emit({ argv, cfg }): Promise<FilePath[]> {
    if (!cfg.configuration.baseUrl) {
      console.warn(chalk.yellow("CNAME emitter requires `baseUrl` to be set in your configuration"))
      return Promise.resolve([])
    }
    const path = joinSegments(argv.output, "CNAME")
    const content = extractDomainFromBaseUrl(cfg.configuration.baseUrl)
    if (!content) {
      return Promise.resolve([])
    }
    fs.writeFileSync(path, content)
    return Promise.resolve([path] as FilePath[])
  },
})
