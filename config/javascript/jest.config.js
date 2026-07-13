import { dirname, resolve } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, "../..")

/** @type {import('jest').Config} */
const config = {
  rootDir,

  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",

  coveragePathIgnorePatterns: [
    // Third-party packages — not our code to cover
    "/node_modules/",
    // CLI entrypoints (build/dev/serve/create); exercised via the full Quartz
    // build pipeline, not in the Jest unit-test environment
    "quartz/cli/",
    // Tested by depgraph.test.ts but excluded here because it relies on
    // Node-only data structures that report misleading branch counts under Jest's
    // JSDOM environment
    "quartz/depgraph\\.ts",
    // Thin file-copy emitter; all meaningful branches require a live FS + full
    // build context (esbuild, globby over real static assets) that the Jest
    // environment cannot provide
    "quartz/plugins/emitters/static\\.ts",
    // glob: thin async wrapper around globby — requires a real filesystem walk
    // ctx: type-only (interfaces + zero runtime branches)
    // escape: tested by escape.test.ts (excluded from threshold to avoid noise from a single trivial file)
    // log: winston logger setup with file rotation — side-effects at module load time make it hostile to coverage
    // path: tested by path.test.ts (excluded to avoid JSDOM/Node path-module conflicts with the isomorphic slug logic)
    // perf: PerfTimer wraps process.hrtime; wall-clock calls produce non-deterministic output
    // sourcemap: thin source-map-support config hook; exercised only when the built bundle runs
    // trace: calls process.exit(1) — untestable without crashing the Jest worker
    "quartz/util/(glob|ctx|escape|log|path|perf|sourcemap|trace)\\.ts",
    // jsx: hast-to-JSX runtime renderer — rendering fidelity is verified by
    //   Playwright visual tests, not unit tests
    // resources: JSX helpers for <script>/<link> injection; no pure-logic branches
    "quartz/util/(jsx|resources)\\.tsx",
    // Vendored minified third-party code (e.g. twemoji); not our logic to cover
    "quartz/.*\\.min\\.ts",
    // Pure constant re-exports from constants.json — zero runtime branches
    "quartz/components/constants\\.ts",
    // Thin presentational component; rendering correctness covered by Playwright,
    // not Jest unit tests
    "quartz/components/Authors\\.tsx",
    // Spawns child processes and reads from the filesystem to fetch image
    // dimensions; requires a fully-built site and real assets to exercise
    "quartz/plugins/transformers/assetDimensions\\.ts",
    // Test files themselves are not subject to coverage
    "\\.test\\.(ts|tsx|js|jsx)$",
    "/__tests__/",
  ],

  coverageThreshold: {
    global: {
      branches: 100,
      statements: 100,
      functions: 100,
      lines: 100,
    },
  },

  // A preset that is used as a base for Jest's configuration
  preset: "ts-jest",

  // The test environment that will be used for testing
  testEnvironment: "jest-fixed-jsdom",

  // Configure test environment to properly handle ESM with experimental VM modules
  testEnvironmentOptions: {
    customExportConditions: ["node", "node-addons"],
  },

  // Setup files to run before tests
  setupFilesAfterEnv: ["<rootDir>/config/javascript/jest.setup.js"],

  // A map from regular expressions to paths to transformers
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: resolve(rootDir, "config/typescript/tsconfig.json"),
        useESM: true,
      },
    ],
    "^.+\\.(js|jsx)$": [
      "babel-jest",
      {
        configFile: resolve(rootDir, "config/javascript/babel.config.cjs"),
      },
    ],
  },

  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.inline$": "<rootDir>/quartz/components/scripts/__mocks__/inlineScriptMock.ts",
  },
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(test).ts(x|)"],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/public/", "<rootDir>/.stryker-tmp/"],
  // Keep Stryker's sandbox copy of the repo out of jest-haste-map (duplicate
  // package.json names otherwise collide during local runs)
  modulePathIgnorePatterns: ["<rootDir>/.stryker-tmp/"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  // An array of regexp pattern strings that are matched against all source file paths, matched files will skip transformation
  transformIgnorePatterns: [
    "/node_modules/(?!preact|preact-render-to-string|preact-context-provider|hastscript|rehype|unist-util-visit-parents).+\\.js$",
  ],
}

export default config
