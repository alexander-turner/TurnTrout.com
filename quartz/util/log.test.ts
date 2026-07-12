import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals"

const timestampFormatPattern = /^\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} [AP]M/

// All mocks use `jest.unstable_mockModule` because log.ts loads its
// dependencies via ESM-style default imports inside `await import("./log")`.
// `jest.mock` is unreliable in that combination on Node 22 CI runners
// (the `fs` mock silently slips through and the real `mkdirSync('/repo/.logs')`
// fires with EACCES).

// Constructor mock for winston-daily-rotate-file (the imported default).
// Captured at module scope so tests can inspect `.mock.calls` directly,
// without going through `jest.requireMock` (which is CJS-only).
const mockDailyRotateFileCtor: jest.Mock<
  (opts: Record<string, unknown>) => Record<string, unknown>
> = jest.fn(() => ({}))
const mockDailyRotateFile = jest.fn()
const mockConsoleTransport = jest.fn()
const mockLoggerInstance = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  level: "info",
}
const mockCreateLogger = jest.fn(() => mockLoggerInstance)

let capturedPrintfFormatter: ((info: { level: string; message: string }) => string) | null = null
const mockTimestamp = jest.fn((opts: { format: unknown }) => opts)

jest.unstable_mockModule("winston-daily-rotate-file", () => ({
  __esModule: true,
  default: mockDailyRotateFileCtor,
}))

jest.unstable_mockModule("winston", () => ({
  __esModule: true,
  transports: {
    DailyRotateFile: mockDailyRotateFile,
    Console: mockConsoleTransport,
  },
  createLogger: mockCreateLogger,
  format: {
    combine: jest.fn((...args) => args),
    timestamp: mockTimestamp,
    prettyPrint: jest.fn(() => "prettyPrint"),
    colorize: jest.fn(() => "colorize"),
    simple: jest.fn(() => "simple"),
    printf: jest.fn((fn: unknown) => {
      capturedPrintfFormatter = fn as (info: { level: string; message: string }) => string
      return fn
    }),
  },
}))

// find-git-root returns the path to the `.git` directory; log.ts wraps it
// with path.dirname() so the working-tree root is what callers see.
jest.unstable_mockModule("find-git-root", () => ({
  __esModule: true,
  default: jest.fn(() => "/repo/.git"),
}))

// fs is mocked so the per-call `mkdirSync` inside createWinstonLogger does
// not try to write under the mocked git root.
const fsMock = {
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}
jest.unstable_mockModule("fs", () => ({
  __esModule: true,
  default: fsMock,
  ...fsMock,
}))

// Import after mocks are set up
const { createWinstonLogger, setLogLevelFromArgv } = await import("./log")

describe("util/log", () => {
  const originalCi = process.env.CI
  const originalWorkerId = process.env.JEST_WORKER_ID

  beforeEach(() => {
    jest.clearAllMocks()
    capturedPrintfFormatter = null
    mockLoggerInstance.level = "info"
    delete process.env.CI
    delete process.env.JEST_WORKER_ID
  })

  afterAll(() => {
    if (originalCi === undefined) delete process.env.CI
    else process.env.CI = originalCi
    if (originalWorkerId === undefined) delete process.env.JEST_WORKER_ID
    else process.env.JEST_WORKER_ID = originalWorkerId
  })

  it("should create a logger with a configured DailyRotateFile transport", () => {
    createWinstonLogger("test-logger")

    expect(mockCreateLogger).toHaveBeenCalled()
    // The rotate-file transport is instantiated via `new transports.DailyRotateFile(...)`;
    // in log.ts that constructor is assigned to the imported DailyRotateFile mock.
    const callArgs = mockDailyRotateFileCtor.mock.calls[0][0] as Record<string, unknown>
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

  it("passes a timestamp formatter function that renders the current Los Angeles time", () => {
    createWinstonLogger("test-logger")

    const { format: timestampFormat } = mockTimestamp.mock.calls[0][0] as {
      format: () => string
    }
    expect(typeof timestampFormat).toBe("function")
    expect(timestampFormat()).toMatch(timestampFormatPattern)
  })

  it.each([
    ["CI unset and running under Jest", undefined, "1"],
    ["CI=true and running under Jest", "true", "1"],
  ])("should not add Console transport when %s", (_label, ci, workerId) => {
    if (ci !== undefined) process.env.CI = ci
    if (workerId !== undefined) process.env.JEST_WORKER_ID = workerId

    createWinstonLogger("test-logger")

    expect(mockConsoleTransport).not.toHaveBeenCalled()
  })

  describe("when not under Jest", () => {
    it("should add Console transport at warn level in CI", () => {
      process.env.CI = "true"
      createWinstonLogger("test-logger")

      expect(mockConsoleTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "warn",
          stderrLevels: ["error", "warn", "info", "http", "verbose", "debug", "silly"],
        }),
      )
    })

    it("should add Console transport at warn level outside CI", () => {
      createWinstonLogger("test-logger")

      expect(mockConsoleTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "warn",
          stderrLevels: ["error", "warn", "info", "http", "verbose", "debug", "silly"],
        }),
      )
    })

    it("should format console messages with logger name prefix", () => {
      createWinstonLogger("my-logger")

      expect(capturedPrintfFormatter).not.toBeNull()
      const formatted = capturedPrintfFormatter?.({ level: "info", message: "test message" })
      expect(formatted).toBe("[my-logger] info: test message")
    })
  })

  it("should create different loggers for different names", () => {
    createWinstonLogger("logger1")
    createWinstonLogger("logger2")

    const calls = mockDailyRotateFileCtor.mock.calls
    expect((calls[0][0] as Record<string, unknown>).filename).toContain("logger1.log")
    expect((calls[1][0] as Record<string, unknown>).filename).toContain("logger2.log")
  })

  it("should set logLevel from argv", async () => {
    const logMod = await import("./log")

    logMod.setLogLevelFromArgv({ logLevel: "debug" } as unknown as { logLevel: "debug" })
    expect(logMod.getLogLevel()).toBe("debug")
  })

  it("should update existing logger levels when setLogLevelFromArgv is called", () => {
    const logger = createWinstonLogger("test-logger")
    expect(logger.level).toBe("info")

    setLogLevelFromArgv({ logLevel: "debug" } as unknown as { logLevel: "debug" })
    expect(logger.level).toBe("debug")
  })
})
