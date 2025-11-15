/**
 * @jest-environment node
 */
import { jest, expect, it, describe, beforeEach, afterEach, beforeAll } from "@jest/globals"

const mockExecSync = jest.fn(() => Buffer.from("/mock/git/root\n"))
jest.unstable_mockModule("child_process", () => ({
  execSync: mockExecSync,
}))

const mockExistsSync = jest.fn(() => false)
const mockMkdirSync = jest.fn()
const mockWriteFileSync = jest.fn()
const mockReadFileSync = jest.fn(() => "")

jest.unstable_mockModule("fs", () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
    readFileSync: mockReadFileSync,
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
  readFileSync: mockReadFileSync,
}))

const mockDailyRotateFile = jest.fn()
jest.unstable_mockModule("winston-daily-rotate-file", () => ({
  default: mockDailyRotateFile,
}))

const mockConsoleTransport = jest.fn()
const mockCreateLogger = jest.fn(() => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedPrintfFormatter: any = null

jest.unstable_mockModule("winston", () => ({
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
    printf: jest.fn((fn) => {
      capturedPrintfFormatter = fn
      return fn
    }),
  },
}))

describe("logger_utils", () => {
  let loggerUtils: typeof import("./logger_utils")

  beforeAll(async () => {
    loggerUtils = await import("./logger_utils")
  })

  describe("module initialization", () => {
    it("should throw error when git root is not found", async () => {
      // Reset modules to test initialization failure
      jest.resetModules()

      // Mock execSync to return null
      const failingExecSync = jest.fn(() => {
        throw new Error("Not a git repository")
      })

      jest.unstable_mockModule("child_process", () => ({
        execSync: failingExecSync,
      }))

      // Mock console.error to suppress error output in test
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined)

      // Importing should throw because findGitRoot returns null
      await expect(async () => {
        await import("./logger_utils?t=" + Date.now())
      }).rejects.toThrow("Git root not found.")

      consoleErrorSpy.mockRestore()

      // Restore original mocks
      jest.unstable_mockModule("child_process", () => ({
        execSync: mockExecSync,
      }))
    })
  })

  describe("findGitRoot", () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it("should return the git root directory when successful", () => {
      const mockRoot = "/path/to/repo"
      mockExecSync.mockReturnValue(Buffer.from(`${mockRoot}\n`))

      const result = loggerUtils.findGitRoot()

      expect(result).toBe(mockRoot)
      expect(mockExecSync).toHaveBeenCalledWith("git rev-parse --show-toplevel")
    })

    it("should return null when git command fails", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Not a git repository")
      })

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined)
      const result = loggerUtils.findGitRoot()

      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it("should trim whitespace from git output", () => {
      const mockRoot = "/path/to/repo"
      mockExecSync.mockReturnValue(Buffer.from(`  ${mockRoot}  \n\t`))

      const result = loggerUtils.findGitRoot()

      expect(result).toBe(mockRoot)
    })
  })

  describe("createWinstonLogger", () => {
    const originalEnv = process.env.CI

    beforeEach(() => {
      jest.clearAllMocks()
      delete process.env.CI
      mockExistsSync.mockReturnValue(true)
      mockMkdirSync.mockImplementation(() => undefined)
    })

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.CI = originalEnv
      } else {
        delete process.env.CI
      }
    })

    it("should create a logger with DailyRotateFile transport", () => {
      loggerUtils.createWinstonLogger("test-logger")

      expect(mockDailyRotateFile).toHaveBeenCalled()
      expect(mockCreateLogger).toHaveBeenCalled()
    })

    it("should configure DailyRotateFile with correct options", () => {
      loggerUtils.createWinstonLogger("test-logger")

      const callArgs = mockDailyRotateFile.mock.calls[0][0] as Record<string, unknown>
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

    it("should not add Console transport when not in CI", () => {
      delete process.env.CI

      loggerUtils.createWinstonLogger("test-logger")

      expect(mockConsoleTransport).not.toHaveBeenCalled()
    })

    it("should add Console transport when CI=true", () => {
      process.env.CI = "true"

      loggerUtils.createWinstonLogger("test-logger")

      expect(mockConsoleTransport).toHaveBeenCalled()
    })

    it("should configure Console transport with custom format in CI", () => {
      process.env.CI = "true"

      loggerUtils.createWinstonLogger("test-logger")

      const callArgs = mockConsoleTransport.mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.format).toBeDefined()
    })

    it("should format console messages with logger name prefix in CI", () => {
      process.env.CI = "true"
      capturedPrintfFormatter = null

      loggerUtils.createWinstonLogger("my-logger")

      expect(capturedPrintfFormatter).not.toBeNull()
      const formatted = capturedPrintfFormatter({ level: "info", message: "test message" })
      expect(formatted).toBe("[my-logger] info: test message")
    })

    it("should create different loggers for different names", () => {
      loggerUtils.createWinstonLogger("logger1")
      loggerUtils.createWinstonLogger("logger2")

      const calls = mockDailyRotateFile.mock.calls
      expect((calls[0][0] as Record<string, unknown>).filename).toContain("logger1.log")
      expect((calls[1][0] as Record<string, unknown>).filename).toContain("logger2.log")
    })
  })
})
