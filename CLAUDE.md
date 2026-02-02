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
pytest <path>               # Python tests (NOT python -m pytest)
```

**Python environment**: Always activate conda environment before running Python scripts:

```bash
conda init && conda activate website
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

**Hooks auto-configured**: Git hooks are automatically enabled via `.claude/settings.json` SessionStart hook. Manual setup: `git config core.hooksPath .hooks`

**Pre-commit**: Runs lint-staged formatters/linters on changed files

**Pre-push** (main branch only):

- Stashes uncommitted changes
- Runs comprehensive validation (tests, linting, spellcheck, link validation)
- Compresses/uploads assets to CDN
- Updates publication dates
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
11. Publication date updates

## GitHub Actions (Post-push)

After pushing to main:

- 1,602 Playwright tests across 9 configurations (3 browsers × 3 viewport sizes)
- Tests run on ~40 parallel shards to complete in ~10 minutes
- Visual regression testing with `lost-pixel`
- Lighthouse checks for minimal layout shift
- DeepSource static analysis

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

### Code Style

- Prefer throwing errors that "fail loudly" over logging warnings for critical issues
- Un-nest conditionals where possible; combine related checks into single blocks
- Create shared helpers when the same logic is needed in multiple places
- In TypeScript/JavaScript, avoid `!` field assertions (flagged by linter) - use proper null checks instead

### Testing

- Parametrize tests using `it.each()` for maximum compactness while achieving high coverage
- Write focused, non-duplicative tests

### Dependencies

- Use pnpm (not npm) for all package operations

### Pull Requests

When suggesting a PR, also consider your interaction with the user. Find the most important instruction mismatches, if any, which could be fixed in general with CLAUDE.md. Then edit CLAUDE.md to be more useful in the future.

Update the PR description whenever significant and relevant changes are made to keep it accurate. Provide the updated description in a markdown code block.
