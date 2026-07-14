"use strict"

// babel.config.cjs — `module` is provided by the CommonJS runtime
// and declared as a global for ESLint via the `**/*.cjs` block in
// config/javascript/eslint.config.js.

module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    "@babel/preset-typescript",
    ["@babel/preset-react", { runtime: "automatic", importSource: "preact" }],
  ],
}
