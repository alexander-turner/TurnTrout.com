# CLAUDE.md

Guidance for Claude Code working in this repo. **For detail on the build pipeline, asset processing, visual regression, CI cost optimization, GitHub Actions, and other rarely-needed material, read `.claude/dev-notes.md` on demand** — it's deliberately kept out of CLAUDE.md to keep per-turn context small.

## Overview

Personal blog (turntrout.com) on Quartz, a static site generator. TypeScript (Quartz customizations + plugins) and Python (asset processing, validation).

## Commands

```bash
pnpm dev          # Dev server with hot reload
pnpm build        # Production build (needs network)
pnpm start        # Build and serve on :8080
pnpm test         # TypeScript tests with coverage (100% required)
pnpm check        # Type check + lint
pnpm format       # Format all code
pnpm test:visual  # Playwright visual regression
uv run pytest <path>   # Python tests
```

For offline builds, Playwright local setup, and visual baseline approval, see `.claude/dev-notes.md`.

## Architecture (brief)

Quartz pipeline is **Transform → Filter → Emit** (`quartz/plugins/{transformers,filters,emitters}/`), orchestrated by `quartz/build.ts` with a dependency graph (`quartz/depgraph.ts`). UI components live in `quartz/components/`. Python in `scripts/` handles assets and validation.

Place magic numbers / shared constants in `config/constants.json` (static) or `quartz/components/constants.ts` (dynamic).

Configuration entry points: `config/quartz/quartz.config.ts`, `config/quartz/quartz.layout.ts`, `config/typescript/tsconfig.json`, `config/javascript/jest.config.js`.

## Content

- `website_content/`: Markdown source with YAML frontmatter; Obsidian-flavored with custom extensions (spoilers, subtitles, table captions)
- `public/`: built static site

## Git workflow

- **Hooks auto-configured** via `.claude/settings.json` SessionStart hook (also exports `GH_REPO` for proxy environments). Manual: `git config core.hooksPath .hooks`.
- **Pre-commit**: lint-staged formatters/linters on changed files.
- **Pre-push**: stashes uncommitted changes, runs auto-fix formatters, pylint, asset upload, alt-text scan. Resume from last failure with `RESUME=true git push`.
- **Pull requests**: always follow `.claude/skills/pr-creation.md`.
- **Dev branch workflow**: when working on `dev`, first merge `main` into `dev`, push `dev`, then start the new feature branch from `dev`.

## Testing requirements

- **Zero flakiness tolerance.** Every CI check must pass every time. Prioritize root-cause fixes for anything we control. For external services we can't control (e.g. Cloudflare API 504s), retry as a last resort. No flakiness is acceptable regardless of source.
- **TypeScript**: 100% branch/statement/function/line coverage enforced by Jest (see `coveragePathIgnorePatterns`). Tests live next to implementation as `*.test.ts`.
- **Python**: 100% line coverage enforced locally.
- **Interaction features/bug fixes**: add Playwright `*.spec.ts` covering both mobile and desktop viewports; verify visual state, not just DOM.

## Code style

- Prefer throwing errors over logging warnings for critical issues — fail loudly.
- Un-nest conditionals; combine related checks.
- Create shared helpers when the same logic appears in multiple places.
- TypeScript: avoid `!` non-null assertions (linter flags them); use proper null checks.
- **Never add backward-compat re-exports** (`export { foo } from "./other-module"`). Update imports at the call site.
- **Prefer immutable types** for read-only collections: `ReadonlySet`, `ReadonlyMap`, `readonly T[]`, `Readonly<Record<K,V>>`, `as const`. Python: `frozenset`, `tuple`, `frozendict`. Function parameters should accept `readonly` types when they don't mutate.

## Error handling

- **Never use empty catch blocks.** Errors should be handled or propagated.
- Don't catch just to ignore — let unexpected errors fail loudly.
- Catch only specific errors you know how to handle.
- If you must catch for cleanup, rethrow after.
- Don't try/catch to silence errors without a documented reason.

## Testing rules

- Parametrize with `it.each()` for compactness.
- Write focused, non-duplicative tests.
- **NEVER update test expectations without asking the user first.**
- **NEVER lower CI thresholds or weaken assertions to make tests pass.** Fix the underlying issue (improve site performance, fix flaky test logic, etc.). Cheap shortcuts like lowering Lighthouse score thresholds or loosening test criteria are not acceptable.

## Dependencies

- Use `pnpm` (not npm) for all package operations.

## Documentation

- When modifying functionality described in `website_content/design.md`, update that file.
- Design philosophy from `design.md`: minimal targeted changes; verify before generating; derive style from existing code; security-first; modern best practices with explicit typing; no unnecessary refactoring or whitespace changes.

## Before writing code

- Ask clarifying questions if uncertain about scope.
- Check for existing libraries before rolling custom solutions.
- Look for existing patterns before creating new ones.

## CI monitoring

After pushing, monitor CI until pass or fail. The PostToolUse hook polls GitHub Actions; the Stop hook blocks completion on remote CI failures. See `.claude/dev-notes.md` for manual commands and CI cost-optimization labels.
