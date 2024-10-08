// babel.config.cjs

module.exports = {
  // eslint-disable-line no-undef
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    "@babel/preset-typescript",
    ["@babel/preset-react", { runtime: "automatic", importSource: "preact" }],
  ],
}
