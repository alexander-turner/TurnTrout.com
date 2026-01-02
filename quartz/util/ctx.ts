import type { QuartzConfig } from "../cfg"
import type { FullSlug } from "./path"

export interface Argv {
  directory: string
  verbose: boolean
  output: string
  serve: boolean
  fastRebuild: boolean
  port: number
  wsPort: number
  remoteDevHost?: string
  concurrency?: number
  skipCriticalCSS?: boolean
  offline?: boolean
  logLevel?: "error" | "warn" | "info" | "debug"
}

export interface BuildCtx {
  argv: Argv
  cfg: QuartzConfig
  allSlugs: FullSlug[]
}
