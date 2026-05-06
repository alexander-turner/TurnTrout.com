import { describe, it, expect, beforeAll } from "@jest/globals"
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"

// CI splits Playwright execution into two workflows by test title:
//   - visual-testing.yaml  → --grep "(screenshot)"        (downloads R2 baselines)
//   - playwright-tests.yaml → --grep-invert "(screenshot)" (no baselines)
// A regression-screenshot test routed to the second workflow has no baseline
// to compare against and dies with "A snapshot doesn't exist". This check
// statically catches the routing mismatch by walking the TS AST: find every
// test whose body calls takeRegressionScreenshot / toHaveScreenshot, then
// assert the full describe-prefixed title contains "screenshot".
//
// Match the substring used by the CI grep (case-sensitive — Playwright's
// regex is case-sensitive too).
const ROUTING_MARKER = "screenshot"

const REGRESSION_CALLS = new Set([
  "takeRegressionScreenshot",
  "toHaveScreenshot",
])

const SPEC_DIR = path.resolve(__dirname)

function listSpecFiles(): string[] {
  return fs
    .readdirSync(SPEC_DIR)
    .filter((name) => name.endsWith(".spec.ts"))
    .map((name) => path.join(SPEC_DIR, name))
}

function getStringLiteralTitle(node: ts.Expression): string | null {
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) {
    // Approximate: keep literal head and tail text, drop interpolations.
    // Good enough for the routing check — we only care whether "screenshot"
    // appears literally in the title source, not in the interpolated value.
    let text = node.head.text
    for (const span of node.templateSpans) {
      text += span.literal.text
    }
    return text
  }
  return null
}

function getCalleeName(expr: ts.LeftHandSideExpression): string | null {
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr)) {
    // e.g. test.describe → "describe"; expect.soft(...).toMatchSnapshot → "toMatchSnapshot"
    return expr.name.text
  }
  return null
}

interface Violation {
  file: string
  line: number
  fullTitle: string
  call: string
}

function findViolations(file: string): Violation[] {
  const src = fs.readFileSync(file, "utf-8")
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true)
  const violations: Violation[] = []

  // Walk the AST tracking the current describe stack so we can build the
  // full title path the way Playwright does.
  function walk(node: ts.Node, describeStack: readonly string[]): void {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const isPlainTest = ts.isIdentifier(callee) && callee.text === "test"
      const isDescribe =
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === "test" &&
        callee.name.text === "describe"

      if (isPlainTest) {
        const titleArg = node.arguments[0]
        const title = titleArg ? getStringLiteralTitle(titleArg) : null
        if (title !== null) {
          const fullTitle = [...describeStack, title].join(" › ")
          // Walk the test body looking for any regression-screenshot call.
          const offending = findRegressionCall(node)
          if (offending && !fullTitle.toLowerCase().includes(ROUTING_MARKER)) {
            const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
            violations.push({
              file: path.relative(SPEC_DIR, file),
              line: line + 1,
              fullTitle,
              call: offending,
            })
          }
        }
        // Don't descend into test() bodies — nested test() is invalid.
        return
      }

      if (isDescribe) {
        const titleArg = node.arguments[0]
        const title = (titleArg && getStringLiteralTitle(titleArg)) ?? "<dynamic>"
        const child = [...describeStack, title]
        node.forEachChild((c) => walk(c, child))
        return
      }
    }
    node.forEachChild((c) => walk(c, describeStack))
  }

  walk(sf, [])
  return violations
}

function findRegressionCall(testCall: ts.CallExpression): string | null {
  let found: string | null = null
  function visit(node: ts.Node): void {
    if (found) return
    if (ts.isCallExpression(node)) {
      const name = getCalleeName(node.expression)
      if (name && REGRESSION_CALLS.has(name)) {
        found = name
        return
      }
    }
    node.forEachChild(visit)
  }
  // Skip the title arg; only walk the callback body.
  for (let i = 1; i < testCall.arguments.length; i++) {
    visit(testCall.arguments[i])
  }
  return found
}

describe("visual regression test routing", () => {
  const allViolations: Violation[] = []
  beforeAll(() => {
    for (const file of listSpecFiles()) {
      allViolations.push(...findViolations(file))
    }
  })

  it("every test calling takeRegressionScreenshot has 'screenshot' in its title", () => {
    const formatted = allViolations.map(
      (v) => `${v.file}:${v.line} "${v.fullTitle}" calls ${v.call}() but lacks "screenshot" in its full title`,
    )
    expect(formatted).toEqual([])
  })
})
