import pluginJs from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import jestPlugin from "eslint-plugin-jest"
import jsxA11y from "eslint-plugin-jsx-a11y"
import perfectionist from "eslint-plugin-perfectionist"
import playwright from "eslint-plugin-playwright"
import pluginReact from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import regexpPlugin from "eslint-plugin-regexp"
import globals from "globals"
import { configs as tseslintConfigs, parser as tseslintParser } from "typescript-eslint"

// Backward-compat re-exports (`export ... from`) are banned project-wide to
// keep call sites importing from the canonical module, EXCEPT for the three
// plugin barrel files, which legitimately use the pattern as a registry.
const noReexportSyntax = {
  selector: "ExportNamedDeclaration[source]",
  message:
    "Do not add backward-compat re-exports (`export ... from`); import from the canonical module at the call site.",
}

export default [
  // Global rules and plugins
  {
    plugins: {
      perfectionist,
      regexp: regexpPlugin,
    },
    rules: {
      "perfectionist/sort-imports": [
        "error",
        {
          type: "natural",
          order: "asc",
        },
      ],
      "perfectionist/sort-named-imports": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-named-exports": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-exports": ["error", { type: "natural", order: "asc" }],
      "perfectionist/sort-array-includes": ["error", { type: "natural", order: "asc" }],
      ...regexpPlugin.configs["flat/recommended"].rules,
    },
  },

  // JS/TS/React base configs
  { files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] },
  { languageOptions: { globals: globals.browser } },

  // CommonJS files (.cjs) need Node-style globals like `module` and `require`
  {
    files: ["**/*.cjs"],
    languageOptions: { globals: globals.node },
  },
  pluginJs.configs.recommended,
  ...tseslintConfigs.recommended,
  pluginReact.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,

  // React Hooks rules
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // Async/await correctness
  {
    rules: {
      "require-await": "error",
    },
  },

  // Security: prevent dangerous eval-like constructs
  {
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-debugger": "error",
    },
  },

  // Ban backward-compat re-exports everywhere.
  {
    rules: {
      "no-restricted-syntax": ["error", noReexportSyntax],
    },
  },

  // Plugin barrel files use `export ... from` as a legitimate registry pattern.
  {
    files: [
      "quartz/plugins/transformers/index.ts",
      "quartz/plugins/filters/index.ts",
      "quartz/plugins/emitters/index.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },

  // Type-aware rules for our TypeScript sources. Requires the parser to load
  // the project so type information is available.
  {
    files: ["quartz/**/*.ts", "quartz/**/*.tsx"],
    ignores: ["**/*.min.ts", "**/*.min.d.ts"],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        project: "./config/typescript/tsconfig.json",
        // This config lives in config/javascript/; the tsconfig project path is
        // relative to the repo root, two levels up.
        tsconfigRootDir: `${import.meta.dirname}/../..`,
      },
    },
    rules: {
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },

  // Disable rules for test/spec files:
  // - react-hooks: Playwright's `use()` triggers false positives
  // - require-await: mock methods often need async signatures
  // - no-new-func: tests use Function constructor to simulate inline scripts
  {
    files: ["**/*.spec.ts", "**/*.test.ts", "**/*.test.js"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "require-await": "off",
      "no-new-func": "off",
    },
  },
  {
    files: ["**/tests/fixtures.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },

  // Playwright specific config for test files
  {
    files: ["**/*.spec.ts"],
    plugins: {
      playwright,
    },
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      "playwright/no-skipped-test": [
        "error",
        {
          allowConditional: true,
        },
      ],
    },
  },

  // Jest specific config for test files
  {
    files: ["**/*.test.ts", "**/*.test.js"],
    plugins: {
      jest: jestPlugin,
    },
    rules: {
      ...jestPlugin.configs["flat/recommended"].rules,
      // Custom assertion helpers that wrap `expect` internally.
      "jest/expect-expect": ["warn", { assertFunctionNames: ["expect", "expectRevealed"] }],
    },
  },

  // General ignores
  {
    ignores: [
      "website_content/",
      "**/htmlcov/",
      "**/coverage/",
      "public/",
      "backstop/",
      "**/*!*",
      "quartz/.quartz-cache/",
      "node_modules/",
      "**/*.min.js",
      "**/*.min.ts",
      "quartz/i18n/",
      "**/img-comparison-slider.js",
      "**/.worktrees/",
      ".venv/",
      ".stryker-tmp/",
      "mutants/",
      ".claude-tooling/",
      ".pnpm-store",
    ],
  },

  // React settings
  {
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  // Turn off rules that might conflict with Prettier formatting
  eslintConfigPrettier,
]
