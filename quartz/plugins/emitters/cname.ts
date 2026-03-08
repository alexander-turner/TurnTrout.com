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
  // eslint-disable-next-line require-await -- interface requires Promise return
  async getDependencyGraph() {
    // skipcq: JS-0116
    return new DepGraph<FilePath>()
  },
  // eslint-disable-next-line require-await -- interface requires Promise return
  async emit({ argv, cfg }): Promise<FilePath[]> {
    // skipcq: JS-0116
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
