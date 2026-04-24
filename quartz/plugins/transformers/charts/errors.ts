/**
 * Typed errors for the Charts transformer.
 *
 * Callers (build scripts, test suites, PR-preview CI) can tell user-input
 * problems apart from unexpected crashes by checking `instanceof ChartError`,
 * or discriminate further by subclass:
 *   - ChartSpecError  — YAML shape / schema violation (parse layer)
 *   - ChartCsvError   — CSV text doesn't match our long format
 *   - ChartDataPathError — `data: <path>` can't be resolved or linked
 */

export class ChartError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ChartError"
  }
}

export class ChartSpecError extends ChartError {
  constructor(message: string) {
    super(message)
    this.name = "ChartSpecError"
  }
}

export class ChartCsvError extends ChartError {
  constructor(message: string) {
    super(message)
    this.name = "ChartCsvError"
  }
}

export class ChartDataPathError extends ChartError {
  constructor(message: string) {
    super(message)
    this.name = "ChartDataPathError"
  }
}
