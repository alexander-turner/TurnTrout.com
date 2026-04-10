# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal blog/website (turntrout.com) built on Quartz, a static site generator. The codebase contains TypeScript (Quartz customizations and plugins) and Python (asset processing, validation) components.

## Development Commands

### Building & Running

```bash
pnpm dev          # Development server with hot reload
pnpm build        # Production build (requires network access)
pnpm start        # Build and serve locally on port 8080
pnpm preview      # Build and serve
```

**Offline builds**: In environments without network access (e.g. CI, sandboxed sessions), use the `--offline` flag to skip remote asset fetching and link counting:

```bash
PUPPETEER_EXECUTABLE_PATH=$(find ~/.cache/ms-playwright -name "chrome" -path "*/chrome-linux/*" | head -1) \
  npx tsx quartz/bootstrap-cli.ts build --offline
```

### Testing

```bash
pnpm test                   # TypeScript tests with coverage (requires 100% branch coverage)
pnpm check                  # Type checking without emitting files
pnpm test:visual            # Visual regression tests with Playwright
uv run pytest <path>        # Python tests
```

### Running Playwright Tests Locally

1. Install browsers and WebKit system dependencies:

```bash
npx playwright install chromium firefox
npx playwright install-deps webkit
npx playwright install webkit
```

2. Start the local server in offline mode (uses Playwright's Chromium for critical CSS generation):

```bash
PUPPETEER_EXECUTABLE_PATH=$(find ~/.cache/ms-playwright -name "chrome" -path "*/chrome-linux/*" | head -1) \
  npx tsx quartz/bootstrap-cli.ts build --serve --offline &
```

3. Wait for the server to be ready at `http://localhost:8080`, then run tests:

```bash
npx playwright test --config config/playwright/playwright.config.ts -g "test name pattern"
```

### Code Quality

```bash
pnpm format         # Format all code
pnpm check          # Lint and type check
```

## Architecture

Place any "magic numbers" or constants used in >1 file in `config/constants.json` (for static quantities) or `quartz/components/constants.ts` (for dynamically generated values).

### Quartz Plugin System (TypeScript)

The build follows a three-stage pipeline: **Transform → Filter → Emit**

**Transformers** (`quartz/plugins/transformers/`): Process Markdown/HTML content

- Operate on MDAST (Markdown AST) and HAST (HTML AST) trees
- Examples: twemoji rendering, color variables, link favicons, table captions, spoilers, subtitles

**Filters** (`quartz/plugins/filters/`): Filter content (e.g., remove drafts)

**Emitters** (`quartz/plugins/emitters/`): Generate output files (HTML pages, RSS, sitemap, aliases)

**Core Build** (`quartz/build.ts`): Orchestrates the build with dependency graph management (`quartz/depgraph.ts`)

**Components** (`quartz/components/`): React/Preact UI components

### Python Scripts (`scripts/`)

**Asset processing**: `convert_assets.py`, `compress.py`, `r2_upload.py`

**Validation**: `check_internal_links.py`, `source_file_checks.py`, `built_site_checks.py`, `scan_for_empty_alt.py`

**Pre-push orchestration**: `run_push_checks.py` coordinates all validation before pushing

**Alt-text**: Alt-text generation is now handled by the PyPI package `alt-text-llm`

### Configuration Files

- **`config/quartz/quartz.config.ts`**: Main configuration defining transformer/emitter/filter pipeline
- **`config/quartz/quartz.layout.ts`**: Page layout and component arrangement
- **`config/typescript/tsconfig.json`**: Strict TypeScript config with Preact JSX
- **`jest.config.js`**: Test config enforcing 100% coverage thresholds (at root due to Jest's module resolution requirements)
- **`.cursorrules`**: Coding guidelines (minimal diffs, derive style from context, security-first)

## Git Workflow

**Hooks auto-configured**: Git hooks are automatically enabled via `.claude/settings.json` SessionStart hook, which also detects the GitHub repo from proxy remotes and exports `GH_REPO` so `gh` CLI commands work in web sessions. Manual setup: `git config core.hooksPath .hooks`

**Pre-commit**: Runs lint-staged formatters/linters on changed files

**Pull requests**: Always follow `.claude/skills/pr-creation.md` before creating any PR.

**Pre-push** (main branch only):

- Stashes uncommitted changes
- Runs only unique local tasks (auto-fix formatters, asset upload, alt-text scan)
- Most quality checks (linting, tests, spellcheck, link validation) run in CI
- Can resume from last failure: `RESUME=true git push`

## Content Structure

- **`website_content/`**: Markdown source files with YAML frontmatter
- **`public/`**: Built static site output
- Supports Obsidian-flavored Markdown with custom extensions (spoilers, subtitles, table captions)

## Testing Requirements

- **Zero flakiness tolerance**: Every CI check must pass every time. Prioritize root-cause fixes for anything we control (fix the test, fix the timeout, fix the code). For external services outside our control (e.g. Cloudflare API 504s), add retry logic as a last resort. No flakiness is acceptable regardless of source.
- **TypeScript**: 100% branch/statement/function/line coverage enforced by Jest
- **Python**: 100% line coverage enforced locally
- Tests live alongside implementation files (`.test.ts` suffix)
- Visual regression tests use Playwright with `lost-pixel`
- **Interaction features/bug fixes**: When adding an interaction feature or fixing an interaction bug, add Playwright spec tests (`*.spec.ts`) following best practices (test both mobile and desktop viewports, verify visual state not just DOM state)

## Key Technical Details

### Build Pipeline

1. Parse Markdown files with frontmatter
2. Apply transformer plugins to MDAST/HAST
3. Filter content
4. Emit HTML pages and assets
5. Inline critical CSS server-side
6. Generate RSS/sitemap

### Asset Management

- Assets staged in `asset_staging/` during editing
- Build pipeline: compress → strip EXIF → upload to Cloudflare R2 → update Markdown refs
- Images converted to AVIF (10x compression vs PNG)
- Videos: WEBM for most browsers, MP4 for Safari

### Text Processing

- Smart quotes conversion (custom regex, 45 unit tests)
- Automatic smallcaps for 3+ consecutive capitals (excluding Roman numerals)
- Hyphen → en-dash/em-dash conversion
- Dropcaps using EB Garamond with CSS pseudo-elements

### Site Features

- Server-side KaTeX math rendering
- Inline favicons next to external links
- Popovers for internal links
- Mermaid diagrams rendered server-side
- Twemoji for consistent emoji styling
- Zero layout shift (asset dimensions pre-calculated)

## Pre-push Validation Pipeline

When pushing to main, these checks run automatically:

1. ruff (Python linting, fast)
2. ESLint `--fix` (auto-fixes TypeScript)
3. docformatter `--in-place` (auto-fixes Python docstrings)
4. stylelint `--fix` (auto-fixes SCSS)
5. Asset compression and CDN upload
6. Alt-text scan (LLM-based, requires API key)

Heavier checks (tests, spellcheck, link validation, built-site checks) run in CI for reliability and parallelism.

## CI Monitoring

After pushing code or creating a PR, **always monitor CI status until all checks pass or fail**. The PostToolUse hook (`post-push-ci-watch.sh`) automatically polls GitHub Actions after `git push` / `gh pr create`. If CI fails, fix the issues and push again. The Stop hook also blocks completion if remote CI has failures for the last pushed commit.

To manually check CI status:
```bash
gh run list --branch <branch> --commit <sha> --json name,status,conclusion
gh run view <run-id> --log-failed   # Show logs from a failed run
```

## GitHub Actions (Post-push)

After pushing to main:

- **Publication date updates**: Automatically updates `date_published` and `date_updated` fields in article frontmatter
- 1,602 Playwright tests across 9 configurations (3 browsers × 3 viewport sizes)
- Tests run on ~33 parallel shards (Linux only on PRs; macOS WebKit added on main)
- macOS runners (10x cost of Linux) only run on pushes to main, not on PRs
- Visual regression testing with `lost-pixel`
- Lighthouse checks for minimal layout shift
- DeepSource static analysis (use `deepsource` CLI to check issues with `--commit`, `--pr`, or `--default-branch` flags — **never** try to fetch DeepSource URLs via `WebFetch`, the web UI requires authentication and returns no useful content)

### CI Cost Optimization

- **Expensive tests always run on main**: Pushes to main always trigger Playwright, visual, Lighthouse, a11y, and site-build-checks. These workflows also support `workflow_dispatch` for manual triggering from the Actions UI.
- **Per-commit CI labels on PRs**: On PRs, expensive tests only run when a CI label is _actively added_ (one-shot per commit, not persistent). Adding a label triggers tests for the current HEAD; the next push won't re-trigger unless the label is added again. Labels:
  - `ci:run-playwright` — Playwright integration tests only (Linux shards only on PRs)
  - `ci:run-visual` — Visual regression tests only (Linux shards only on PRs)
  - `ci:run-lighthouse` — Lighthouse performance/CLS/audit tests only
  - `ci:run-a11y` — Accessibility (pa11y) tests only
  - `ci:run-site-checks` — Site build checks and link validation only
  - `ci:full-tests` — All of the above

  Path filters further limit PR triggers to relevant file changes. **When creating a PR that modifies Playwright tests or interaction behavior, add the appropriate label** (e.g., `gh pr edit <number> --add-label "ci:run-playwright"`). Labels are per-commit: re-add to run again on the next push.
- **Flake check**: `workflow_dispatch` only (manual trigger via Actions UI). Not triggered by labels or PR events. Configurable `repeat-each` count (default 3).
- **Shared builds**: Playwright, visual testing, and site-build-checks each build the site once and share the artifact across shards/jobs.
- **Path filters**: PR workflows only trigger when relevant files change. Each workflow lists only the `config/` subdirectories it actually uses. Build/deploy workflows exclude test files from triggering.
- **Skip CI**: Use `[skip ci]` in commit messages to skip all workflows for a commit.

## Design Philosophy

Per `.cursorrules` and `design.md`:

- Minimal, targeted changes only
- Verify all information before generating code
- Derive style from existing codebase
- Security-first approach
- Modern best practices with explicit typing
- No unnecessary refactoring or whitespace changes

## Development Practices

### Before Writing Code

- Ask clarifying questions if uncertain about scope or approach
- Check for existing libraries before rolling custom solutions
- Look for existing patterns in the codebase before creating new ones

### Documentation

- When modifying functionality described in `website_content/design.md`, update that file to reflect the changes
- The design document explains implementation details for site features, deployment pipeline, and CI/CD workflows

### Code Style

- Prefer throwing errors that "fail loudly" over logging warnings for critical issues
- Un-nest conditionals where possible; combine related checks into single blocks
- Create shared helpers when the same logic is needed in multiple places
- In TypeScript/JavaScript, avoid `!` field assertions (flagged by linter) - use proper null checks instead
- **Never add backward-compatibility re-exports** (e.g., `export { foo } from "./other-module"`). Update imports at the call site instead
- **Prefer immutable types** for collections that are built once and only read: `ReadonlySet`, `ReadonlyMap`, `readonly T[]`, `Readonly<Record<K,V>>`, `as const`. In Python: `frozenset`, `tuple`, `frozendict`. Function parameters should accept `readonly` types when they don't mutate the input.

### Error Handling

- **Never use empty catch blocks** - errors should either be handled or propagated
- Don't catch exceptions just to ignore them - if an error isn't expected to occur, let it fail loudly
- Only catch specific errors you know how to handle; let unexpected errors propagate
- If you must catch for cleanup, rethrow the error after cleanup
- Don't use try/catch to silence errors unless there's a specific, documented reason

### Testing

- Parametrize tests using `it.each()` for maximum compactness while achieving high coverage
- Write focused, non-duplicative tests
- **NEVER update test expectations without asking the user first.**
- **NEVER lower CI thresholds or weaken assertions to make tests pass.** Fix the underlying issue instead — improve site performance, fix flaky test logic, etc. Cheap shortcuts like lowering Lighthouse score thresholds or loosening test criteria are not acceptable.

### Dependencies

- Use pnpm (not npm) for all package operations

## Lessons Learned

- When making interface array properties `readonly`, you must also update downstream function signatures to accept `readonly` arrays. Most array methods (`.map()`, `.filter()`, `.some()`, `.includes()`) work on readonly arrays, but mutating methods (`.sort()`, `.push()`) don't — copy first: `[...arr].sort()`.
