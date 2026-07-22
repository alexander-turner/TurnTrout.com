// Visual baselines are named by browser engine (Playwright's `project.name`),
// not by OS, so the single global R2 baseline set is collision-free only while
// each engine renders on exactly one OS: WebKit on macOS, Chromium and Firefox
// in the Linux container. This guard enforces that mapping on CI test shards,
// so a future config change that schedules (say) WebKit on Linux can't silently
// overwrite the macOS WebKit baselines with same-named Linux captures.

export type Engine = "chromium" | "firefox" | "webkit"

// The OS (`process.platform`) each engine is allowed to render baselines on.
export const ENGINE_TO_PLATFORM: Readonly<Record<Engine, NodeJS.Platform>> = {
  chromium: "linux",
  firefox: "linux",
  webkit: "darwin",
}

/**
 * Throws if any engine is scheduled to run on an OS other than the one its
 * baselines belong to.
 *
 * @param engines - Engines this process will run (derived from the per-OS
 *   `PLAYWRIGHT_BROWSERS` selection).
 * @param platform - The runner's `process.platform`.
 * @param enforce - True only for a real CI test shard (`CI` set and a
 *   `PLAYWRIGHT_BROWSERS` selection present). Off it — a local run, or the
 *   report-merge job that loads the config without running tests — this is a
 *   no-op, since no baselines are written.
 */
export function assertEngineOsMapping(
  engines: readonly Engine[],
  platform: NodeJS.Platform,
  enforce: boolean,
): void {
  if (!enforce) return
  for (const engine of engines) {
    const expectedPlatform = ENGINE_TO_PLATFORM[engine]
    if (platform !== expectedPlatform) {
      throw new Error(
        `Visual baseline safety: engine "${engine}" must render on platform ` +
          `"${expectedPlatform}" because baselines are named by engine, not OS. ` +
          `This CI shard reports platform "${platform}", so running "${engine}" here ` +
          `would overwrite the "${expectedPlatform}" baselines with same-named ` +
          `captures. Add an OS token to the baseline name (getScreenshotName / ` +
          `snapshotPathTemplate) before running an engine on a second OS.`,
      )
    }
  }
}
