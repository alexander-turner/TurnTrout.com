import baseConfig from "./jest.config.js"

/**
 * Jest config for Stryker mutation-testing runs (see stryker.config.json).
 * Coverage collection is disabled (the 100% threshold is meaningless when
 * running the reduced suite against mutated code) and the test set is
 * restricted to the suites covering the mutated modules so each mutant
 * run stays fast.
 */

/** @type {import('jest').Config} */
const config = {
  ...baseConfig,
  collectCoverage: false,
  coverageThreshold: undefined,
  testMatch: [
    "**/quartz/util/path*.test.ts",
    "**/quartz/plugins/transformers/tests/formatting_improvement_text*.test.ts",
    "**/quartz/plugins/transformers/tests/formatting_improvement_html*.test.ts",
  ],
}

export default config
