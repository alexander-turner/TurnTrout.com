# ci-truth-serum

**Make your CI confess what it’s hiding.** A pack of fast, offline pre-commit
lints that catch two kinds of lie a green check can hide:

- **Honesty lies:** the pipeline reports success even though the real work
  failed — a failing command’s exit code gets hidden by a pipe — or a required
  check never reports at all and the PR hangs forever.
- **Identity lies:** a base image or downloaded file is pinned to a _mutable_
  name (a tag, a bare URL) that can change under you, so the bytes you run
  aren’t provably the bytes you reviewed.

## What it checks

### Honesty (Tier 1, default-on)

| Hook                              | Failure it prevents                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-workflow-pipefail`         | Catches a pipeline where a failing command’s exit code is hidden by the last command in the pipe. Example: `pytest \| tee log` reports `tee`’s success even if `pytest` crashed, so CI goes green. Fires when a `run:` step uses a shell that doesn’t set `pipefail`.                                                                                            |
| `check-exit-suppression`          | Catches `cmd \|\| true`, which throws away a command’s failure but keeps its output, so a broken step still reports success. Example: a cleanup step that failed to release a resource looks like it worked.                                                                                                                                                     |
| `check-stderr-suppression`        | Catches `cmd 2>/dev/null`, which throws away error messages. When the command fails you get a bare non-zero exit and no clue why. Example: `docker compose up 2>/dev/null` hides the reason the container wouldn’t start.                                                                                                                                        |
| `check-substitution-exit-swallow` | Catches a loop fed by `jq`/`yq` whose exit code is ignored, so a parse error looks like “nothing to do.” Example: `done < <(jq …)` or `jq … \| while read` — if `jq` chokes on a renamed key or bad input it exits non-zero, the loop runs zero times, and the failure goes unnoticed. Limited to `jq`/`yq`. Opt out with `# allow-substitution-exit: <reason>`. |
| `check-pr-paths`                  | Catches a required check that never runs and leaves the PR stuck at “Expected — Waiting” forever, so it can never merge. A `paths:`, `paths-ignore:`, or `branches:` filter on `pull_request` can skip the whole workflow silently. Example: a stacked PR whose base isn’t `main` gets skipped by a branch filter.                                               |
| `check-pipefail-grep-pipe`        | Catches `cmd \| grep -q …` under `pipefail`: grep exits as soon as it finds a match, which kills the producer with SIGPIPE and surfaces as exit 141 (looks like “no match”). Example: a check that confirms a secret was removed wrongly reports it gone once the listing is large enough to fill the pipe buffer.                                               |

### Identity (Tier 1, default-on)

| Hook                        | Failure it prevents                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-pinned-base-images`  | Catches a Docker base image pinned to a tag the registry can quietly re-point to different bytes. Example: `FROM node:22` today may not be the same image tomorrow. **Requires a `@sha256:` digest** so the image you reviewed is the image CI builds.                                                                                                                                                                                                                      |
| `check-pinned-downloads`    | Catches downloading a binary and running it with no checksum or signature check, so a tampered release or hacked mirror can swap it. Also flags one-line installers like `curl -fsSL … \| sudo sh`, which pipe unverified bytes straight into a shell.                                                                                                                                                                                                                      |
| `check-provenance-repo-url` | Catches a `package.json` (or `pyproject.toml`) whose repository URL still points at the repo it was forked from. Example: a fork’s first `npm publish --provenance` fails with `E422 … Failed to validate repository information` because the URL names the upstream, not this fork. Compares the declared repository URL against your `origin` remote (never `Homepage`). A mismatch has no opt-out — forks must fix their URL. Repos with no `origin` remote are skipped. |

### Security (Tier 1, default-on)

| Hook                 | Failure it prevents                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-trusted-base` | Catches the “pwn-request” hole, where a `pull_request` or `pull_request_target` job checks out the PR’s own code **and** runs with write permissions or secrets. Example: an outside contributor’s code then runs with your repo’s credentials and can steal your secrets. Read-only checkouts with no secrets (the safe way to lint untrusted code) are fine. Opt out with `# trusted-base-ok: <reason>`. |

### Opinionated (Tier 2, opt-in)

| Hook                               | Failure it prevents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-always-reporter`            | Catches a required check left stuck at “Expected — Waiting” when a gate job skips all the real work jobs. Assumes you use a **decide-job plus an `always()` reporter** job.                                                                                                                                                                                                                                                                                                                                                             |
| `check-required-reporter`          | Catches a new `always()` reporter that is green but was never added to the branch-protection required list, so it doesn’t actually gate anything. Assumes the required list is mirrored from these annotations.                                                                                                                                                                                                                                                                                                                         |
| `check-job-timeout`                | Catches a job with no `timeout-minutes`, which inherits GitHub’s 360-minute default. Example: a hung test or a network fetch with no deadline can hold a shared runner for **six hours**. Requires every job to set its own limit; jobs that call a reusable workflow (`uses:`) are exempt. Opt out with `# allow-no-timeout: <reason>`.                                                                                                                                                                                                |
| `check-inline-run-length`          | Catches long inline `run:` scripts that ship unchecked, because shellcheck/shfmt/shellharden only inspect standalone `.sh` files, not inline blocks. A long inline script can hide bugs like unquoted variables or a missing `pipefail`.                                                                                                                                                                                                                                                                                                |
| `check-concurrency`                | Catches a `concurrency:` block missing `cancel-in-progress`, which defaults to `false`. New pushes then queue behind stale runs instead of cancelling them.                                                                                                                                                                                                                                                                                                                                                                             |
| `check-static-concurrency`         | Catches a workflow-level `concurrency.group` with no per-ref key (no `github.ref`/`head_ref`). A run from another branch can then cancel this one’s pending run before any job starts, so its `always()` reporter never fires and a required check hangs forever.                                                                                                                                                                                                                                                                       |
| `check-pending-cancel-concurrency` | Catches a config that turns a required check **red for no real reason**. If `on.pull_request.types` includes types beyond opened/synchronize/reopened (e.g. `labeled` — a Dependabot PR is born with labels), several runs queue on the same commit; a per-PR `concurrency.group` then lets GitHub cancel one same-commit run, and its `always()` reporter reports “cancelled” (a red X with no actual failure). `cancel-in-progress` can’t help. Fix: drop the group or key it on `github.run_id`. Opt out with `# pending-cancel-ok`. |
| `check-requires-concurrency`       | Catches a `pull_request`/`pull_request_target` workflow with **no** `concurrency:` block at all, so every push to a PR starts a second full run instead of cancelling the old one — wasting a limited runner pool. (`check-concurrency` only checks a block that exists; this one requires the block.) Satisfied by a block at the workflow **or** job level. Opt out with `# concurrency-not-required`.                                                                                                                                |
| `check-externalized-markers`       | Catches a workflow guard that scans inline `run:` for a required marker but goes blind when that command moves into a `.github/scripts/*.sh` file or a composite action. Example: a guard that requires `fetch-depth: 0` whenever a history-rewrite command runs stops seeing the command once it’s in a script, and passes even though the requirement is now unmet.                                                                                                                                                                   |
| `check-path-gate-deps`             | Catches a gated job that skips — and its `always()` reporter goes green — on the exact PR that changed a file the job needs, because the decide job’s path filters left out a composite action or `.github/scripts/` helper. Checks that every gated job’s dependencies (composites, sourced scripts one hop deep, and `# gate-deps:`-declared paths) are covered by the filters. Suppress one dependency with `# path-gate-ok: <dep> <reason>`.                                                                                        |
| `check-failure-notifier-coverage`  | Catches a new push/schedule workflow that fails silently because it was never added to `ci-failure-notify.yaml`’s `on.workflow_run.workflows` list (`workflow_run` has no wildcard, so the list is hand-maintained). Checks that the list exactly matches the tree’s push/schedule workflow names and prints the corrected block on mismatch. Pass `--require-notifier` to also fail when the notifier workflow itself is missing.                                                                                                      |
| `check-token-fallback`             | Catches a token that silently switches identity, like `token: ${{ secrets.PAT \|\| secrets.GITHUB_TOKEN }}`. The day someone sets `PAT`, pushes start using a different identity — which can break permissions in surprising ways. Flags any `secrets.A \|\| secrets.B` in a token position (a `token:`/`github-token:` input, or a `GITHUB_TOKEN`/`GH_TOKEN` env var). Opt out with `# token-fallback-ok: <reason>` when the switch is intentional.                                                                                    |
| `check-workflow-secret-names`      | Catches a misspelled or renamed secret reference. A wrong `secrets.*` name just evaluates to empty, so the feature quietly degrades with no error. Example: reading `secrets.ANTHROPIC_API_KEY` when the real secret is `GH_ACTION_ANTHROPIC_API_KEY`. Requires every `secrets.*`/`vars.*` name under `.github/` to match the checked-in `.github/workflow-secrets.txt` allowlist (`GITHUB_TOKEN` is implicit). Prints the corrected file on mismatch.                                                                                  |
| `check-pin-comment-truth`          | Catches wrong or inconsistent version comments on SHA-pinned actions — the comment is the only human-readable part of a pin. Example: the same `actions/checkout@<sha>` is labeled `# v6` in one place and `# v7.0.0` in another, so at most one is true. Requires every SHA-pinned `uses:` to carry a well-formed `# v<number>` comment, and one SHA to use one comment string across the repo. No network lookups. Opt out with `# pin-comment-ok`.                                                                                   |
| `check-stderr-merge-parse`         | Catches parsing a stream that merged stderr into stdout with `2>&1`, where a warning line can be mistaken for real output. Example: an npm warning becomes “the version” and every release aborts on the bogus value. Flags a `2>&1` capture piped into a parser (`head`/`tail`/`grep`/`awk`/`cut`/`sed`/`jq`/`sort`/`wc`) or used in a `[[ … ]]`/`(( … ))` comparison. A plain `out=$(cmd 2>&1)` used only for `echo`/`printf` (diagnostics) is fine. Opt out with `# stderr-merge-ok: <reason>`.                                      |
| `check-echo-fallback`              | Catches `$(cmd \|\| echo "…")`, which turns a failure into a normal-looking value that later code trusts. Example: a release step reads the literal string `error` as the version. Flags `\|\| echo`/`\|\| printf` inside command substitutions and as bare statements. A fallback that writes to stderr and aborts (`\|\| { echo … >&2; exit 1; }`) is real recovery and passes. Opt out with `# echo-fallback-ok: <reason>`.                                                                                                          |
| `check-lockstep-pins`              | Catches two pins that are supposed to stay in sync but are linked only by a comment. Example: a `.pre-commit-config.yaml` `rev:` and a workflow’s `pip install git+…@<sha>` that must name the same release. Config-driven: each `--pair FILE1 REGEX1 FILE2 REGEX2` (one capture group each) must match exactly once per file and the two captures must be equal — zero or multiple matches is a hard error. Not in the `check-tier2` aggregate (it needs per-repo args); enable it on its own.                                         |

### Unrelated bonus checks (Extras)

| Hook                         | Failure it prevents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check-symlinks`             | Catches a committed symlink pointing at an absolute path (`/Users/you/...`), which works only on the author’s machine and breaks everywhere else.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `check-unnamed-regex-groups` | Catches a `re.*` pattern that uses a plain `( )` group, which forces brittle position-based match handling. Named groups `(?P<name>…)` are clearer and survive edits.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `check-global-stdio-swap`    | Catches code that reassigns the process-global `sys.stdout` to capture output. Under concurrency, calls then clobber each other’s output.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `check-claude-model`         | Catches a `claude-code-action` step with no `--model`, which rides the action’s expensive default tier and can bill for Opus without you meaning to.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `check-drift-guards`         | Catches a “these copies must agree” (drift-guard) test that never says why a single source of truth isn’t feasible — so the duplication it polices keeps drifting anyway. Requires `@pytest.mark.drift_guard("<why no SSOT is feasible>")` on any Python test that reads as a drift guard, so the judgement is reviewed, not implied. JS/TS/shell suites (`*.test.mjs`, bash tests) can’t use the decorator, so a phrase check covers them — annotate a flagged line with `drift-guard-ok: <why no SSOT is feasible>`.                                                                                 |
| `check-graceful-handwave`    | Catches vague claims like "fails gracefully" in docs or comments — they promise nothing (which input? which exit code?), so no one can tell if the behaviour is real. Scans prose (Markdown/RST) line by line and code comments only. Opt out by stating what actually happens: `allow-graceful: <what happens>`. Pass `--prose` to scan a plain text file (e.g. a PR body) line by line.                                                                                                                                                                                                              |
| `check-historical-comments`  | Catches a comment describing the past ("renamed from X", "now uses Y"). The reader can't see the old code, so the note was never verifiable and rots into a lie. Bans only words with no present-tense reading. Opt out (e.g. a reader of a legacy on-disk format) with `# allow-history: <reason>`.                                                                                                                                                                                                                                                                                                   |
| `check-doc-line-refs`        | Catches a doc that cites source by line number, which points at whatever happens to live there after the next refactor. Bans `<file>.<ext>:<N>` and `(L<N>)` cites in Markdown (fenced code blocks and any `CHANGELOG.md` are skipped). Cite a function, section, or anchor instead, or suppress with `<!-- allow-line-ref: <reason> -->`.                                                                                                                                                                                                                                                             |
| `check-flag-arity`           | Catches a CLI flag that reads its value without checking one was passed, so it dies with `$2: unbound variable` instead of a clean "--branch needs a value". Example: a `--branch) X="$2"; shift 2` arm passed as the last argument. Flags any `case` arm for a `-x`/`--xxx`/`--xxx=*` option that reads `$2`/`shift 2` with no guard that both **comes first** and actually **bails** (`[[ $# -ge 2 ]] \|\| die`, `${2:?…}`, or a `need_val`/`need_arg` helper). A bare `[[ $# -ge 2 ]]` whose result is discarded, or a guard after the read, doesn't count. Suppress with `# flag-arity-ok: <why>`. |
| `check-secret-file-perms`    | Catches a credential file (`*token*`, `*.pem`, `*npmrc*`, …) created world-readable and only `chmod 600`'d a few lines later — a co-tenant can read it in that window. Flags a secret-named create (`>`/`>>`, `touch`, `tee`, non-private `install`) tightened by a later `chmod 0?[46]00` on the same path within ~3 lines. A `umask 077` or `install -m 600` up front is accepted, and a create with no nearby chmod isn't flagged. Suppress with `# secret-perms-ok: <reason>`.                                                                                                                     |
| `check-case-default`         | Catches a shell `case` with no default arm, so an unexpected value matches nothing and the script runs on. Example: an unknown bump-type leaves `NEW_VERSION` unset and the release continues on garbage. Requires a bare `*)` (or `(*)` / `* )` / a `x\|*)` alternative) default arm on every `case … esac`; globs like `*.txt)` or `--*)` don't count. Opt out with `# case-default-ok: <reason>` on the `case` line.                                                                                                                                                                                |
| `check-cron-comment`         | Catches a schedule comment that contradicts its cron. Example: the comment says "daily" but the cron runs weekly, so the job runs 1/7th as often as everyone thinks. Pairs a cadence word (`hourly`/`daily`/`weekly`/`monthly`/`every N minutes\|hours\|days`) in a comment on or within 3 lines above a `cron:` line with the expression, and fails only on a clear contradiction — lists, ranges, and exotic crons always pass. Opt out with `# cron-comment-ok`.                                                                                                                                    |
| `check-toolchain-skips`      | Catches a test that skips itself when a tool is missing (`skipif(shutil.which("node") is None)`), which silently drops all coverage of the guarded scripts on a runner without that tool while the suite stays green. Flags `pytest.mark.skipif`/`pytest.importorskip` conditions that probe for a binary (`shutil.which`, `which(`, `find_executable`) with no CI guard — in CI the skip must instead FAIL: `shutil.which("node") is None and not os.environ.get("CI")`. Only test files are scanned. Opt out with `# toolchain-skip-ok: <reason>`.                                                   |
| `check-env-symmetry`         | Catches a half-finished env-var rename: the var was changed where it's **set** but not where it's **read** (or vice-versa), so the reader just sees an unset value and falls back to a default. Scans the whole tracked tree for every var matching a `--prefix` (e.g. `GLOVEBOX_`) and flags any that is written-but-never-read or read-but-never-written. Dynamically-built names are skipped; an out-of-band var opts out with `# env-symmetry-ok: <VARNAME> <reason>`. Needs `args: [--prefix, <PREFIX>]`; not part of a tier aggregate.                                                           |
| `check-stray-tool-markup`    | Catches an agent's leaked file-authoring scaffolding — a bare closing `content`/`invoke` tag (or an `antml:`-prefixed variant) committed onto its own line in a doc, where it renders as literal garbage that only a human caught. Flags a line that is _entirely_ a stray tool-call tag (`</invoke>`, an opening `invoke`/`parameter` tag, `<function_calls>`, a bare closing `content` tag); inline mentions, inline-code spans, and fenced code blocks are never flagged. Suppress a genuine case with `allow-stray-markup: <reason>` on the line above.                                            |

## Usage

These are [pre-commit](https://pre-commit.com) hooks. Install pre-commit and
enable its git hook:

```bash
pipx install pre-commit # or: pip install pre-commit / brew install pre-commit
pre-commit install
```

Then add ci-truth-serum to your `.pre-commit-config.yaml`. Tier 1 (honesty +
identity) is enabled below; Tier 2 and Extras are commented out: uncomment what
you want. pre-commit builds each hook’s isolated Python environment, so it is
the only prerequisite.

```yaml
repos:
  - repo: https://github.com/AlexanderMattTurner/ci-truth-serum
    rev: v0.2.0 # the release tag; matches the package version (vX.Y.Z)
    hooks:
      # ── Tier 1 · Honesty (default-on) ──
      - id: check-workflow-pipefail
      - id: check-exit-suppression
      - id: check-stderr-suppression
      - id: check-substitution-exit-swallow
      - id: check-pr-paths
      - id: check-pipefail-grep-pipe
      - id: check-frozen-head-sha # ban frozen event head.sha in diff-range/checkout steps
      # ── Tier 1 · Identity (default-on) ──
      - id: check-pinned-base-images
      - id: check-pinned-downloads
      - id: check-provenance-repo-url
      # ── Tier 1 · Security (default-on) ──
      - id: check-trusted-base
      # ── Tier 2 · Opinionated (opt-in: uncomment to enable) ──
      # - id: check-job-timeout          # every job must declare timeout-minutes
      # - id: check-always-reporter      # assumes a decide-job + always() reporter
      # - id: check-required-reporter    # classify each always() reporter required-check: true|false
      # - id: check-inline-run-length
      # - id: check-concurrency
      # - id: check-static-concurrency   # static workflow-level concurrency.group on a required check
      # - id: check-pending-cancel-concurrency  # ref-keyed group + extra PR types = same-SHA cancel goes red
      # - id: check-requires-concurrency  # every pull_request workflow must declare a concurrency block
      # - id: check-externalized-markers  # marker reachable only via script/composite indirection
      # - id: check-path-gate-deps       # decide filters must cover every gated-job dependency
      # - id: check-failure-notifier-coverage  # keep ci-failure-notify's workflow_run list fresh
      # - id: check-cancellable-required-check  # no static cancellable concurrency lock on required checks
      # - id: check-token-fallback       # no secrets.A || secrets.B fallbacks in token positions
      # - id: check-workflow-secret-names  # referenced secrets/vars == .github/workflow-secrets.txt
      # - id: check-pin-comment-truth    # `# vX.Y` comments on SHA pins: present + consistent
      # - id: check-stderr-merge-parse   # never parse a 2>&1-merged stream
      # - id: check-echo-fallback        # no `|| echo` fallbacks that fake a value
      # - id: check-lockstep-pins        # config-driven twin-pin equality (needs --pair args)
      # ── Extras · Unrelated bonus checks (opt-in) ──
      # - id: check-symlinks
      # - id: check-unnamed-regex-groups
      # - id: check-global-stdio-swap
      # - id: check-claude-model         # require an explicit --model on claude-code-action steps
      # - id: check-drift-guards         # copies-agree tests must justify why no SSOT is feasible
      # - id: check-graceful-handwave    # allow-graceful: bans vague "graceful" claims; name the real behaviour
      # - id: check-historical-comments  # comments describe the present code, not its past
      # - id: check-doc-line-refs        # docs cite symbols/sections, not line numbers
      # - id: check-flag-arity           # value-taking CLI flag arms must guard $2 before reading it
      # - id: check-secret-file-perms    # secret-named files must be created private, not chmod'd late
      # - id: check-case-default         # every shell case block needs a bare *) default arm
      # - id: check-cron-comment         # schedule comments must not contradict their cron
      # - id: check-toolchain-skips      # which()-gated pytest skips must fail (not skip) in CI
      # - id: check-env-symmetry         # prefixed env vars must be both written and read
      #   args: [--prefix, GLOVEBOX_]    # required: only <PREFIX>… vars are checked
      # - id: check-stray-tool-markup    # ban leaked tool-call tags (</invoke>, </content>) committed into a file
```

`pre-commit run --all-files` sweeps the whole repo (handy on first adoption).

### Enable a whole tier with one id

Instead of adding a new `- id:` every time a check ships, enable a tier
aggregate: one id runs every Python check in that tier, and checks added later
are picked up with **no change to your config**:

```yaml
repos:
  - repo: https://github.com/AlexanderMattTurner/ci-truth-serum
    rev: v0.2.0 # the release tag; matches the package version (vX.Y.Z)
    hooks:
      - id: check-tier1 # all honesty + identity checks (the safe default-on set)
      # - id: check-tier2   # all opinionated checks: assumes the decide-gate + reporter architecture
      # - id: check-extras  # the Python extras (vendor-/style-specific)
```

Three checks are not in any aggregate—add each `- id:` separately if you want
it: `check-symlinks` (a shell `language: script` hook, not a Python module),
`check-lockstep-pins` (config-driven; it hard-errors without the per-repo
`--pair` args an aggregate cannot supply), and `check-env-symmetry` (a
whole-tree scan that needs a per-project `--prefix` arg an aggregate can't
supply). Mixing an aggregate with individual ids is fine (a check just runs
twice).

### Scope one check to specific paths

When one check in a tier needs tighter file scoping than the rest (e.g.,
`check-exit-suppression` is too strict for your `tests/` directory), use
`--skip <module_name>` to drop it from the aggregate, then re-add it as a
standalone hook with normal pre-commit `files:`/`exclude:` filters:

```yaml
- repo: https://github.com/AlexanderMattTurner/ci-truth-serum
  rev: v0.2.0
  hooks:
    - id: check-tier1
      args: [--skip, check_exit_suppression] # drop from aggregate...
    - id: check-exit-suppression # ...then re-add with scoped filters
      files: '^(bin/|setup\.bash$|\.devcontainer/|\.claude/hooks/)'
      exclude: "^bin/(bench-|check-)"
```

`--skip` is repeatable: pass one `--skip <name>` pair per check to drop.
**An unknown name is a hard error** (to catch typos that would silently
re-include the check). Module names use underscores and match the TIERS
registry in `ci_truth_serum/run_tier.py` (e.g., `check_exit_suppression`, not
`check-exit-suppression`).

The key property is preserved: any new check added to the tier upstream still
flows in automatically via the aggregate: you only opt out of the ones you
deliberately scope.

### Autofix (opt-in): digest-pin base images

`check-pinned-base-images` can rewrite what it finds: pass `--fix` and it
resolves each unpinned `FROM`’s current registry digest and appends it
(`FROM node:22` → `FROM node:22@sha256:…`), preserving `--platform` flags and
`AS <stage>` suffixes. It is opt-in because `--fix` is the pack’s only network
call (a Docker Registry v2 manifest lookup); detection stays offline, and an
image whose digest can’t be resolved is left untouched: never guessed.

```yaml
- id: check-pinned-base-images
  args: [--fix]
```

### Apply: mirror branch protection from the annotations

`check-required-reporter` lints locally; `sync-required-checks` applies. It reads
every job marked `# required-check: true` (any job, not just `always()`
reporters), expands each `name:` across its `strategy.matrix` into concrete check
contexts, and rewrites the repo’s branch-protection ruleset so
`required_status_checks` matches that set exactly. The annotations become the
single source of truth, so the required-set stops drifting in the GitHub UI.

```bash
pip install ci-truth-serum

# Report drift and exit non-zero WITHOUT mutating (PR-safe gate):
sync-required-checks --repo owner/name --check

# Rewrite the ruleset to match the annotations:
GH_TOKEN=<token-with-administration:write> sync-required-checks --repo owner/name
```

The mutation path needs a token (`GH_TOKEN` / `GITHUB_TOKEN`) with
`administration: write`; it reads the marker from the same scoped lines the lint
classifies, so the gate and the apply step can never disagree. Pass
`--ruleset-id` if the repo has more than one branch ruleset.

### Config: enforce twin pins with check-lockstep-pins

`check-lockstep-pins` replaces "keep these in lockstep" comments with a gate.
The motivating pair—a `.pre-commit-config.yaml` `rev:` and a workflow's
`pip install git+…@` pin of the same release:

```yaml
- id: check-lockstep-pins
  args:
    - --pair
    - .pre-commit-config.yaml
    - 'ci-truth-serum\s+rev:\s*(\S+)'
    - .github/workflows/lint.yaml
    - 'ci-truth-serum\.git@(\S+)'
```

Each regex needs exactly one capture group and must match exactly once in its
file—zero (the pattern rotted) or several (ambiguous) is a hard error, and the
two captures must be equal. Repeat `--pair` for more pins.

### Apply: verify a release with release-canary

`release-canary` asserts the places a release leaves its version agree: the
npm registry (semver-max of `npm view <pkg> versions --json`—deliberately NOT
`npm view <pkg> version`, which returns the `latest` dist-tag and silently
misreports when a publish set the tag wrong), the semver-max `v*` git tag, and
the changelog's top dated `## [x.y.z]` heading (`## Unreleased` is skipped). If
the repo also ships to the AUR, a `PKGBUILD`'s `pkgver=` is folded in as an
optional fourth marker — checked only when a PKGBUILD is present, so forgetting
to bump it is caught while a repo without one is unaffected (a build-time
`pkgver()` that can't be read offline is skipped, never a failure). On mismatch
it prints all present labeled values and exits non-zero; the `npm view` call is
its only network touch.

```bash
pip install ci-truth-serum

release-canary                    # package name read from ./package.json
release-canary --package my-pkg --changelog CHANGELOG.md --repo-dir .
release-canary --pkgbuild aur/PKGBUILD   # non-default PKGBUILD location
```

Run it as a post-release workflow step so a publish that died after tagging
(or a tag push that 403'd after publishing) is caught the day it happens, not
at the next release.

## Complements, doesn’t replace

ci-truth-serum enforces policy gaps; keep running the tools it doesn’t
duplicate: [`zizmor`](https://github.com/woodruffw/zizmor) to SHA-pin `uses:`
references, [`hadolint`](https://github.com/hadolint/hadolint) for Dockerfiles
(`check-pinned-base-images` is stronger: it demands a `@sha256:` digest, not just
an explicit tag), [`actionlint`](https://github.com/rhysd/actionlint) for
workflow syntax/types, and `shellcheck` for shell.
