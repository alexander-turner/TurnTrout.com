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

// Headless WebKit can leave a page unpainted; a page that composites no frames
// never fires requestAnimationFrame, so a rAF-polled `waitForFunction`
// predicate is evaluated zero times and even wall-clock deadlines inside it
// can never fire. The failure masquerades as a generic timeout on random
// shards. Timer polls run regardless of paint activity.
const rafPollingSyntax = [
  {
    selector: "Property[key.name='polling'][value.value='raf']",
    message:
      "polling: 'raf' never fires on unpainted headless WebKit pages; poll on a timer interval (e.g. polling: 100) instead.",
  },
  {
    selector:
      "CallExpression[callee.property.name='waitForFunction']:not(:has(Property[key.name='polling']))",
    message:
      "waitForFunction defaults to rAF polling, which never fires on unpainted headless WebKit pages; pass an explicit numeric polling interval (e.g. { polling: 100 }).",
  },
]

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

  // Naming conventions: ban snake_case identifiers (use camelCase or UPPER_CASE)
  {
    rules: {
      camelcase: ["error", { properties: "never" }],
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

  // .github/scripts holds Node CI automation loaded by actions/github-script:
  // CommonJS entrypoints (require/module.exports) plus ESM helpers that need
  // Node globals. These files are synced and linted by the automation template,
  // so disable the rules that would otherwise force edits to template-managed
  // code: require() imports, an async entrypoint with no await, and a lookahead
  // the regexp plugin flags as super-linear.
  {
    files: [".github/scripts/**/*.{js,cjs,mjs}"],
    languageOptions: { globals: globals.node },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "require-await": "off",
      "regexp/no-super-linear-backtracking": "off",
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

  // Playwright wait discipline for specs and their shared helpers
  // (visual_utils.ts is not a *.spec.ts but wraps the same page waits).
  {
    files: ["**/*.spec.ts", "quartz/components/tests/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", noReexportSyntax, ...rafPollingSyntax],
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
