/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

const mockExecutablePath = jest.fn<() => string>()
const mockLaunch = jest.fn<(opts: Record<string, unknown>) => Promise<unknown>>()

jest.unstable_mockModule("playwright", () => ({
  chromium: { executablePath: mockExecutablePath },
}))
jest.unstable_mockModule("puppeteer", () => ({
  default: { launch: mockLaunch },
}))

import fs from "fs"

const originalEnv = process.env.PUPPETEER_EXECUTABLE_PATH

const restoreEnv = () => {
  if (originalEnv === undefined) {
    delete process.env.PUPPETEER_EXECUTABLE_PATH
  } else {
    process.env.PUPPETEER_EXECUTABLE_PATH = originalEnv
  }
}

describe("resolveChromeExecutablePath", () => {
  let resolveChromeExecutablePath: typeof import("./browser").resolveChromeExecutablePath

  beforeEach(async () => {
    ;({ resolveChromeExecutablePath } = await import("./browser"))
    mockExecutablePath.mockReset()
    delete process.env.PUPPETEER_EXECUTABLE_PATH
  })

  afterEach(() => {
    restoreEnv()
    jest.restoreAllMocks()
  })

  it("returns PUPPETEER_EXECUTABLE_PATH when set, without probing Playwright", () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = "/custom/chrome"
    expect(resolveChromeExecutablePath()).toBe("/custom/chrome")
    expect(mockExecutablePath).not.toHaveBeenCalled()
  })

  it("falls back to Playwright's Chromium when it exists on disk", () => {
    mockExecutablePath.mockReturnValue("/pw/chromium")
    jest.spyOn(fs, "existsSync").mockReturnValue(true)
    expect(resolveChromeExecutablePath()).toBe("/pw/chromium")
  })

  it("returns undefined when no browser is available", () => {
    mockExecutablePath.mockReturnValue("/pw/chromium")
    jest.spyOn(fs, "existsSync").mockReturnValue(false)
    expect(resolveChromeExecutablePath()).toBeUndefined()
  })
})

describe("launchCriticalCssBrowser", () => {
  let launchCriticalCssBrowser: typeof import("./browser").launchCriticalCssBrowser

  beforeEach(async () => {
    ;({ launchCriticalCssBrowser } = await import("./browser"))
    mockExecutablePath.mockReset()
    mockLaunch.mockReset()
    mockLaunch.mockResolvedValue({ browser: true })
    delete process.env.PUPPETEER_EXECUTABLE_PATH
  })

  afterEach(() => {
    restoreEnv()
    jest.restoreAllMocks()
  })

  it("launches with the resolved executablePath and hardened args", async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = "/custom/chrome"
    await launchCriticalCssBrowser()
    const opts = mockLaunch.mock.calls[0][0]
    expect(opts.executablePath).toBe("/custom/chrome")
    expect(opts.args).toContain("--no-sandbox")
    expect(opts.headless).toBe(true)
  })

  it("omits executablePath entirely when none resolves", async () => {
    mockExecutablePath.mockReturnValue("/pw/chromium")
    jest.spyOn(fs, "existsSync").mockReturnValue(false)
    await launchCriticalCssBrowser()
    const opts = mockLaunch.mock.calls[0][0]
    expect(opts).not.toHaveProperty("executablePath")
    expect(opts.args).toContain("--no-sandbox")
  })
})
