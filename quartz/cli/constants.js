import process from "node:process"
import path from "path"

/**
 * All constants relating to helpers or handlers
 */
export const ORIGIN_NAME = "origin"
export const UPSTREAM_NAME = "upstream"
export const QUARTZ_SOURCE_BRANCH = "v4"
export const cwd = process.cwd()
export const cacheDir = path.join(cwd, ".quartz-cache")
export const cacheFile = "./quartz/.quartz-cache/transpiled-build.mjs"
export const fp = "./quartz/build.ts"
export const version = "1.3"
export const contentCacheFolder = path.join(cacheDir, "content-cache")
