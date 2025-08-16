/** @type {import('jest').Config} */
const config = {
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",

  coveragePathIgnorePatterns: ["quartz/cli/*", "quartz/depgraph.ts", "quartz/util/*"],

  coverageThreshold: {
    global: {
      branches: 90,
      statements: 100,
      functions: 100,
      lines: 100,
    },
  },

  // A preset that is used as a base for Jest's configuration
  preset: "ts-jest",

  // The test environment that will be used for testing
  testEnvironment: "jsdom",

  // A map from regular expressions to paths to transformers
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        useESM: true,
      },
    ],
    "^.+\\.(js|jsx)$": [
      "babel-jest",
      {
        presets: [
          ["@babel/preset-env", { targets: { node: "current" } }],
          ["@babel/preset-react", { runtime: "automatic", importSource: "preact" }],
        ],
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
    "/node_modules/(?!preact|preact-render-to-string|preact-context-provider).+\\.js$",
  ],
}

export default config
