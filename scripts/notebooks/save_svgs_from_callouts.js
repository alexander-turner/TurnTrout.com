import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"

const TURNTROUT_DIR = "/Users/turntrout/Downloads/turntrout.com"
const CALLOUTS_FILE = `${TURNTROUT_DIR}/quartz/styles/callouts.scss`
const ICONS_DIR = `${TURNTROUT_DIR}/quartz/static/icons`

// Ensure icons directory exists
if (!existsSync(ICONS_DIR)) {
  mkdirSync(ICONS_DIR, { recursive: true })
}

// Read the callouts file
const content = readFileSync(CALLOUTS_FILE, "utf8")

// Regular expression to match SVG data URLs
const svgRegex =
  /--callout-icon-(?<iconName>\w+):\s*url\('data:image\/svg\+xml;(?<svgContent>.+?)\);/g

// Process each match
let match = svgRegex.exec(content)
while (match !== null) {
  const { iconName, svgContent } = match.groups

  // Decode the SVG content
  const decodedSvg = svgContent
    .replace(/\\"/g, '"') // Replace escaped quotes
    .replace(/\\n/g, "\n") // Replace escaped newlines

  // Save to file
  const filePath = join(ICONS_DIR, `${iconName}.svg`)
  writeFileSync(filePath, decodedSvg)
  console.log(`Saved ${iconName}.svg`)

  match = svgRegex.exec(content)
}

// Generate the new SCSS content
const newContent = content.replace(
  svgRegex,
  (_, iconName) => `--callout-icon-${iconName}: url('/static/icons/${iconName}.svg');`,
)

// Write the updated SCSS file
writeFileSync(`${CALLOUTS_FILE}.new`, newContent)
console.log(`\nUpdated SCSS file written to ${CALLOUTS_FILE}.new`)
console.log("Please review the changes before replacing the original file.")
