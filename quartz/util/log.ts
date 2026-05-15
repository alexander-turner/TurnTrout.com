import type Transport from "winston-transport"

import gitRoot from "find-git-root"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { transports, format, createLogger } from "winston"
import DailyRotateFile from "winston-daily-rotate-file"

import type { Argv } from "./ctx"

export type LogLevel = NonNullable<Argv["logLevel"]>

let logLevel: LogLevel = "info"

export function getLogLevel(): LogLevel {
  return logLevel
}

const createdLoggers: ReturnType<typeof createLogger>[] = []

export function setLogLevelFromArgv(argv: Partial<Argv> | undefined): void {
  const lvl = argv?.logLevel
  if (lvl) {
    logLevel = lvl
    for (const logger of createdLoggers) {
      logger.level = lvl
    }
  }
}

/**
 * Finds the root directory of the current Git repository.
 *
 * Wraps the `find-git-root` package, which returns the `.git` directory; we
 * return its parent so callers receive the working-tree root.
 */
export const findGitRoot = (): string => {
  return path.dirname(gitRoot(fileURLToPath(import.meta.url)))
}

const logDir = path.join(findGitRoot(), ".logs")

// `createWinstonLogger` ensures `logDir` exists before instantiating a
// transport. We deliberately do NOT create it at module load: that turns
// every `import` into a filesystem write and breaks tests in sandboxes that
// mock the git-root to a non-writable path.

const timezoneFormat = new Date().toLocaleString("en-US", {
  timeZone: "America/Los_Angeles",
  timeZoneName: "short",
})

// winston-daily-rotate-file extends winston.transports; attach it.
transports.DailyRotateFile = DailyRotateFile

/**
 * Creates a Winston logger with daily rotation and a 7-day retention policy.
 */
export const createWinstonLogger = (name: string, level: string = getLogLevel()) => {
  // Ensure log directory exists (safety check)
  // istanbul ignore if
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }

  const loggerTransports: Transport[] = [
    new transports.DailyRotateFile({
      filename: path.join(logDir, `${name}.log`),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "7d",
      auditFile: path.join(logDir, `${name}-audit.json`),
      frequency: "daily",
    }),
  ]

  // Add console transport in CI environments so logs appear in GitHub Actions.
  // Skip when running under Jest (JEST_WORKER_ID is set per worker): test
  // output captures stderr/stdout and prints expected warnings as noise.
  // Only log warnings and above to reduce verbosity.
  // istanbul ignore if
  if (process.env.CI === "true" && !process.env.JEST_WORKER_ID) {
    loggerTransports.push(
      new transports.Console({
        level: "warn",
        stderrLevels: ["error", "warn", "info", "http", "verbose", "debug", "silly"],
        format: format.combine(
          format.colorize(),
          format.simple(),
          format.printf(({ level, message }) => `[${name}] ${level}: ${message}`),
        ),
      }),
    )
  }

  const logger = createLogger({
    level,
    format: format.combine(format.timestamp({ format: timezoneFormat }), format.prettyPrint()),
    transports: loggerTransports,
  })

  // Track this logger so we can update its level later if needed
  createdLoggers.push(logger)

  return logger
}
