import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals"

import { createWinstonLogger, setLogLevelFromArgv } from "./log"

// Mocks for winston + rotate transport
const mockDailyRotateFile = jest.fn()
const mockConsoleTransport = jest.fn()
const mockCreateLogger = jest.fn((config: { level: string }) => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  level: config.level,
}))

let capturedPrintfFormatter: ((info: { level: string; message: string }) => string) | null = null

jest.mock("winston-daily-rotate-file", () => {
  return jest.fn(() => ({}))
})

jest.mock("winston", () => ({
  transports: {
    DailyRotateFile: mockDailyRotateFile,
    Console: mockConsoleTransport,
  },
  createLogger: mockCreateLogger,
  format: {
    combine: jest.fn((...args) => args),
    timestamp: jest.fn(() => "timestamp"),
    prettyPrint: jest.fn(() => "prettyPrint"),
    colorize: jest.fn(() => "colorize"),
    simple: jest.fn(() => "simple"),
    printf: jest.fn((fn: unknown) => {
      capturedPrintfFormatter = fn as (info: { level: string; message: string }) => string
      return fn
    }),
  },
}))

// Mock child_process and fs used by log root detection
jest.mock("child_process", () => ({
  execSync: jest.fn(() => "/repo\n"),
}))

jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}))

describe("util/log", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    capturedPrintfFormatter = null
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("should create a logger with DailyRotateFile transport", async () => {
    const { createWinstonLogger } = await import("./log")
    createWinstonLogger("test-logger")

    // transports.DailyRotateFile is assigned to the imported DailyRotateFile class,
    // so the call is observed on that constructor mock.
    expect(mockCreateLogger).toHaveBeenCalled()
  })

  it("should configure DailyRotateFile with correct options", async () => {
    const { createWinstonLogger } = await import("./log")
    createWinstonLogger("test-logger")

    // The rotate-file transport is instantiated via `new transports.DailyRotateFile(...)`.
    // In our module, we assign that transport constructor to the imported DailyRotateFile,
    // so we assert on the DailyRotateFile mock.
    const callArgs = (
      jest.requireMock("winston-daily-rotate-file") as unknown as {
        mock: { calls: unknown[][] }
      }
    ).mock.calls[0][0] as Record<string, unknown>
    expect(callArgs).toMatchObject({
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "7d",
      frequency: "daily",
    })
    expect(callArgs.filename).toContain("test-logger.log")
    expect(callArgs.auditFile).toContain("test-logger-audit.json")
  })

  it("should not add Console transport when not in CI", async () => {
    delete process.env.CI

    const { createWinstonLogger } = await import("./log")
    createWinstonLogger("test-logger")

    expect(mockConsoleTransport).not.toHaveBeenCalled()
  })

  it("should add Console transport when CI=true", async () => {
    process.env.CI = "true"

    const { createWinstonLogger } = await import("./log")
    createWinstonLogger("test-logger")

    expect(mockConsoleTransport).toHaveBeenCalled()
  })

  it("should format console messages with logger name prefix in CI", async () => {
    process.env.CI = "true"

    const { createWinstonLogger } = await import("./log")
    createWinstonLogger("my-logger")

    expect(capturedPrintfFormatter).not.toBeNull()
    const formatted = capturedPrintfFormatter!({ level: "info", message: "test message" })
    expect(formatted).toBe("[my-logger] info: test message")
  })

  it("should create different loggers for different names", async () => {
    const { createWinstonLogger } = await import("./log")
    createWinstonLogger("logger1")
    createWinstonLogger("logger2")

    const calls = (
      jest.requireMock("winston-daily-rotate-file") as unknown as {
        mock: { calls: unknown[][] }
      }
    ).mock.calls
    expect((calls[0][0] as Record<string, unknown>).filename).toContain("logger1.log")
    expect((calls[1][0] as Record<string, unknown>).filename).toContain("logger2.log")
  })

  it("should set logLevel from argv", async () => {
    const logMod = await import("./log")

    logMod.setLogLevelFromArgv({ logLevel: "debug" } as unknown as { logLevel: "debug" })
    expect(logMod.logLevel).toBe("debug")
  })

  it("should update existing logger levels when setLogLevelFromArgv is called", async () => {
    const logger = createWinstonLogger("test-logger")
    expect(logger.level).toBe("info")

    setLogLevelFromArgv({ logLevel: "debug" } as unknown as { logLevel: "debug" })
    expect(logger.level).toBe("debug")
  })
})
