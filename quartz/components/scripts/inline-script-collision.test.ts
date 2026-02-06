import { describe, expect, it } from "@jest/globals"
/**
 * @jest-environment node
 *
 * Validates that inline scripts concatenated in a single afterDOMLoaded property
 * don't silently break each other through minified variable name collisions.
 *
 * Background: componentResources.ts wraps each component's afterDOMLoaded in its
 * own IIFE, isolating scripts from different components. But when multiple inline
 * scripts are concatenated within a SINGLE component (e.g. Body.tsx), they share
 * one IIFE scope. esbuild's minifier independently assigns short names like `i`,
 * `c`, etc. to each script, causing collisions that silently overwrite functions.
 */
import { execSync } from "child_process"
import { join } from "path"

const SCRIPTS_DIR = join(process.cwd(), "quartz", "components", "scripts")

/**
 * Scripts concatenated in Body.tsx's afterDOMLoaded.
 * Update this list when adding/removing scripts from Body.afterDOMLoaded.
 */
const BODY_CONCATENATED_SCRIPTS = [
  "clipboard.inline.ts",
  "elvish-toggle.inline.ts",
  "smallcaps-copy.inline.ts",
]

function bundleInlineScript(filePath: string): string {
  return execSync(
    `npx esbuild ${filePath} --bundle --minify --platform=browser --format=esm --packages=external`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
  )
}

/** Extract top-level function/var declarations using brace-depth tracking. */
function extractTopLevelDeclarations(code: string): string[] {
  const declarations: string[] = []
  let depth = 0
  let i = 0

  while (i < code.length) {
    const ch = code[i]
    if (ch === '"' || ch === "'" || ch === "`") {
      i++
      while (i < code.length && code[i] !== ch) {
        if (code[i] === "\\") i++
        i++
      }
      i++
      continue
    }
    if (ch === "{") {
      depth++
      i++
      continue
    }
    if (ch === "}") {
      depth--
      i++
      continue
    }
    if (depth === 0) {
      const rest = code.slice(i)
      const funcMatch = rest.match(/^function\s+(?<name>\w+)/)
      if (funcMatch?.groups) {
        declarations.push(funcMatch.groups["name"])
        i += funcMatch[0].length
        continue
      }
      const varMatch = rest.match(/^(?:var|let|const)\s+(?<name>\w+)/)
      if (varMatch?.groups) {
        declarations.push(varMatch.groups["name"])
        i += varMatch[0].length
        continue
      }
    }
    i++
  }
  return declarations
}

describe("inline script isolation", () => {
  it("Body.afterDOMLoaded wraps each script in its own IIFE", async () => {
    // Import Body dynamically (inline scripts are mocked as empty strings in Jest)
    const { default: createBody } = await import("../Body")
    const Body = createBody()
    const afterDOM = Body.afterDOMLoaded ?? ""

    // With 3 mocked empty scripts, IIFE-wrapped output should contain 3 IIFEs
    const iifeCount = (afterDOM.match(/\(function\(\)\{/g) ?? []).length
    expect(iifeCount).toBe(BODY_CONCATENATED_SCRIPTS.length)
  })

  it("detects that concatenated scripts WOULD collide without IIFE isolation", () => {
    // This test documents known collisions. If it starts passing (no collisions),
    // the IIFE wrapping is still correct but no longer strictly necessary.
    const scriptDecls = new Map<string, string[]>()
    for (const file of BODY_CONCATENATED_SCRIPTS) {
      const bundled = bundleInlineScript(join(SCRIPTS_DIR, file))
      scriptDecls.set(file, extractTopLevelDeclarations(bundled))
    }

    const allCollisions: string[] = []
    const entries = [...scriptDecls.entries()]
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [fileA, declsA] = entries[i]
        const [fileB, declsB] = entries[j]
        const setB = new Set(declsB)
        const shared = declsA.filter((d) => setB.has(d))
        if (shared.length > 0) {
          allCollisions.push(`${fileA} ↔ ${fileB}: ${shared.join(", ")}`)
        }
      }
    }

    // We expect collisions to exist (proving the IIFE wrapping is necessary).
    // If this fails (no collisions), it means esbuild's naming changed -
    // the IIFE wrapping should be kept regardless as a safety measure.
    expect(allCollisions.length).toBeGreaterThan(0)
  })
})
