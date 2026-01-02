import type Transport from "winston-transport"

import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import { transports, format, createLogger } from "winston"
import DailyRotateFile from "winston-daily-rotate-file"

import type { Argv } from "./ctx"

export type LogLevel = NonNullable<Argv["logLevel"]>

export let logLevel: LogLevel = "info"

export function setLogLevelFromArgv(argv: Partial<Argv> | undefined): void {
  const lvl = argv?.logLevel
  if (lvl === "error" || lvl === "warn" || lvl === "info" || lvl === "debug") {
    logLevel = lvl
  }
}

/**
 * Finds the root directory of the current Git repository.
 */
export const findGitRoot = (): string | null => {
  return execSync("git rev-parse --show-toplevel").toString().trim()
}

const gitRoot = findGitRoot()

if (!gitRoot) {
  throw new Error("Git root not found.")
}

const logDir = path.join(gitRoot, ".logs")

// Create the log directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

const timezoneFormat = new Date().toLocaleString("en-US", {
  timeZone: "America/Los_Angeles",
  timeZoneName: "short",
})

// winston-daily-rotate-file extends winston.transports; attach it.
transports.DailyRotateFile = DailyRotateFile

/**
 * Creates a Winston logger with daily rotation and a 7-day retention policy.
 */
export const createWinstonLogger = (name: string, level: string = logLevel) => {
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

  // Add console transport in CI environments so logs appear in GitHub Actions
  // Skip in test environments to avoid setImmediate issues
  // Only log warnings and above to reduce verbosity
  // istanbul ignore if
  if (process.env.CI === "true") {
    loggerTransports.push(
      new transports.Console({
        level: "info",
        format: format.combine(
          format.colorize(),
          format.simple(),
          format.printf(({ level, message }) => `[${name}] ${level}: ${message}`),
        ),
      }),
    )
  }

  return createLogger({
    level,
    format: format.combine(format.timestamp({ format: timezoneFormat }), format.prettyPrint()),
    transports: loggerTransports,
  })
}
