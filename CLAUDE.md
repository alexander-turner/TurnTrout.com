# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal blog/website (turntrout.com) built on Quartz, a static site generator. The codebase contains TypeScript (Quartz customizations and plugins) and Python (asset processing, validation) components.

## Development Commands

### Building & Running

```bash
pnpm dev          # Development server with hot reload
pnpm build        # Production build
pnpm start        # Build and serve locally on port 8080
pnpm preview      # Build and serve
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
- Runs comprehensive validation (tests, linting, spellcheck, link validation)
- Compresses/uploads assets to CDN
- Can resume from last failure: `RESUME=true git push`

## Content Structure

- **`website_content/`**: Markdown source files with YAML frontmatter
- **`public/`**: Built static site output
- Supports Obsidian-flavored Markdown with custom extensions (spoilers, subtitles, table captions)

## Testing Requirements

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

1. TypeScript: ESLint, type checking, 100% branch coverage tests
2. Python: mypy, pylint (10/10), ruff, 100% line coverage
3. Spellcheck with whitelisting
4. Vale prose linting (no clichés, unnecessary adverbs)
5. Markdown link validation
6. Frontmatter validation
7. CSS variable validation
8. Built site checks (no localhost links, all favicons wrapped, etc.)
9. Internal link validation with `linkchecker`
10. Asset compression and CDN upload

## GitHub Actions (Post-push)

After pushing to main:

- **Publication date updates**: Automatically updates `date_published` and `date_updated` fields in article frontmatter
- 1,602 Playwright tests across 9 configurations (3 browsers × 3 viewport sizes)
- Tests run on ~40 parallel shards to complete in ~10 minutes
- Visual regression testing with `lost-pixel`
- Lighthouse checks for minimal layout shift
- DeepSource static analysis (use the forked `deepsource` CLI to check issues — **never** try to fetch DeepSource URLs via `WebFetch`, the web UI requires authentication and returns no useful content)

### CI Cost Optimization

- **Playwright/visual tests on PRs**: These only run when the `ci:full-tests` label is added to a PR. They always run on push to main/dev and in the merge queue.
- **Shared builds**: Playwright, visual testing, and site-build-checks each build the site once and share the artifact across shards/jobs.
- **Path filters**: Workflows only trigger when relevant files change. Playwright tests skip content-only changes.
- **Skip CI for docs-only changes**: Commits that only touch documentation files (README, CLAUDE.md, `.hooks/`, `.cursorrules`, `asset_staging/`) will not trigger CI workflows due to path filters. When creating PRs with only such changes, note that CI checks will be skipped.
- **Merge queue**: The repository uses GitHub merge queue. All required checks have `merge_group` triggers so they run in the merge queue context.

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

### Dependencies

- Use pnpm (not npm) for all package operations
