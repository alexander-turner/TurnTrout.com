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
    "/node_modules/",
    "quartz/cli/",
    "quartz/depgraph\\.ts",
    "quartz/plugins/emitters/static\\.ts",
    "quartz/util/(glob|ctx|escape|log|normalize-hast|path|perf|sourcemap|trace)\\.ts",
    "quartz/util/(jsx|resources)\\.tsx",
    "quartz/.*\\.min\\.ts",
    "quartz/components/constants\\.ts",
    "quartz/components/Authors\\.tsx",
    "quartz/plugins/transformers/assetDimensions\\.ts",
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
  testEnvironment: "jsdom",

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
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  // An array of regexp pattern strings that are matched against all source file paths, matched files will skip transformation
  transformIgnorePatterns: [
    "/node_modules/(?!preact|preact-render-to-string|preact-context-provider|hastscript|rehype|unist-util-visit-parents).+\\.js$",
  ],
}

export default config
