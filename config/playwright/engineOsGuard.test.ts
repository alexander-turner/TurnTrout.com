import { describe, expect, it } from "@jest/globals"

import { assertEngineOsMapping, type Engine, ENGINE_TO_PLATFORM } from "./engineOsGuard"

describe("assertEngineOsMapping", () => {
  it("is a no-op when enforcement is off, even for a mismatched engine/OS pair", () => {
    expect(() => assertEngineOsMapping(["webkit"], "linux", false)).not.toThrow()
  })

  it.each([
    ["chromium", "linux"],
    ["firefox", "linux"],
    ["webkit", "darwin"],
  ] as const)("allows %s on its expected platform %s", (engine, platform) => {
    expect(() => assertEngineOsMapping([engine], platform, true)).not.toThrow()
  })

  it("allows the full Linux engine set on Linux", () => {
    expect(() => assertEngineOsMapping(["chromium", "firefox"], "linux", true)).not.toThrow()
  })

  it.each([
    ["webkit", "linux"],
    ["chromium", "darwin"],
    ["firefox", "darwin"],
  ] as const)("throws for %s scheduled on %s", (engine, platform) => {
    expect(() => assertEngineOsMapping([engine], platform, true)).toThrow(
      new RegExp(`engine "${engine}" must render on platform "${ENGINE_TO_PLATFORM[engine]}"`),
    )
  })

  it("throws on the first mismatched engine in a mixed list", () => {
    const engines: Engine[] = ["chromium", "webkit"]
    expect(() => assertEngineOsMapping(engines, "linux", true)).toThrow(/engine "webkit"/)
  })
})
