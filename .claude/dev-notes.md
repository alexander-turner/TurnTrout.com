# Dev notes (read on demand)

CLAUDE.md is loaded every turn, so detail that's only occasionally needed lives here. Read this file when working on the relevant area.

## Architecture

### Quartz plugin pipeline (TypeScript)

Three stages: **Transform → Filter → Emit**.

- **Transformers** (`quartz/plugins/transformers/`): operate on MDAST/HAST. Examples: twemoji, color variables, link favicons, table captions, spoilers, subtitles.
- **Filters** (`quartz/plugins/filters/`): e.g. drop drafts.
- **Emitters** (`quartz/plugins/emitters/`): generate HTML pages, RSS, sitemap, aliases.
- **Core build** (`quartz/build.ts`) orchestrates with the dependency graph in `quartz/depgraph.ts`.
- **Components** (`quartz/components/`): React/Preact UI.

### Python scripts (`scripts/`)

- **Asset processing**: `convert_assets.py`, `compress.py`, `r2_upload.py`
- **Validation**: `check_internal_links.py`, `source_file_checks.py`, `built_site_checks.py`, `scan_for_empty_alt.py`
- **Pre-push orchestration**: `run_push_checks.py`
- **Alt-text**: handled by the PyPI package `alt-text-llm`.

### Build pipeline

1. Parse Markdown with frontmatter
2. Apply transformer plugins to MDAST/HAST
3. Filter content
4. Emit HTML pages and assets
5. Inline critical CSS server-side
6. Generate RSS/sitemap

### Asset management

- Assets staged in `asset_staging/` during editing
- compress → strip EXIF → upload to Cloudflare R2 → update Markdown refs
- Images converted to AVIF (10x compression vs PNG)
- Videos: WEBM for most browsers, MP4 for Safari

### Text processing

- Smart quotes (custom regex, 45 unit tests)
- Auto-smallcaps for 3+ consecutive capitals (excluding Roman numerals)
- Hyphen → en-dash/em-dash
- EB Garamond dropcaps via CSS pseudo-elements

### Site features

- Server-side KaTeX, Mermaid, Twemoji
- Inline favicons next to external links
- Internal-link popovers
- Zero layout shift (asset dimensions pre-calculated)

### Configuration files

- `config/quartz/quartz.config.ts`: transformer/emitter/filter pipeline
- `config/quartz/quartz.layout.ts`: page layout
- `config/typescript/tsconfig.json`: strict TS, Preact JSX
- `config/javascript/jest.config.js`: enforces 100% coverage thresholds (see `coveragePathIgnorePatterns` for excluded paths)

## Running Playwright tests locally

```bash
npx playwright install chromium firefox
npx playwright install-deps webkit
npx playwright install webkit
```

Start the local server in offline mode (uses Playwright's Chromium for critical CSS):

```bash
PUPPETEER_EXECUTABLE_PATH=$(find ~/.cache/ms-playwright -name "chrome" -path "*/chrome-linux/*" | head -1) \
  npx tsx quartz/bootstrap-cli.ts build --serve --offline &
```

Wait for `http://localhost:8080`, then:

```bash
npx playwright test --config config/playwright/playwright.config.ts -g "test name pattern"
```

## Offline builds

For sandboxed sessions / CI without network:

```bash
PUPPETEER_EXECUTABLE_PATH=$(find ~/.cache/ms-playwright -name "chrome" -path "*/chrome-linux/*" | head -1) \
  npx tsx quartz/bootstrap-cli.ts build --offline
```

## Visual regression testing

Uses Playwright's native `toMatchSnapshot`. Baselines live in Cloudflare R2 (`r2:turntrout/visual-baselines/`); `tests/visual-baselines/` is gitignored. CI downloads baselines via `scripts/r2_baselines.py download`. On mismatch, CI uploads a merged HTML diff report as the `visual-diff-report` artifact and surfaces an "Approve baselines" link in the failed run's step summary (and as a PR comment on PRs).

To approve: run the `Update visual baselines` workflow from the Actions UI (`workflow_dispatch`) with `ref` set to the branch (PR head ref, or `main`). The workflow regens baselines, uploads them to R2, and pushes an empty commit to retrigger visual-testing.

## Pre-push validation pipeline

When pushing to main, `scripts/run_push_checks.py` runs:

1. ruff (Python lint, fast)
2. ESLint `--fix`
3. docformatter `--in-place`
4. stylelint `--fix`
5. pylint (catches DeepSource issues before main goes red)
6. Asset compression and CDN upload (skipped if rclone not present)
7. Alt-text scan (LLM, requires API key)

Heavier checks (tests, spellcheck, link validation, built-site checks) run in CI.

## CI monitoring

After pushing, **always monitor CI until checks pass or fail**. The PostToolUse hook (`post-push-ci-watch.sh`) polls GitHub Actions after `git push` / `gh pr create`. Stop hook blocks completion if remote CI has failures for the last pushed commit.

Manual check:

```bash
gh run list --branch <branch> --commit <sha> --json name,status,conclusion
gh run view <run-id> --log-failed
```

## GitHub Actions (post-push)

After pushing to main:

- **Publication date updates**: amends the commit with updated `date_published`/`date_updated` and force-pushes; other workflows restart on the amended commit via `cancel-in-progress`
- 1,602 Playwright tests across 9 configurations (3 browsers × 3 viewports), ~33 parallel shards
- macOS runners (10x Linux cost) only run on pushes to main, not PRs. macOS WebKit runs Desktop Safari only — Playwright 1.58+ crashes on mobile device emulation on ARM64
- Visual regression with Playwright snapshots (R2 baselines)
- Lighthouse for layout shift
- DeepSource static analysis. Use the `deepsource` CLI with `--commit`, `--pr`, or `--default-branch`. **Never** WebFetch DeepSource URLs — the web UI is auth-walled and returns no useful content.

### CI cost optimization

- **Expensive tests always run on main**. They also support `workflow_dispatch` for manual triggering.
- **Per-commit CI labels on PRs**: expensive tests only run when a label is _actively added_ (one-shot per commit, not persistent). Labels:
  - `ci:run-playwright`, `ci:run-visual`, `ci:run-lighthouse`, `ci:run-a11y`, `ci:run-site-checks`
  - `ci:full-tests` (all of the above)
- **When a PR modifies Playwright tests or interaction behavior**, add the appropriate label: `gh pr edit <number> --add-label "ci:run-playwright"`. Re-add to run again on the next push.
- **Flake check**: `workflow_dispatch` only.
- **Shared builds**: Playwright, visual testing, and site-build-checks each build the site once and share the artifact across shards.
- **Path filters**: PR workflows only fire when relevant files change.
- **Skip CI**: `[skip ci]` in commit messages.

## Lessons learned

- When making interface array properties `readonly`, also update downstream function signatures to accept `readonly` arrays. `.map()`/`.filter()`/`.some()`/`.includes()` work on readonly; `.sort()`/`.push()` don't — copy first: `[...arr].sort()`.
