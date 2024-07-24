import winston from "winston"
import { execSync } from "child_process"
import { format } from "winston"
import path from "path"
import DailyRotateFile from "winston-daily-rotate-file"
import fs from "fs"

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

const timezoned = () => {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles", // Use the correct IANA time zone name
    timeZoneName: "short", // Include the time zone abbreviation
  })
}
winston.transports.DailyRotateFile = DailyRotateFile

export const createLogger = (logName: string) => {
  return winston.createLogger({
    format: format.combine(format.timestamp({ format: timezoned }), format.prettyPrint()),

    transports: [
      new winston.transports.DailyRotateFile({
        filename: path.join(logDir, logName + ".log"),
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "14d",
      }),
    ],
  })
}
