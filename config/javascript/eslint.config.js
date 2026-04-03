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
import { configs as tseslintConfigs } from "typescript-eslint"

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
      "regexp/prefer-named-capture-group": "error",
    },
  },

  // JS/TS/React base configs
  { files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] },
  { languageOptions: { globals: globals.browser } },
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

  // Disable rules for test/spec files:
  // - react-hooks: Playwright's `use()` triggers false positives
  // - require-await: mock methods often need async signatures
  {
    files: ["**/*.spec.ts", "**/*.test.ts", "**/*.test.js"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "require-await": "off",
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
    },
  },

  // General ignores
  {
    ignores: [
      "website_content/",
      "**/htmlcov/",
      "public/",
      "backstop/",
      "**/*!*",
      "quartz/.quartz-cache/",
      "node_modules/",
      "**/*.min.js",
      "**/*.min.ts",
      "quartz/i18n/",
      "quartz/static/scripts/img-comparison-slider.js",
      ".venv/",
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
