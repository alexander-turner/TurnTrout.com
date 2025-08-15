import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import { transports, format, createLogger } from "winston"
import DailyRotateFile from "winston-daily-rotate-file"

// For CWD
export const findGitRoot = () => {
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

// Create a logger which has TTL of 7 days and rotates daily
export const createWinstonLogger = (logName: string) => {
  return createLogger({
    format: format.combine(format.timestamp({ format: timezoneFormat }), format.prettyPrint()),

    transports: [
      new transports.DailyRotateFile({
        filename: path.join(logDir, `${logName}.log`),
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "7d", // Keep logs for 7 days using the correct 'd' suffix
        auditFile: path.join(logDir, `${logName}-audit.json`), // Track rotated files
        frequency: "daily",
      }),
    ],
  })
}
