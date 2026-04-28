import { Mutex } from "async-mutex"
import { install } from "source-map-support"

import type { Argv } from "./util/ctx"

import buildQuartz from "./build/full-build"
import { options } from "./util/sourcemap"
import { trace } from "./util/trace"

install(options)

export default async (argv: Argv, mut: Mutex, clientRefresh: () => void) => {
  try {
    return await buildQuartz(argv, mut, clientRefresh)
  } catch (err) {
    trace("\nExiting Quartz due to a fatal error", err)
    return () => {
      // No cleanup needed on fatal error (process will exit)
    }
  }
}
