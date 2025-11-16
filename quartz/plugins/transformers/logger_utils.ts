import type TransportStream from "winston-transport"

import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import { transports, format, createLogger } from "winston"
import DailyRotateFile from "winston-daily-rotate-file"

/**
 * Finds the root directory of the current Git repository.
 */
export const findGitRoot = (): string | null => {
  try {
    return execSync("git rev-parse --show-toplevel").toString().trim()
  } catch (error) {
    console.error(`Error finding Git root: ${error}`)
    return null
  }
}
const gitRoot = findGitRoot()

if (!gitRoot) {
  throw new Error("Git root not found.")
}
const logDir = path.join(gitRoot, ".logs")

// Create the log directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true }) // 'recursive: true' creates parent folders if needed
}

const timezoneFormat = new Date().toLocaleString("en-US", {
  timeZone: "America/Los_Angeles", // Use the correct IANA time zone name
  timeZoneName: "short", // Include the time zone abbreviation
})
transports.DailyRotateFile = DailyRotateFile

/**
 * Creates a Winston logger with daily rotation and a 7-day retention policy.
 */
export const createWinstonLogger = (logName: string) => {
  const loggerTransports: TransportStream[] = [
    new transports.DailyRotateFile({
      filename: path.join(logDir, `${logName}.log`),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "7d", // Keep logs for 7 days using the correct 'd' suffix
      auditFile: path.join(logDir, `${logName}-audit.json`), // Track rotated files
      frequency: "daily",
    }),
  ]

  // Add console transport in CI environments so logs appear in GitHub Actions
  // Only log warnings and above to reduce verbosity
  if (process.env.CI === "true") {
    loggerTransports.push(
      new transports.Console({
        level: "warn",
        format: format.combine(
          format.colorize(),
          format.simple(),
          format.printf(({ level, message }) => `[${logName}] ${level}: ${message}`),
        ),
      }),
    )
  }

  return createLogger({
    format: format.combine(format.timestamp({ format: timezoneFormat }), format.prettyPrint()),
    transports: loggerTransports,
  })
}
