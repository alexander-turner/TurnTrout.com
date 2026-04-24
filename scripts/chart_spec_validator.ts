// Round-trip YAML from stdin through quartz's `parseChartSpec` and exit 0/1.
// Called from `scripts/chart_extract.py` to catch LLM hallucinations that
// pass the JSON schema but would fail at build time.
//
// Usage:
//   echo "<yaml>" | npx tsx scripts/chart_spec_validator.ts

import { parseChartSpec } from "../quartz/plugins/transformers/charts/parse"

process.stdin.setEncoding("utf8")

let buf = ""
process.stdin.on("data", (chunk: string) => {
  buf += chunk
})
process.stdin.on("end", () => {
  try {
    parseChartSpec(buf)
    process.exit(0)
  } catch (err) {
    process.stderr.write((err as Error).message + "\n")
    process.exit(1)
  }
})
