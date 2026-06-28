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
- **Validation**: `source_file_checks.py`, `built_site_checks.py`; internal links via `linkchecker.fish`
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

- Assets staged in `asset_staging/` during editing
- compress → strip EXIF → upload to Cloudflare R2 → update Markdown refs
- Images converted to AVIF (10× compression vs PNG)
- Videos: WEBM for most browsers, MP4 for Safari
- Invert-labeled rasters get a precomputed `<basename>-inverted.<ext>`
  sibling via `scripts/generate_inverted_variants.py`, run automatically by
  `handle_assets.sh` after `convert_assets.py`. For a one-shot backfill of
  assets already on R2: `uv run scripts/generate_inverted_variants.py
--asset-directory ~/Downloads/website-media-r2`, then re-run `r2_upload`
  to push the new `-inverted` files.

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

## Mutation, property, and fuzz testing

Property-based/fuzz tests live alongside the regular suites and run in CI like any other test:

- TypeScript: `*.property.test.ts` files using **fast-check**. Each file pins `fc.configureGlobal({ seed: ... })` so runs are deterministic (zero-flakiness policy). Note: `fc.stringMatching` rejects `i`-flagged regexes, which conflicts with the `regexp/use-ignore-case` ESLint autofix—use `fc.string({ unit: fc.constantFrom(...chars) })` for mixed-case alphabets instead.
- Python: `scripts/tests/test_*_properties.py` using **hypothesis** with a `derandomize=True` profile (also `database=None` + `suppress_health_check=[HealthCheck.differing_executors]` so mutmut can re-run them in-process).

Mutation testing is run on demand, not in CI:

```bash
# TypeScript (Stryker; mutated files + reduced test set in the configs)
NODE_OPTIONS="--experimental-vm-modules --no-warnings" \
  pnpm exec stryker run config/javascript/stryker.config.json
# report: reports/mutation/mutation.json + clear-text summary on stdout

# Python (mutmut; config under [tool.mutmut] in pyproject.toml)
rm -rf mutants && uv run mutmut run
uv run mutmut results            # list survivors
uv run mutmut show <mutant-id>   # diff of one mutant
```

Gotchas learned the hard way:

- Stryker `ignorePatterns` use gitignore semantics: a bare `tests` entry excludes **every** `tests/` directory (including `quartz/plugins/transformers/tests/`), silently dropping those suites from the sandbox and reporting their mutants as "no coverage". Anchor root-level dirs with a leading slash (`/tests`).
- Stryker needs `"plugins": ["@stryker-mutator/jest-runner"]` spelled out; with pnpm the default `@stryker-mutator/*` resolution fails in child processes.
- The sandbox copy chokes on directory symlinks (`.husky -> .hooks`); keep them in `ignorePatterns`.
- `config/javascript/jest.stryker.config.js` restricts `testMatch` to the suites covering the mutated modules and disables coverage thresholds—update it when adding mutation targets.
- mutmut runs pytest from a `mutants/` copy of the tree: `also_copy` must include everything tests import (`scripts/tests/`, `scripts/utils.py`, `config/`), and `pytest_add_cli_args = ["-o", "addopts="]` clears the repo-wide `--cov`/`-n auto` addopts that break its in-process stats collector.
- Expect a few semantically equivalent survivors (e.g. mutating a redundant `lstrip` whose effect the following loop already subsumes); document rather than chase them.

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

## Commit timestamping (OpenTimestamps, async)

`git commit` enqueues the commit hash and hands off to a **detached** background worker (`.hooks/post-commit` → `.hooks/timestamp-worker.sh`), so the commit returns immediately instead of blocking ~3s on network I/O. The worker holds a single `mkdir` lock (portable; `flock` is absent on macOS), drains every queued hash, creates each OpenTimestamps proof (`ots stamp`), commits it into the `.timestamps` repo, then pushes the whole batch in **one** pull/push.

State lives under `$(git rev-parse --git-dir)/ots-timestamps/`: `queue` (pending hashes), `lock.d/` (worker lock), `worker.log` (errors only—a clean success writes nothing). Best-effort by design: a failed stamp re-queues its hash, a failed push leaves the proof committed-but-unpushed, and the next commit's worker retries via `has_unpushed`. A commit is never rolled back, so no commit loses its eventual proof. Skipped entirely when `CI=true`. If proofs are missing, check `worker.log`; re-trigger by committing, or run the worker directly with `OTS_GIT_ROOT`/`OTS_STATE_DIR` set.

## Pre-push validation pipeline

When pushing to main, `scripts/run_push_checks.py` runs:

1. **Sequential auto-fix steps**—ruff, eslint `--fix`, docformatter `--in-place`, stylelint `--fix`, prettier (SCSS/TS/Markdown). Each commits its own diff. ESLint and stylelint still exit non-zero on remaining unfixable errors, so they double as gates.
2. **Sequential prep** — `pnpm exec tsx quartz/styles/generate-variables.ts` regenerates `quartz/styles/variables.scss` because `source_file_checks.py` reads it.
3. **Parallel verify group** (read-only, runs concurrently via `ThreadPoolExecutor`):
   - `pylint` (matches `python-lint.yaml` CI invocation: `pylint .` with `config/python/.pylintrc`).
   - `pyright` (type-checks `scripts/`; config in `pyproject.toml`'s `[tool.pyright]`).
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

Public-repo Actions are free, so we don’t tier coverage by event. Path-awareness lives at the **job** level, not the trigger: every required-check workflow always triggers on `pull_request` (so its check context is always created), then a job-level gate decides whether the expensive jobs run or report `skipped`.

- **Why not trigger-level `paths:`**: a workflow filtered out by a trigger-level `paths:` filter never starts, so its required check context is never created and branch protection hangs at “Expected — Waiting” forever. A required check is satisfied only by `success` or `skipped`, so the fix is to always trigger and let the gate emit `skipped`—never to filter the trigger.
- **Path gate (`.github/actions/ci-gate`)**: on a `pull_request` it runs `dorny/paths-filter` over the workflow’s relevant-path globs (passed in via the `filters:` input) and outputs `run=true` only when relevant files changed. `push` / `workflow_dispatch` always get `run=true` (full coverage). The `ci:full-tests` / `ci:run-*` labels (the `force-labels:` input) force `run=true` regardless of paths.
- **How the skip surfaces**: workflows with a unified `if: always()` status job (`playwright-tests`, `visual-testing`, `a11y`, `site-build-checks`) exit 0 from that job when `run=false`. `python-tests` / `python-lint` / `lint` gate the required job itself on a `detect-changes` (dorny) output, so the job reports `skipped`. `deploy.yaml` gates `deploy-build` / `prepare-deploy` on a `should-run` (ci-gate) job, so on an irrelevant PR they report `skipped` (no preview deploy) while the context is still created; `push` always gates `run=true`, so production deploys are never skipped. `preview-audits` lets `build` → `deploy` → lighthouse skip down the `needs` chain. **Node is special**: its required check `build (<version>)` is a matrix job, and skipping a matrixed job at the job level can report under the bare name—so `build` always runs (context always created) and the gate skips only the inner `Setup site` / `Run tests` steps, leaving the job green.
- **Bot skip**: `should-run` skips dependabot/renovate/deepsource branches so lockfile bumps don’t churn the visual baselines; the status jobs treat a skipped `should-run` as a pass.
- **Flake check**: `workflow_dispatch` only.
- **Shared builds**: Playwright, visual testing, and site-build-checks each build the site once and share the artifact across shards.
- **Skip CI**: `[skip ci]` in commit messages.

### Merging PRs

`main` is gated by required-status-check branch protection plus auto-merge—there’s **no merge queue** (the feature isn’t enabled in this repo).

- **How to merge**: call `mcp__github__enable_pr_auto_merge` once the PR is green. GitHub waits for required checks to pass on the PR head SHA, then squashes.
- **Required checks**: `playwright-tests`, `visual-testing`, `a11y`, `site-build-checks`, `python-tests`, `python-lint`, `lint-and-validate.yaml`, `Node tests / build`, lighthouse jobs. Each workflow always triggers on a PR and gates internally (see “How CI runs”), so every required context reports `success` or `skipped` on the same head SHA auto-merge waits on—none can hang uncreated.
- **Compatibility with auto-merge bots**: `auto-merge-dependabot.yml` uses `gh pr merge --auto --squash`, same mechanism.
- **Post-merge**: `push: main` re-runs the full suite plus `deploy.yaml`. `deploy.yaml`’s `verify-test-results` job polls check-runs on the landed SHA, so deploy waits for those to pass before pushing to Cloudflare.

## Outbound link archiving (build-time fallback)

`quartz/plugins/transformers/archiveLinks.ts` rewrites confirmed-dead outbound
links to a self-hosted archived copy at build time (no client JS). It reads
`config/link_archive_manifest.json` once per build; for each external `<a>` whose
canonical href is in the manifest with `dead: true`, it swaps the `href` for the
archived `archive_url`, adds an `archived` class, and records the original in
`data-original-href`. Live/unknown links are untouched, so with the committed
empty manifest the transformer is a no-op.

The manifest is produced by a separate writer (ArchiveBox + R2), shipped in its
own PR. Canonicalization uses the WHATWG `new URL` parser; the writer mirrors it
with the same `ada` parser so the keys match.

## Tweet embeds (self-hosted, tracking-free)

Author a tweet with a ` ```tweet ` fenced block holding one tweet URL per line
(several lines render as a connected thread):

````md
```tweet
https://x.com/turntrout/status/1881825910040702979
retweeted-by: Jeff Dean
```
````

An optional `retweeted-by: <name>` line attaches a "<name> retweeted" header to
the tweet above it (the API can't supply retweet context, so it's manual). The
card also shows the reply and like counts captured at snapshot time; the
cookie-free endpoint doesn't expose retweet or view counts, so those are omitted.

`quartz/plugins/transformers/tweetEmbed.ts` (registered before
`SyntaxHighlighting`) replaces each block with a site-native card built in
`tweetCard.ts`. The build is fully decoupled from Twitter: it reads a normalized
JSON snapshot from `quartz/plugins/transformers/.tweet_snapshots/<id>.json` and
renders from that. A referenced tweet with no snapshot **fails the build** (so a
forgotten capture can't silently ship a degraded card); prefix the line with
`unavailable:` to opt a deleted-before-capture tweet into the xcancel-link stub.

Snapshots are captured by `scripts/tweet_snapshot.py`, which fetches the post
from X's cookie-free syndication endpoint, mirrors the avatar + photos/video to
R2 under `static/tweets/<id>/`, rewrites every media URL to `assets.turntrout.com`
(the only media host `built_site_checks` allows), and writes the snapshot JSON.
Resolution order: a pinned (already-present) snapshot is authoritative; otherwise
live fetch then public CDN (`static/tweets/<id>.json`) then skip (stub).

- **Add a tweet locally:** `uv run python scripts/tweet_snapshot.py` (no `--write`
  pulls/creates snapshots without touching R2). With R2 env vars + `--write` it
  also uploads. Commit the resulting `<id>.json` with `git add -f` (the
  `.tweet_snapshots/` dir is gitignored) to pin it; pinned tweets render with
  zero Twitter/R2 dependency.
- **R2 refresh:** `.github/workflows/refresh-tweet-snapshots.yaml` runs
  `tweet_snapshot.py --write --force` on every push to `main` that touches content
  or the script, keeping the R2 backup (JSON + media) current without git churn.
- The committed example fixtures under `.tweet_snapshots/` drive the `test-page.md`
  examples and their `(screenshot)` baselines; their avatar/media point at existing
  CDN assets so the visual build is deterministic offline.

## Lessons learned

- When making interface array properties `readonly`, also update downstream function signatures to accept `readonly` arrays. `.map()`/`.filter()`/`.some()`/`.includes()` work on readonly; `.sort()`/`.push()` don’t—copy first: `[...arr].sort()`.
- **Cloudflare Speed Brain refuses `<link rel="prefetch">` to cross-origin assets.** Browsers send `Sec-Purpose: prefetch` for `rel="prefetch"`; CF intercepts at the edge and returns a bare 503 with `cf-speculation-refused: prefetch refused: not eligible`, which Chromium surfaces as a CORS error (the 503 has no `Access-Control-Allow-Origin`). Local Playwright tests and direct `curl` probes never hit this path—only real browsers going through the CF edge do. Use `rel="preload"` for current-page assets you’d otherwise prefetch; preload doesn’t carry the `Sec-Purpose` header and isn’t intercepted. Symptom to watch for in DevTools Network: status 503, `Cf-Speculation-Refused` response header, `Vary: sec-purpose`, `Server: cloudflare`.

## Per-section visual fixtures

`website_content/test-page.md` is the single human-edited source of truth for
visual-regression content. `scripts/split_test_page_sections.py` slices it on
top-level (`#`) headings into one fixture page per section under
`website_content/fixtures/test-sections/` (permalink `test-section-<slug>`).
Each section is its own page, so a Playwright screenshot of one section is
unaffected by edits to—or reordering of—any other section
(`quartz/components/tests/section-fixtures.spec.ts` screenshots each in both
themes). `test-page.md` itself stays the integration shot: the `Normal page in
{theme}` test in `visual-regression.spec.ts` takes a single viewport screenshot
of its top (cross-section / header coverage), **not** a `fullPage` capture — no
test in the suite passes `fullPage`, so a bare `takeRegressionScreenshot` shoots
only the viewport.

This replaced the old `getH1Screenshots` / `wrapH1SectionsInSpans` helpers, which
screenshotted each section in-place on one page. The per-section fixtures do that
job with true isolation, so those helpers were removed. **DOM isolation
(`performDOMIsolation` / `elementToScreenshot` / `preserveSiblings`) stays** — it
is still needed by every element-scoped screenshot taken on a shared page
(popovers, search previews, sidebar, etc.); it is only redundant _on the fixture
pages themselves_, where nothing else is on the page to hide.

The fixtures under `website_content/fixtures/test-sections/` are **not tracked
in git** (`.gitignore`) — they're pure derivatives of `test-page.md`, so
committing them only created churn and a drift surface. They're regenerated
wherever they're needed:

- **CI**: the reusable `generate-fixtures.yaml` workflow runs the generator
  once and uploads a `section-fixtures` artifact. The `build` job and every
  Playwright shard (visual, playwright-tests, flake-check) depend on that job
  and pull the artifact via the `download-section-fixtures` composite action.
  Even non-screenshot shards need it: Playwright collects
  `section-fixtures.spec.ts` (then grep-filters it out) and that spec reads the
  directory at module load.
- **Locally**: the Playwright `webServer` command regenerates them before
  `pnpm start`, so `pnpm test:visual` works from a clean checkout.

So after editing `test-page.md` there's nothing to commit for the fixtures — just
run the generator if you want to preview locally:

```bash
uv run python scripts/split_test_page_sections.py
```

The generator pulls each section's referenced footnote definitions in
(transitively) so sections render standalone; sections that reference other
sections (e.g. `Transclusion`) are listed in `SKIP_HEADINGS` and live only on
the integration page.
