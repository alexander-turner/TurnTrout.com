# Dev notes (read on demand)

CLAUDE.md is loaded every turn, so detail that’s only occasionally needed lives here. Read this file when working on the relevant area.

## Architecture

### Quartz plugin pipeline (TypeScript)

Three stages: **Transform → Filter → Emit**.

- **Transformers** (`quartz/plugins/transformers/`): operate on MDAST/HAST. Examples: twemoji, color variables, link favicons, table captions, spoilers, subtitles.
- **Filters** (`quartz/plugins/filters/`): e.g. drop drafts.
- **Emitters** (`quartz/plugins/emitters/`): generate HTML pages, RSS, sitemap, aliases.
- **Core build** (`quartz/build.ts`) orchestrates with the dependency graph in `quartz/depgraph.ts`.
- **Components** (`quartz/components/`): React/Preact UI.

### Python scripts (`scripts/`)

- **Asset processing**: `convert_assets.py`, `compress.py`, `r2_upload.py`
- **Validation**: `check_internal_links.py`, `source_file_checks.py`, `built_site_checks.py`, `scan_for_empty_alt.py`
- **Pre-push orchestration**: `run_push_checks.py`
- **Alt-text**: handled by the PyPI package `alt-text-llm`.

### Build pipeline

1. Parse Markdown with frontmatter
2. Apply transformer plugins to MDAST/HAST
3. Filter content
4. Emit HTML pages and assets
5. Inline critical CSS server-side
6. Generate RSS/sitemap

### Asset management

- Assets staged in `asset_staging/` during editing
- compress → strip EXIF → upload to Cloudflare R2 → update Markdown refs
- Images converted to AVIF (10× compression vs PNG)
- Videos: WEBM for most browsers, MP4 for Safari

### Text processing

- Smart quotes (custom regex, 45 unit tests)
- Auto-smallcaps for 3+ consecutive capitals (excluding Roman numerals)
- Hyphen → en-dash/em-dash
- EB Garamond dropcaps via CSS pseudo-elements

### Site features

- Server-side KaTeX, Mermaid, Twemoji
- Inline favicons next to external links
- Internal-link popovers
- Zero layout shift (asset dimensions pre-calculated)

### Configuration files

- `config/quartz/quartz.config.ts`: transformer/emitter/filter pipeline
- `config/quartz/quartz.layout.ts`: page layout
- `config/typescript/tsconfig.json`: strict TS, Preact JSX
- `config/javascript/jest.config.js`: enforces 100% coverage thresholds (see `coveragePathIgnorePatterns` for excluded paths)

## Running tests locally

Prefer **targeted** runs over the full suite. CI runs Jest, pytest, Playwright, visual regression, a11y, lighthouse, etc. on every PR (see “GitHub Actions” below), so a local full-suite run mostly duplicates that and burns time. Target the file you touched:

```bash
# Jest — single file
node --experimental-vm-modules --no-warnings --localstorage-file=/tmp/jest-localstorage.json \
  node_modules/jest/bin/jest.js --config config/javascript/jest.config.js \
  --testPathPattern 'renderPage.test.tsx' --no-coverage

# pytest — single file
uv run pytest scripts/tests/test_something.py

# Playwright — single test by name (see section below for server setup)
npx playwright test --config config/playwright/playwright.config.ts -g "test name pattern"
```

`pnpm check` (typecheck + prettier + stylelint) is cheap and worth running locally before pushing; the bulk test suites are not.

## Running Playwright tests locally

```bash
npx playwright install chromium firefox
npx playwright install-deps webkit
npx playwright install webkit
```

Start the local server in offline mode (uses Playwright’s Chromium for critical CSS):

```bash
PUPPETEER_EXECUTABLE_PATH=$(find ~/.cache/ms-playwright -name "chrome" -path "*/chrome-linux/*" | head -1) \
  npx tsx quartz/bootstrap-cli.ts build --serve --offline &
```

Wait for `http://localhost:8080`, then:

```bash
npx playwright test --config config/playwright/playwright.config.ts -g "test name pattern"
```

## Offline builds

For sandboxed sessions / CI without network:

```bash
PUPPETEER_EXECUTABLE_PATH=$(find ~/.cache/ms-playwright -name "chrome" -path "*/chrome-linux/*" | head -1) \
  npx tsx quartz/bootstrap-cli.ts build --offline
```

## Visual regression testing

Uses Playwright’s native `toMatchSnapshot`. Baselines live in Cloudflare R2 (`r2:turntrout/visual-baselines/`); `tests/visual-baselines/` is gitignored. CI downloads baselines via `scripts/r2_baselines.py download`. On mismatch, CI uploads a merged HTML diff report as the `visual-diff-report` artifact and surfaces an “Approve baselines” link in the failed run’s step summary (and as a PR comment on PRs).

Two ways to approve baselines (both promote the named visual-testing run’s `*-actual.png` artifacts to R2):

1. **“Approve these as baselines” button on the diff gallery**—primary path. POSTs to `/api/approve-baselines`, a same-origin Pages Function (source: `cloudflare/functions/api/approve-baselines.ts`, copied into `playwright-report/functions/api/` by `visual-testing.yaml` pre-deploy). The function checks the run is from `visual-testing.yaml` and the gallery isn’t stale—PR must be `open`, or for main runs `head_sha` must match main’s current HEAD—then dispatches `update-visual-baselines.yaml` with a server-held PAT. An old merged-PR gallery URL can’t reset baselines (closed-PR check rejects it).
2. **Actions UI `workflow_dispatch`**—manual fallback. Supply the `run_id` of the visual-testing run whose actuals to adopt; optionally a `pr_number` to also retrigger that PR.

**Proxy config**—set once in the Cloudflare Pages dashboard, scoped to **Preview** so it ships with `visual-*` branches only:

- `GH_DISPATCH_PAT` (secret)—fine-grained PAT, scopes `Actions: write` + `Pull requests: read` + `Metadata: read` + `Contents: read`. The repo (`alexander-turner/TurnTrout.com`) is hardcoded in the function. Missing PAT yields a 500 “misconfigured” pill on the gallery.

For PR runs the workflow pushes an empty commit to the PR branch so visual-testing reruns immediately. For main runs it can’t push (would pollute history); instead it (a) posts a synthetic passing `visual-testing` check-run on the head commit (the just-uploaded actuals ARE the new baselines, so rerunning would always pass—skip the wait), then (b) `rerun-failed-jobs` on the same-commit `deploy.yaml` run. `verify-test-results` polls `sort_by(.started_at) | last`, so the new success wins; `deploy` unblocks.

**Shard status vs. overall status.** Individual `visual-testing-(linux|macos)` shards stay green when the only failures are new or updated screenshots—those are expected outcomes that the diff-gallery + approve button is designed for, and red shards turn into noise. Each shard runs `scripts/classify_visual_failures.py` over its blob report and only exits non-zero for real failures (timeouts, page errors, exceptions before the screenshot assertion). The `aggregate-visual-results` job collects per-shard status artifacts and the overall `visual-testing` status + `publish-visual-report` deploy carry the snapshot-diff signal forward.

## Pre-push validation pipeline

When pushing to main, `scripts/run_push_checks.py` runs:

1. **Sequential auto-fix steps**—ruff, eslint `--fix`, docformatter `--in-place`, stylelint `--fix`, prettier (SCSS/TS/Markdown). Each commits its own diff. ESLint and stylelint still exit non-zero on remaining unfixable errors, so they double as gates.
2. **Sequential prep** — `pnpm exec tsx quartz/styles/generate-variables.ts` regenerates `quartz/styles/variables.scss` because `source_file_checks.py` reads it.
3. **Parallel verify group** (read-only, runs concurrently via `ThreadPoolExecutor`):
   - `pylint` (matches `python-lint.yaml` CI invocation: `pylint .` with `config/python/.pylintrc`).
   - `mypy` (uses the `dmypy` daemon pre-warmed by `session-setup.sh`).
   - `source_file_checks.py` (frontmatter / dates / asset refs / fonts).
   - `scripts/run_spellcheck_and_vale.sh` (strips `[!quote]` callouts, runs spellchecker-cli and Vale concurrently inside the wrapper).
4. **Sequential tail**—asset compression + R2 upload (skipped if `rclone` not present), alt-text scan (LLM; requires `alt-text-llm`).

Failures inside the parallel group don’t short-circuit—every sibling finishes so one push reports every problem.

Heavier checks (Jest, Playwright, built-site checks, link validation) run in CI.

## CI monitoring

After pushing, **always monitor CI until checks pass or fail**. Claude Code’s native CI watch surfaces failures on the open PR; the Stop hook only enforces local checks (test / lint / typecheck / ruff / pytest).

Manual check:

```bash
gh run list --branch <branch> --commit <sha> --json name,status,conclusion
gh run view <run-id> --log-failed
```

## GitHub Actions (post-push)

After pushing to main:

- **Publication date updates**: amends the commit with updated `date_published`/`date_updated` and force-pushes; other workflows restart on the amended commit via `cancel-in-progress`
- 1,602 Playwright tests across 9 configurations (3 browsers × 3 viewports), ~33 parallel shards
- macOS WebKit runs Desktop Safari only—Playwright 1.58+ crashes on mobile device emulation on ARM64
- Visual regression with Playwright snapshots (R2 baselines)
- Lighthouse for layout shift
- DeepSource static analysis. Use the `deepsource` CLI with `--commit`, `--pr`, or `--default-branch`. **Never** WebFetch DeepSource URLs—the web UI is auth-walled and returns no useful content.

### How CI runs

Public-repo Actions are free, so we don’t tier coverage by event—every workflow runs the full suite whenever its `paths:` filter matches.

- **Full suite on every PR and `push: main`**: Linux Chromium + Firefox plus macOS WebKit shards for Playwright/visual; full a11y, lighthouse, site-build-checks, python-tests, python-lint, lint, Node.js. `.github/actions/ci-gate` is now a constant—`run=true`, `run-macos=true`, `browsers=chromium,firefox` for every event.
- **Bot skip**: `should-run` skips dependabot/renovate/deepsource branches so lockfile bumps don’t churn the visual baselines.
- **Flake check**: `workflow_dispatch` only.
- **Shared builds**: Playwright, visual testing, and site-build-checks each build the site once and share the artifact across shards.
- **Path filters**: every workflow has `paths:` on its `pull_request` trigger so doc-only / CI-only PRs don’t fire the heavy suites.
- **Skip CI**: `[skip ci]` in commit messages.

### Merging PRs

`main` is gated by required-status-check branch protection plus auto-merge—there’s **no merge queue** (the feature isn’t enabled in this repo).

- **How to merge**: call `mcp__github__enable_pr_auto_merge` once the PR is green. GitHub waits for required checks to pass on the PR head SHA, then squashes.
- **Required checks**: `playwright-tests`, `visual-testing`, `a11y`, `site-build-checks`, `python-tests`, `python-lint`, `lint`, `Node.js CI / build`, lighthouse jobs. Each runs on every PR (subject to `paths:` filters) so they report on the same SHA auto-merge waits on.
- **Compatibility with auto-merge bots**: `auto-merge-dependabot.yml` uses `gh pr merge --auto --squash`, same mechanism.
- **Post-merge**: `push: main` re-runs the full suite plus `deploy.yaml`. `deploy.yaml`’s `verify-test-results` job polls check-runs on the landed SHA, so deploy waits for those to pass before pushing to Cloudflare.

## Lessons learned

- When making interface array properties `readonly`, also update downstream function signatures to accept `readonly` arrays. `.map()`/`.filter()`/`.some()`/`.includes()` work on readonly; `.sort()`/`.push()` don’t—copy first: `[...arr].sort()`.
- **Cloudflare Speed Brain refuses `<link rel="prefetch">` to cross-origin assets.** Browsers send `Sec-Purpose: prefetch` for `rel="prefetch"`; CF intercepts at the edge and returns a bare 503 with `cf-speculation-refused: prefetch refused: not eligible`, which Chromium surfaces as a CORS error (the 503 has no `Access-Control-Allow-Origin`). Local Playwright tests and direct `curl` probes never hit this path—only real browsers going through the CF edge do. Use `rel="preload"` for current-page assets you’d otherwise prefetch; preload doesn’t carry the `Sec-Purpose` header and isn’t intercepted. Symptom to watch for in DevTools Network: status 503, `Cf-Speculation-Refused` response header, `Vary: sec-purpose`, `Server: cloudflare`.
