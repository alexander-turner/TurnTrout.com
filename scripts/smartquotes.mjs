#!/usr/bin/env node
/* global process */
import { readFileSync, writeFileSync } from "fs"

function convertSmartQuotes(text) {
  const lines = text.split("\n")
  let inCodeFence = false
  const result = []

  for (const line of lines) {
    if (/^```/.test(line.trimStart())) {
      inCodeFence = !inCodeFence
      result.push(line)
      continue
    }
    if (inCodeFence) {
      result.push(line)
      continue
    }

    let converted = ""
    let inInlineCode = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === "`") {
        inInlineCode = !inInlineCode
        converted += ch
        continue
      }
      if (inInlineCode) {
        converted += ch
        continue
      }

      if (ch === "'") {
        const before = i > 0 ? line[i - 1] : " "
        converted += /\w/.test(before) ? "’" : "‘"
      } else if (ch === '"') {
        const before = i > 0 ? line[i - 1] : " "
        converted += /\s|^/.test(before) || before === "(" || before === "[" ? "“" : "”"
      } else {
        converted += ch
      }
    }
    result.push(converted)
  }

  return result.join("\n")
}

for (const file of process.argv.slice(2)) {
  const input = readFileSync(file, "utf8")
  const output = convertSmartQuotes(input)
  if (output !== input) {
    writeFileSync(file, output)
  }
}
