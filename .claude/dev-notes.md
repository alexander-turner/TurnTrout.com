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

Three ways to approve baselines (all promote the named visual-testing run's `*-actual.png` artifacts to R2):

1. **`/approve-baselines` PR comment** — easiest on PRs.
2. **"Approve baselines" button on the diff gallery** — works for both PR and main galleries. Stores a GitHub PAT (`actions:write` scope) in `localStorage` on first click and POSTs to the GitHub API to dispatch `update-visual-baselines.yaml`.
3. **Actions UI `workflow_dispatch`** — manual fallback. Supply the `run_id` of the visual-testing run whose actuals to adopt; optionally a `pr_number` to also retrigger that PR.

For PR runs the workflow also pushes an empty commit to the PR branch so visual-testing reruns immediately. For main runs it can't push (would pollute history), so it instead calls the GitHub API to `rerun` the visual-testing run and `rerun-failed-jobs` on the same-commit `deploy.yaml` run — once visual-testing passes against the new baselines, `verify-test-results` polls succeed and the `deploy` job runs.

## Pre-push validation pipeline

When pushing to main, `scripts/run_push_checks.py` runs:

1. **Sequential auto-fix steps** — ruff, eslint `--fix`, docformatter `--in-place`, stylelint `--fix`, prettier (SCSS/TS/Markdown). Each commits its own diff. ESLint and stylelint still exit non-zero on remaining unfixable errors, so they double as gates.
2. **Sequential prep** — `pnpm exec tsx quartz/styles/generate-variables.ts` regenerates `quartz/styles/variables.scss` because `source_file_checks.py` reads it.
3. **Parallel verify group** (read-only, runs concurrently via `ThreadPoolExecutor`):
   - `pylint` (matches `python-lint.yaml` CI invocation: `pylint .` with `config/python/.pylintrc`).
   - `mypy` (uses the `dmypy` daemon pre-warmed by `session-setup.sh`).
   - `source_file_checks.py` (frontmatter / dates / asset refs / fonts).
   - `scripts/run_spellcheck_and_vale.sh` (strips `[!quote]` callouts, runs spellchecker-cli and Vale concurrently inside the wrapper).
4. **Sequential tail** — asset compression + R2 upload (skipped if `rclone` not present), alt-text scan (LLM; requires `alt-text-llm`).

Failures inside the parallel group don't short-circuit — every sibling finishes so one push reports every problem.

Heavier checks (Jest, Playwright, built-site checks, link validation) run in CI.

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
- macOS WebKit runs Desktop Safari only — Playwright 1.58+ crashes on mobile device emulation on ARM64
- Visual regression with Playwright snapshots (R2 baselines)
- Lighthouse for layout shift
- DeepSource static analysis. Use the `deepsource` CLI with `--commit`, `--pr`, or `--default-branch`. **Never** WebFetch DeepSource URLs — the web UI is auth-walled and returns no useful content.

### How CI runs

Public-repo Actions are free, so we don't tier coverage by event — every workflow runs the full suite whenever its `paths:` filter matches.

- **Full suite on every PR and `push: main`**: Linux Chromium + Firefox plus macOS WebKit shards for Playwright/visual; full a11y, lighthouse, site-build-checks, python-tests, python-lint, lint, Node.js. `.github/actions/ci-gate` is now a constant — `run=true`, `run-macos=true`, `browsers=chromium,firefox` for every event.
- **Bot skip**: `should-run` skips dependabot/renovate/deepsource branches so lockfile bumps don't churn the visual baselines.
- **Flake check**: `workflow_dispatch` only.
- **Shared builds**: Playwright, visual testing, and site-build-checks each build the site once and share the artifact across shards.
- **Path filters**: every workflow has `paths:` on its `pull_request` trigger so doc-only / CI-only PRs don't fire the heavy suites.
- **Skip CI**: `[skip ci]` in commit messages.

### Merging PRs

`main` is gated by required-status-check branch protection plus auto-merge — there's **no merge queue** (the feature isn't enabled in this repo).

- **How to merge**: call `mcp__github__enable_pr_auto_merge` once the PR is green. GitHub waits for required checks to pass on the PR head SHA, then squashes.
- **Required checks**: `playwright-tests`, `visual-testing`, `a11y`, `site-build-checks`, `python-tests`, `python-lint`, `lint`, `Node.js CI / build`, lighthouse jobs. Each runs on every PR (subject to `paths:` filters) so they report on the same SHA auto-merge waits on.
- **Compatibility with auto-merge bots**: `auto-merge-dependabot.yml` uses `gh pr merge --auto --squash`, same mechanism.
- **Post-merge**: `push: main` re-runs the full suite plus `deploy.yaml`. `deploy.yaml`'s `verify-test-results` job polls check-runs on the landed SHA, so deploy waits for those to pass before pushing to Cloudflare.

## Lessons learned

- When making interface array properties `readonly`, also update downstream function signatures to accept `readonly` arrays. `.map()`/`.filter()`/`.some()`/`.includes()` work on readonly; `.sort()`/`.push()` don't — copy first: `[...arr].sort()`.
