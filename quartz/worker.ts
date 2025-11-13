import { install } from "source-map-support";

import { options } from "./util/sourcemap";
install(options);

import type { Argv, BuildCtx } from "./util/ctx";
import type { FilePath, FullSlug } from "./util/path";

import cfg from "../config/quartz/quartz.config";
import { createFileParser, createProcessor } from "./processors/parse";

/**
 * Parses a list of files into content that can be processed by emitters.
 *
 * This function is only ever called from a worker thread.
 */
export async function parseFiles(
  argv: Argv,
  fps: FilePath[],
  allSlugs: FullSlug[],
) {
  const ctx: BuildCtx = {
    cfg,
    argv,
    allSlugs,
  };
  const processor = createProcessor(ctx);
  const parse = createFileParser(ctx, fps);
  return parse(processor);
}
