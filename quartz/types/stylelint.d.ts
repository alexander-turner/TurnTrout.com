// stylelint has types in types/stylelint/index.d.ts but its package.json
// doesn't export them, so TypeScript can't resolve them. Declare the subset we use.
declare module "stylelint" {
  interface Warning {
    rule: string
    text: string
    line: number
    column: number
    severity: string
  }

  interface LintResult {
    warnings: Warning[]
  }

  interface LinterResult {
    results: LintResult[]
    code?: string
  }

  interface LintOptions {
    code: string
    config: Record<string, unknown>
    fix?: boolean
    formatter?: string
  }

  interface Stylelint {
    lint(options: LintOptions): Promise<LinterResult>
  }

  const stylelint: Stylelint
  export default stylelint
  export type { LinterResult, LintResult, Warning }
}
