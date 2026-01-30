import pluginJs from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import jestPlugin from "eslint-plugin-jest"
import perfectionist from "eslint-plugin-perfectionist"
import playwright from "eslint-plugin-playwright"
import pluginReact from "eslint-plugin-react"
import * as regexpPlugin from "eslint-plugin-regexp"
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
