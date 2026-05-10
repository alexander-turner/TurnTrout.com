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
- **Merging PRs**: never call `merge_pull_request` directly. Once PR-side checks are green, call `mcp__github__enable_pr_auto_merge` (squash by default). Required status checks gate the merge — every required workflow runs on every PR (Chromium-only on PRs; Firefox + macOS WebKit only on push to `main`). Do **not** force-merge with empty "run ALL CI" commits or a direct merge — auto-merge is the only sanctioned path to `main`.

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
- **Visual regression tests must include `(screenshot)` in the title.** CI splits Playwright into two workflows by `--grep "(screenshot)"`: `visual-testing.yaml` (downloads R2 baselines) vs. `playwright-tests.yaml` (no baselines). A test that calls `takeRegressionScreenshot` / `toHaveScreenshot` without "screenshot" in its full describe-prefixed title gets routed to `playwright-tests` and dies with "A snapshot doesn't exist".

## Dependencies

- Use `pnpm` (not npm) for all package operations.

## Documentation

When a change touches user-facing behavior, update the relevant doc:

- **`website_content/design.md`**: any new design feature — visual, layout, UX, asset-pipeline behavior, or anything else already documented there. Match the conversational, first-person prose style of the surrounding sections (motivation and tradeoffs, not implementation detail). **Surface the drafted prose in chat before committing** so the user can rewrite the framing or push back. Don't make design.md overly technical — code-level minutiae belong in `.claude/dev-notes.md`.
- **`website_content/Test-page.md`**: any new visual element (e.g. glyph margin before favicon, new dropcap variant, new admonition style). Add a representative example so the next visual-regression run captures the new element as a baseline.
- **`.claude/dev-notes.md`**: any new dev procedure that's only useful occasionally — build steps, pre-push checks, CI cost optimization, debugging recipes. Keep CLAUDE.md itself slim — it's loaded every turn.

Design philosophy from `design.md`: minimal targeted changes; verify before generating; derive style from existing code; security-first; modern best practices with explicit typing; no unnecessary refactoring or whitespace changes.

## Before writing code

- Ask clarifying questions if uncertain about scope.
- Check for existing libraries before rolling custom solutions.
- Look for existing patterns before creating new ones.

## CI monitoring

After pushing, monitor CI until pass or fail. The PostToolUse hook polls GitHub Actions; the Stop hook blocks completion on remote CI failures. See `.claude/dev-notes.md` for manual commands and CI cost-optimization labels.

- **Never sit on a CI failure.** If the Stop hook reports a failure — or any check on the open PR is red — investigate and fix it before reporting the task done. Do not assume a remote failure is "just stale local deps" without verifying remote status via `mcp__github__pull_request_read` (`get_status` + `get_check_runs`).
- This includes lint/static-analysis services (DeepSource, Socket, etc.) shown alongside GitHub Actions checks — fix their findings even when the underlying file came from a parent branch, since they block the PR all the same.
- If a failure is genuinely outside the PR's scope and not fixable here, say so explicitly with evidence rather than going silent.

## DeepSource issues

- The `deepsource` CLI is authenticated by the SessionStart hook. When asked to fix DeepSource issues — or proactively when you've just landed nontrivial work — list outstanding issues and clear them.
- Useful invocations:
  - `deepsource issues --default-branch --analyzer python --output json` (issues on `main`)
  - `deepsource issues --default-branch --analyzer javascript --output json`
  - `deepsource issues --pr <N> --output json` (issues introduced/remaining on a PR)
- Fix root causes, not by appending `// skipcq: <CODE>` — only suppress when the warning is genuinely a false positive and write a comment explaining why on the same line.
- Group fixes into one focused PR per analyzer (or per issue cluster if a single PR would balloon), keeping the diff reviewable. After landing, re-run the CLI to confirm the count went down.
