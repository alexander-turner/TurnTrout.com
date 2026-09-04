# ci-truth-serum

**A green check does not always mean the work passed.** These [pre-commit](https://pre-commit.com) lints find the places where CI reports success over a real failure. They are fast, and they run offline.

Here is the smallest case. A CI step runs `pytest | tee log`. A shell pipe reports the exit code of its **last** command, and `tee` always succeeds. The tests fail, the step exits 0, and the check turns green. Nobody re-reads a green check, so the failure stays.

Two families of defects behave this way, and neither one shows up as a red check:

- **The pipeline hides a failure.** A pipe drops the exit code of the command that failed. Or a required check never reports, so the pull request waits forever.
- **You cannot prove what you ran.** A base image or a download names a tag or a bare URL. That target can change, so the bytes you run may differ from the bytes you reviewed.

## Start here

Install pre-commit and enable its git hook:

```bash
pipx install pre-commit # or: pip install pre-commit / brew install pre-commit
pre-commit install
```

Then add the Tier 1 aggregate to your `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/AlexanderMattTurner/ci-truth-serum
    rev: v1.2.0 # the release tag; matches the package version (vX.Y.Z)
    hooks:
      - id: check-tier1 # every honesty + identity + security check
```

Then run `pre-commit run --all-files` once, to sweep the files you already have.

The pack sorts its checks on two axes, and the [Usage](#usage) section shows how to select on each:

- A **tier** says how much of your CI architecture a check assumes. Tier 1 fits any repository. Tier 2 assumes one specific architecture, so enable it only if you follow that architecture. Extras are bonus checks about tests, docs, shell, and Python rather than CI reporting.
- A **tag** says what a check is about: `honesty`, `security`, `cost`, and eleven more.

Each table row below names the hook id, then the failure it prevents. Most rows follow one pattern: what goes wrong, why CI stays green anyway, a real measured incident, the fix, and the comment token that opts one line out. The last column is a one-line example of the defect.

## What it checks

Not everything! ci-truth-serum enforces policy gaps. Keep running the tools it does not duplicate:

- [`zizmor`](https://github.com/woodruffw/zizmor) pins `uses:` references to a SHA.
- [`hadolint`](https://github.com/hadolint/hadolint) checks Dockerfiles.[^tag]
- [`actionlint`](https://github.com/rhysd/actionlint) checks workflow syntax and types.
- [`shellcheck`](https://www.shellcheck.net) checks shell.

[^tag]: `check-pinned-base-images` is stronger than hadolint's: it demands a `@sha256:` digest, not only an explicit tag.

### Honesty (Tier 1, default-on)

These checks find code whose failure reports success.

| Hook                              | Failure it prevents                                                                                                                                                                                                                                                   | Example                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `check-workflow-pipefail`         | A pipe reports only its last command's exit code, so a failing step goes green. Fires on a `run:` step whose shell does not set `pipefail`.                                                                                                                           | `pytest \| tee log` — tee succeeds, so pytest's failure is lost  |
| `check-exit-suppression`          | `cmd \|\| true` throws the failure away and keeps the output, so a broken step reports success.                                                                                                                                                                       | `npm test \|\| true`                                             |
| `check-stderr-suppression`        | `cmd 2>/dev/null` throws the error messages away, leaving a non-zero exit with no reason for it.                                                                                                                                                                      | `docker compose up 2>/dev/null`                                  |
| `check-substitution-exit-swallow` | A loop reading `jq` or `yq` ignores the parser's exit code, so a parse error looks like an empty result. Opt out with `# allow-substitution-exit: <reason>`.                                                                                                          | `done < <(jq …)` — a query error empties the loop, exit 0        |
| `check-argument-exit-swallow`     | A command substitution in an argument drops the inner command's exit status, and `set -e` does not catch it. Shellcheck's SC2155 covers the assignment form only. Opt out with `# allow-argument-exit: <reason>`.                                                     | `my_helper "$(risky_listing)"`                                   |
| `check-soft-timeout`              | `timeout 60 cmd` sends SIGTERM, which a command can catch or ignore, so the limit is only a request. `--kill-after=N` adds SIGKILL and makes it real. Measured: an `npm` install outlived a 180-second limit by 8m36s. Opt out with `# allow-soft-timeout: <reason>`. | `timeout 60 curl …`                                              |
| `check-flock-fixed-fd`            | `flock -x 9` locks a descriptor the file never opened, so the lock guards nothing. Open it yourself with `exec {lock_fd}>FILE`. Opt out with `# allow-fixed-fd: <reason>`.                                                                                            | `flock -x 9` with no `exec 9>`                                   |
| `check-pr-paths`                  | A `paths:` or `branches:` filter on `pull_request` can skip the workflow, so a required check never reports and the PR waits at “Expected — Waiting” forever.                                                                                                         | `pull_request: paths: ['src/**']` — a docs-only PR waits forever |
| `check-pipefail-grep-pipe`        | A last stage that stops reading early kills the producer with SIGPIPE, and `pipefail` turns that into exit 141, which reads as “no match”.                                                                                                                            | `grep -q needle < <(gen)` — a match returns 141                  |
| `check-frozen-head-sha`           | `github.event.pull_request.head.sha` freezes at trigger time, so after a force-push a diff range spans the whole branch and a checkout can name a commit that is gone. Read `git rev-parse HEAD` after checkout. Opt out with `# frozen-head-ok: <reason>`.           | `ref: ${{ github.event.pull_request.head.sha }}`                 |
| `check-ready-for-review`          | A draft gate that omits the `ready_for_review` type never fires again, and GitHub counts the draft run's skipped jobs as a satisfied required check. Opt out with `# ready-for-review-ok`.                                                                            | `on: pull_request` with a draft gate                             |
| `check-folded-scalar-comment`     | A `#` line inside a folded YAML scalar (`>` or `>-`) joins the value instead of commenting it. A shell then reads it as a comment and drops every argument after it. Opt out with `# allow-folded-scalar-comment: <reason>`.                                          | `claude_args: >-` with a `# note` above the flags                |
| `check-runner-var-foreign-shell`  | `$GITHUB_OUTPUT` and its siblings name files the runner reads back. A shell GitHub did not set up writes them elsewhere, so the step exits 0 with an empty output and a later `if:` skips green.                                                                      | `shell: docker run … {0}` appending to `$GITHUB_OUTPUT`          |
| `check-gh-slurp-jq`               | `gh` rejects `--slurp` with `--jq`, and `--slurp` without `--paginate`, while parsing arguments — so the call has never worked. Opt out with `# allow-gh-slurp-jq: <reason>`.                                                                                         | `gh api --slurp --jq .`                                          |
| `check-truncating-pr-json`        | `gh pr view --json files` asks for `files(first: 100)` with no cursor. Past 100 files GitHub returns 100, `gh` exits 0, and nothing says the list is short.                                                                                                           | `gh pr view --json files` on a 300-file PR                       |

### Identity (Tier 1, default-on)

These checks make CI run the exact bytes you reviewed, not whatever a mutable name serves that day.

| Hook                        | Failure it prevents                                                                                                                                                                                                                                                                                                                | Example                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `check-pinned-base-images`  | A registry can point a tag at different bytes at any time. The check requires a `@sha256:` digest, so CI builds the image you reviewed.                                                                                                                                                                                            | `FROM node:22`                         |
| `check-pinned-downloads`    | A download with no checksum can be swapped by a tampered release or a compromised mirror. Also flags `curl … \| sh` one-liners, and a `# pin-exempt`'d file that runs without a size check, since `curl -f` succeeds on an empty body. Opt out with `# empty-download-ok: <reason>`.                                               | `curl -sL get.example.com \| bash`     |
| `check-versionless-install` | An install naming no version gets whatever the index serves that day, and the version that changed appears nowhere in the diff. Measured: `apt-get install docker-sbx` served v0.37.1 while the repo pinned v0.35.0, costing days of red end-to-end runs. Dockerfiles are left to hadolint. Opt out with `# pin-exempt: <reason>`. | `pip install pre-commit`               |
| `check-provenance-repo-url` | A fork whose manifest still names upstream fails its first `npm publish --provenance` with `E422`. No opt-out: a fork must correct its URL.                                                                                                                                                                                        | `repository.url` still naming upstream |

### Security (Tier 1, default-on)

These checks stop untrusted code, or an AI agent, from reaching credentials it was never granted.

| Hook                        | Failure it prevents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Example                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `check-trusted-base`        | The “pwn-request” hole: a job checks out the pull request's code and holds write permissions or secrets, so an outsider's code runs with your credentials. A base ref counts too, because the author picks the base branch. Opt out with `# trusted-base-ok: <reason>`.                                                                                                                                                                                                                                         | checkout `base.ref` plus a write token                 |
| `check-untrusted-exec`      | The same job **runs** the checked-out pull-request code while secrets are live, through a local composite action, a package-manager script, or a workspace path. Staging into `$RUNNER_TEMP` is no defence. Opt out with `# untrusted-exec-ok: <reason>`.                                                                                                                                                                                                                                                       | checkout PR head, then `uses: ./.github/actions/setup` |
| `check-unscoped-tool-grant` | A Claude Code tool grant is unscoped or inert. A file tool named with no path grants the whole tool and overrides the per-path check, so an `--add-dir` beside it suppresses a prompt rather than building a jail. A path rule spelled under any name but `Read` or `Edit` is read by nothing: `Write(//out.json)` denies the write it appears to grant. The rules come from probing the real CLI headless. Opt out of the unscoped half with `# allow-unscoped-read-grant: <reason>`; the inert half has none. | `--allowedTools Read` — reads `/proc/self/environ`     |

### Opinionated (Tier 2, opt-in)

These checks assume one CI architecture. Enable them only if you follow it. Two of its parts are named throughout the cells below. A **decide job** is a small first job that reads what changed and decides which expensive jobs run. An **`always()` reporter** is a last job that runs on every outcome and reds when a job it needs failed, so branch protection watches the reporter rather than the work itself. GitHub counts a skipped check run as a satisfied required check, and that quirk is behind half of this tier.

| Hook                               | Failure it prevents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Example                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `check-always-reporter`            | A failed gate job skips the work jobs, and GitHub counts a skipped check run as satisfied, so the merge greens over a gate that verified nothing. An `always()` reporter or a fail-closed twin closes it. Opt out with `# not-required-check`.                                                                                                                                                                                                                                                                                                                                                  | a gate fails, every work job skips, the merge is green                  |
| `check-required-reporter`          | A new reporter is green but nobody added it to branch protection, so it gates nothing. Reads the `# required-check:` markers. A required matrix job that can skip fails too: its per-combination check names never report, so the branch blocks forever with nothing red. Opt out with `# matrix-context-ok: <reason>`. A required job whose registered context holds a non-matrix `${{ }}` — in the `name:` or in a matrix value — fails too: the sync registers text that no run reports. So does a `name:` that references an axis its matrix never defines: the sync then requires nothing. | a reporter with no `# required-check:` marker                           |
| `check-required-event-closure`     | A job that a required check `needs` skips on an event the check gates, so the check reports green with none of its work done.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | a `decide` job that skips in the merge queue                            |
| `check-job-timeout`                | A job with no `timeout-minutes` inherits GitHub's 360-minute default, so a hung step can hold a runner for six hours. Opt out with `# allow-no-timeout: <reason>`.                                                                                                                                                                                                                                                                                                                                                                                                                              | a job with no `timeout-minutes:`                                        |
| `check-uncached-download`          | A job refetches a version-pinned tool every run. The bytes cannot change, so it is pure waste, and a slow registry pushes the job past its timeout into a one-line “cancelled”. Measured: a shard spent 7.9 of its 15 minutes in one `npm install -g`. Opt out with `# cache-exempt: <reason>`.                                                                                                                                                                                                                                                                                                 | `curl -O .../v2.12.0/tool` with no `actions/cache`                      |
| `check-inline-run-length`          | A long inline `run:` block ships unchecked, because shellcheck and shfmt read standalone `.sh` files.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | a 60-line `run:` block                                                  |
| `check-concurrency`                | A `concurrency:` block without `cancel-in-progress` defaults to `false`, so a new push queues behind a stale run.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `concurrency:` with no `cancel-in-progress:`                            |
| `check-static-concurrency`         | A workflow-level `concurrency.group` with no per-ref key lets another branch cancel this branch's pending run before any job starts, so the reporter never fires and the check waits forever.                                                                                                                                                                                                                                                                                                                                                                                                   | `group: build` on a required check                                      |
| `check-conclusion-coverage`        | Code that treats only `failure` as red misses `timed_out`, `startup_failure` and `action_required`, so runs ending that way reach nobody. Widen with `extra:` in `.github/conclusion-coverage.yml`. Opt out with `# allow-conclusion-subset: <reason>`.                                                                                                                                                                                                                                                                                                                                         | a notifier matching `conclusion == 'failure'`                           |
| `check-cancellable-required-check` | A static, cancellable workflow-level group on a required-check workflow lets a sibling ref cancel the whole run, reporter included — `always()` does not survive a run-level cancel. Opt out with `# cancellable-required-check-ok`.                                                                                                                                                                                                                                                                                                                                                            | a static cancellable group on a required-check workflow                 |
| `check-pending-cancel-concurrency` | GitHub claims a job's concurrency slot before it reads the job's `if:`, so a run that SKIPS the job still evicts the live run queued in that slot — which reports `cancelled` with every step successful, so no log names it. Also fires when extra `pull_request` types queue several runs on one commit and a per-PR group cancels one. End the group `-shared` on the triggers the job serves and `-inert-${{ github.run_id }}` on the ones it skips. Opt out with `# inert-group-ok: <reason>` per job, or `# pending-cancel-ok` for the required-check shape.                              | a `labeled` run's skipped job killing the `synchronize` run             |
| `check-collapsing-job-group`       | A job's `concurrency.group` names a per-ref key that is empty or fixed on one of the workflow's events, so every run of that event shares one slot and cancels an unrelated commit's run. Opt out with `# collapsing-group-ok: <reason>`.                                                                                                                                                                                                                                                                                                                                                       | `group: x-${{ github.event.pull_request.number }}` on a `schedule` job  |
| `check-requires-concurrency`       | A `pull_request` workflow with no `concurrency:` block starts a second full run on every push and drains the runner pool. Opt out with `# concurrency-not-required`.                                                                                                                                                                                                                                                                                                                                                                                                                            | a PR workflow with no lock                                              |
| `check-externalized-markers`       | A guard that scans inline `run:` blocks for a marker goes blind once the command moves into a script or composite action, and passes while the requirement is unmet.                                                                                                                                                                                                                                                                                                                                                                                                                            | a `run:` calling a script the guard cannot read                         |
| `check-path-gate-deps`             | A gated job skips on the very pull request that changed a file it needs, because the decide filters omit a composite action or helper. Suppress one with `# path-gate-ok: <dep> <reason>`.                                                                                                                                                                                                                                                                                                                                                                                                      | a `decide` regex omitting a composite action                            |
| `check-reusable-permissions`       | A caller granting less than the reusable workflow it calls fails at the start of the run, and the error names the callee rather than the file that must change. Suppress with `# reusable-permissions-ok: <reason>`.                                                                                                                                                                                                                                                                                                                                                                            | a caller missing a scope the shared workflow declares                   |
| `check-failure-notifier-coverage`  | `workflow_run` takes no wildcard, so a hand-maintained notifier list silently omits new push and schedule workflows. Treats “no notifier at all” as a failure; `--allow-no-notifier` passes when none exists.                                                                                                                                                                                                                                                                                                                                                                                   | the notifier's `workflows:` list omitting a new cron                    |
| `check-failure-only-diagnostics`   | A job that exceeds `timeout-minutes` ends cancelled, not failed, so an upload gated on `failure()` alone is skipped on the run it exists to explain. Measured: a lost Playwright report cost three people two days. Opt out with `# failure-only-diagnostics-ok: <reason>`.                                                                                                                                                                                                                                                                                                                     | `if: failure()` on the `playwright-report/` upload                      |
| `check-token-fallback`             | `secrets.A \|\| secrets.B` in a token position switches identity silently the day somebody sets the first one. Opt out with `# token-fallback-ok: <reason>`.                                                                                                                                                                                                                                                                                                                                                                                                                                    | `token: ${{ secrets.PAT \|\| secrets.GITHUB_TOKEN }}`                   |
| `check-workflow-secret-names`      | A misspelled `secrets.*` name evaluates to an empty string, so the feature degrades with no error. Requires every name to appear in `.github/workflow-secrets.txt`.                                                                                                                                                                                                                                                                                                                                                                                                                             | `secrets.NTFY_TOKEN` where the repo defines another name                |
| `check-pin-comment-truth`          | The `# vX.Y` comment is the only readable part of a SHA pin. Requires one well-formed comment per pin, and one comment string per SHA. Opt out with `# pin-comment-ok`.                                                                                                                                                                                                                                                                                                                                                                                                                         | `uses: …@abc123 # v4` where abc123 is not v4                            |
| `check-divergent-action-pins`      | One action pinned to two SHAs across the tree. Every pin is individually valid, so no per-reference audit sees it. Opt out with `# divergent-pin-ok`.                                                                                                                                                                                                                                                                                                                                                                                                                                           | `actions/checkout` at two different SHAs                                |
| `check-stderr-merge-parse`         | Parsing a `2>&1`-merged stream lets a warning line pass as real output. Opt out with `# stderr-merge-ok: <reason>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `cmd 2>&1 \| jq .`                                                      |
| `check-echo-fallback`              | `$(cmd \|\| echo "…")` turns a failure into a value that looks normal, and later code trusts it. A fallback that writes to stderr and aborts passes. Opt out with `# echo-fallback-ok: <reason>`.                                                                                                                                                                                                                                                                                                                                                                                               | `$(cmd \|\| echo error)` read as a version                              |
| `check-bare-return-status`         | A bare `return` forwards the last command's status, so `A && return` is always 0 and `[[ … ]] \|\| return` is always 1 — two spellings that look alike and return opposites. Opt out with `# allow-bare-return: <reason>`.                                                                                                                                                                                                                                                                                                                                                                      | `[[ … ]] \|\| return` in a guard                                        |
| `check-lockstep-pins`              | Two pins that must stay equal, linked only by a comment. Config-driven: each `--pair FILE REGEX FILE REGEX` must match exactly once per file. Not in the tier aggregate; enable it on its own.                                                                                                                                                                                                                                                                                                                                                                                                  | `.python-version` says 3.11, `requires-python` says >=3.12              |
| `check-bare-mkdir`                 | On macOS and BSD `mkdir -p "$X"` exits 0 when `$X` is a dangling symlink, so a caller that trusts the status dies later and far away.                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `mkdir -p "$d"` with no `[[ -d "$d" ]]` after it                        |
| `check-env-arith`                  | An environment variable inside `$(( ))` is trusted to be an integer: a typo aborts a `set -e` caller, and some garbage coerces to 0 and disables the limit.                                                                                                                                                                                                                                                                                                                                                                                                                                     | `$((SECONDS + ${TIMEOUT:-90}))` with `TIMEOUT=abc`                      |
| `check-curl-retry`                 | A single-shot `curl -o file` fails the whole install on one dropped packet. Name your own retry helpers with `--retry-wrapper`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `curl -fsSL -o uv.tar.gz "$url"` with no `--retry`                      |
| `check-retry-loop`                 | A hand-rolled attempt-and-sleep loop re-decides the attempt count, the wait and the exhaustion message, and gets one of them wrong.                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `for i in 1 2 3; do … sleep 2; done`                                    |
| `check-unbounded-waits`            | A `git fetch` against a wedged endpoint hangs forever, eating a Ctrl-C in a hook or stranding a teardown. The bound goes first, so `git` becomes its argument.                                                                                                                                                                                                                                                                                                                                                                                                                                  | `git ls-remote origin` with no `timeout`                                |
| `check-shell-source-declarations`  | A `# shellcheck source=` path the tree lacks, masked by a nearby `disable=SC1091`, makes shellcheck exit 0 having read no library.                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `source=lib/x.bash` for a file that lives elsewhere                     |
| `check-sparse-checkout-closure`    | A sparse checkout that omits a tracked file the job runs dies on the runner, and `git ls-files` still shows a complete tree so nothing else sees it coming. Declare run-time opens with `sparse-checkout-needs: <path>`.                                                                                                                                                                                                                                                                                                                                                                        | `sparse-checkout: .github/scripts` for a script importing `lib/util.py` |

### Unrelated bonus checks (Extras)

These checks are about shell scripts, Python, tests, and docs rather than CI reporting. They live here because the same repositories need them.

| Hook                               | Failure it prevents                                                                                                                                                                                                                                                       | Example                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `check-absolute-symlinks`          | A committed symlink pointing at an absolute path, or at a gitignored one, dangles in a fresh clone. Asks git for the ignore verdict, so it cannot drift from your `.gitignore`.                                                                                           | a link to `/Users/you/…` or to `node_modules/x`                     |
| `check-unnamed-regex-groups`       | A plain `( )` group forces match handling by position, so inserting one group shifts every index.                                                                                                                                                                         | `m.group(3)`                                                        |
| `check-replacement-expansion`      | `replace()` and `re.sub()` read the replacement as a pattern first, so a `$&` or `\g<0>` inside a built string rewrites the result. Pass a function. Opt out with `allow-replacement-expansion: <reason>`.                                                                | a changelog fragment holding `$'`                                   |
| `check-global-stdio-swap`          | Reassigning the process-global `sys.stdout` to capture output makes two concurrent calls overwrite each other.                                                                                                                                                            | `sys.stdout = buf` in a threaded server                             |
| `check-unpaged-all`                | `all(...)` over one page of a GitHub listing reads 100 rows as the whole set, so the failing rows are never seen. Opt out with `allow-unpaged-all: <reason>`.                                                                                                             | a step read 100 of a run's 137 jobs and called it verified          |
| `check-claude-model`               | A `claude-code-action` step naming no `--model` uses the action's expensive default tier, so you can pay for Opus without meaning to.                                                                                                                                     | a step with no `--model`                                            |
| `check-drift-guards`               | A test asserting two copies agree, with no statement of why one source is impossible, lets the duplication it polices keep drifting. Requires `@pytest.mark.drift_guard("<why>")`, or `drift-guard-ok: <why>`.                                                            | a test asserting file A equals file B                               |
| `check-graceful-handwave`          | A claim like “fails gracefully” names no input and no exit code, so nobody can tell whether the behaviour is real. Opt out by stating what happens: `allow-graceful: <what happens>`.                                                                                     | “handles errors gracefully”                                         |
| `check-historical-comments`        | A comment describing the past was never verifiable — the reader cannot see the old code — and it goes false as the code moves. Opt out with `# allow-history: <reason>`.                                                                                                  | `# now uses X instead of Y`                                         |
| `check-doc-line-refs`              | A doc citing source by line number points at whatever lands there after the next refactor. Cite a symbol or anchor, or suppress with `<!-- allow-line-ref: <reason> -->`.                                                                                                 | `see foo.py:42`                                                     |
| `check-workflow-refs`              | A doc or comment naming a workflow file that no longer exists goes false silently, because a bare basename defeats every link checker. Resolves each reference against the tracked files under `.github/workflows/`.                                                      | prose citing `format-check.yaml` after it was consolidated away     |
| `check-flag-arity`                 | A CLI flag that reads `$2` without checking one was passed dies with `$2: unbound variable` instead of a clean message. Suppress with `# flag-arity-ok: <why>`.                                                                                                           | `--out) X="$2"; shift 2` with `--out` last                          |
| `check-secret-file-perms`          | A credential file created world-readable and `chmod 600`-ed a few lines later is readable by a co-tenant in that window. A `umask 077` or `install -m 600` up front passes. Suppress with `# secret-perms-ok: <reason>`.                                                  | `touch key && chmod 600 key`                                        |
| `check-case-default`               | A `case` with no bare `*)` arm lets an unexpected value match nothing and the script carry on. Opt out with `# case-default-ok: <reason>`.                                                                                                                                | an unknown bump type leaves `NEW_VERSION` unset                     |
| `check-cron-comment`               | A cadence word that contradicts its cron expression means the job runs at a rate nobody believes. Fails only on a clear contradiction. Opt out with `# cron-comment-ok`.                                                                                                  | `cron: "17 4 * * 2"` commented “daily”                              |
| `check-cron-alert-coverage`        | A cron has no pull request and no reviewer, so its red mark lives only in the Actions tab and a guard broken for six weeks looks healthy. Every scheduled workflow must route failures to a human. Opt out with `# cron-alert: false  # <reason>`.                        | a weekly scan fails at 3am and tells nobody                         |
| `check-external-clock-targets`     | A dispatch-manifest entry naming a workflow that does not exist, carries no `workflow_dispatch`, or requires an input fires nothing on every tick, and no red mark appears anywhere. No opt-out.                                                                          | a renamed sweep drops every dispatch                                |
| `check-multi-cron-gating`          | Every cron in a file starts every schedule-eligible job, so a job gated on the bare event name runs for all of them. Each must name its cron. The observed cost was a paid eval nobody scheduled. Opt out with `# multi-cron-ok: <reason>`.                               | a second cron also starts the other job                             |
| `check-unused-reusable-input`      | A `workflow_call` input no caller passes is either dead surface a reader writes against, or a solved problem nobody wired — so the next author writes their own copy. The observed one grew a 65-line duplicate. Opt out with `# unused-input-ok: <reason>`.              | a `paths-regex-file` input no workflow passes                       |
| `check-workflow-run-branch-filter` | A `workflow_run` listener with no `branches:` filter creates a run for every watched completion on every branch; the `if:` runs after the run exists. Observed: ~3,000 no-op runs stalled the merge queue for 7 hours. Opt out with `# unfiltered-listener-ok: <reason>`. | `on: workflow_run` with no `branches:`                              |
| `check-toolchain-skips`            | A test that skips itself when a tool is missing leaves the suite green and the guarded scripts uncovered. In CI it must fail instead. Opt out with `# toolchain-skip-ok: <reason>`.                                                                                       | `skipif(shutil.which("node") is None)`                              |
| `check-env-symmetry`               | A half-finished env-var rename leaves the reader on an unset value and a silent default. Flags a prefixed variable written and never read, or read and never written. Needs `--prefix`, so it is not in a tier aggregate.                                                 | `FOO_BAR` written but never read                                    |
| `check-test-predicate-shadow`      | Redefining a production pure predicate in a test asserts against the test's own weaker copy, so the regression it covers can never fail. Stubbing a dependency is fine. Opt out with `# predicate-shadow-ok: <reason>`.                                                   | a stub matching `^[0-9]+$` where the real one rejects leading zeros |
| `check-stray-tool-markup`          | An agent leaves its file-authoring scaffolding behind and it renders as literal text. Flags a line that is entirely a stray tool-call tag. Suppress with `allow-stray-markup: <reason>`.                                                                                  | a leaked `<function_calls>` fragment in shipped prose               |
| `check-dead-shell-functions`       | A function no production code calls rots, and it tells a reader a code path exists.                                                                                                                                                                                       | `cleanup_tmp()` called by nothing outside `tests/`                  |
| `check-cwd-scoped-git`             | A `git` argv naming no repository acts on whatever directory the process sits in, so a test can abort the developer's own merge.                                                                                                                                          | `subprocess.run(["git", "merge", "--abort"])`                       |
| `check-unspecified-encoding`       | `read_text()` with no `encoding=` decodes with the platform default, so a file holding an em-dash mis-decodes on one host only.                                                                                                                                           | `Path("rules.md").read_text()`                                      |
| `check-duplicate-module-constant`  | A module-level name assigned twice shadows its first binding, so an edit to the first is discarded with no error.                                                                                                                                                         | `TIMEOUT = 30` … `TIMEOUT = 60`                                     |
| `check-duplicate-class-names`      | Two modules defining one class name means neither is the definition, and a call site reads one header while getting the other's behaviour.                                                                                                                                | `class Finding` in two modules                                      |
| `check-big-tuple-annotations`      | A fixed-length heterogeneous tuple makes every call site remember what each position means, so a reordered pair is a silent bug.                                                                                                                                          | `def parse() -> tuple[str, int, bool]`                              |
| `check-unreset-module-state`       | A module-level binding written inside a function outlives the call, and `pytest-xdist` imports the module once per worker, so one test's write is the next test's answer.                                                                                                 | a module-level cache with no reset hook                             |
| `check-sleep-as-sync`              | A fixed `sleep` before an assertion bets the event lands in time: it flakes on a loaded shard and hides a never-arriving event on a quiet one.                                                                                                                            | `time.sleep(2)` then `assert path.exists()`                         |
| `check-positional-git-argv`        | `git -c protocol.version=2 fetch` shifts `fetch` to `$3`, so a `$1`-keyed stub stops intercepting and the test passes asserting nothing.                                                                                                                                  | a stub keyed on `case "$1" in rev-parse)`                           |
| `check-test-helper-kwargs`         | Nothing type-checks a test's call sites, so a renamed keyword-only parameter and a call site using the old spelling merge clean and go red as `TypeError`.                                                                                                                | `make_repo(branch=…)` for a helper taking `ref=`                    |
| `check-wall-clock-assertions`      | A shared runner promises nothing about when a test runs, so an assertion on elapsed time measures machine load and flakes both ways.                                                                                                                                      | `assert elapsed < 0.5`                                              |
| `check-relative-imports`           | Node's ESM resolver does no extension guessing and no directory-index fallback, so a specifier missing its suffix is `ERR_MODULE_NOT_FOUND`.                                                                                                                              | `import "./lib-hook-io"` for `lib-hook-io.mjs`                      |
| `check-path-shadowed-interpreter`  | `claude-code-action` prepends `/usr/bin` to `$GITHUB_PATH`, so every later step resolves a bare `python3` to the system interpreter and dies on a package `uv sync` installed.                                                                                            | `run: python3 script.py` after the agent step                       |

## Usage

Start here enables Tier 1 through one aggregate id. This section is the full menu: every check by name, the tag selectors, and the three checks that sit outside every tier.

### Enable specific checks

```yaml
repos:
  - repo: https://github.com/AlexanderMattTurner/ci-truth-serum
    rev: v1.2.0 # the release tag; matches the package version (vX.Y.Z)
    hooks:
      # ── Tier 1 · honesty, identity and security (default-on) ──
      # One id, so a Tier 1 check added in a later release runs as soon as you
      # move the `rev:` above. Enumerating the ids instead pins you to the set
      # that existed the day you copied this.
      - id: check-tier1
      # ── Tier 2 · Opinionated (opt-in: uncomment to enable) ──
      # - id: check-job-timeout          # every job must declare timeout-minutes
      # - id: check-uncached-download    # a pinned download in a job with no cache
      # - id: check-always-reporter      # assumes a decide job; takes an always() reporter or a fail-closed twin
      # - id: check-required-reporter    # classify each always() reporter required-check: true|false
      # - id: check-required-event-closure  # every job a required check needs runs on every event it gates
      # - id: check-inline-run-length
      # - id: check-concurrency
      # - id: check-static-concurrency   # a static workflow-level group on a required check
      # - id: check-cancellable-required-check  # a static cancellable group on a required check
      # - id: check-conclusion-coverage  # one terminal-red conclusion set; no consumer may narrow it
      # - id: check-pending-cancel-concurrency  # a skipping run claims the slot; and a same-SHA cancel that goes red
      # - id: check-collapsing-job-group  # a per-ref job group that goes static on one of the workflow's events
      # - id: check-requires-concurrency  # every pull_request workflow must declare a concurrency block
      # - id: check-externalized-markers  # a marker reachable only through a script or composite
      # - id: check-path-gate-deps       # decide filters must cover every gated-job dependency
      # - id: check-reusable-permissions # a caller must grant what the workflow it calls needs
      # - id: check-failure-notifier-coverage  # keep the notifier's workflow_run list current
      # - id: check-failure-only-diagnostics  # an if: failure() upload is skipped when the job is cancelled
      # - id: check-token-fallback       # no secrets.A || secrets.B in a token position
      # - id: check-workflow-secret-names  # referenced secrets/vars == .github/workflow-secrets.txt
      # - id: check-pin-comment-truth    # `# vX.Y` comments on SHA pins: present and consistent
      # - id: check-divergent-action-pins  # one action, one SHA, repo-wide
      # - id: check-stderr-merge-parse   # never parse a 2>&1-merged stream
      # - id: check-echo-fallback        # no `|| echo` fallback that invents a value
      # - id: check-bare-return-status   # a `&&`/`||` guarded return must state its status
      # - id: check-lockstep-pins        # config-driven twin-pin equality (needs --pair args)
      # ── Extras · Unrelated bonus checks (opt-in) ──
      # - id: check-absolute-symlinks  # a tracked symlink must not point at an absolute or gitignored path
      # - id: check-unnamed-regex-groups
      # - id: check-global-stdio-swap
      # - id: check-replacement-expansion  # no built string as a replace()/re.sub() replacement
      # - id: check-unpaged-all           # no all()/every() over one unpaged GitHub listing
      # - id: check-claude-model         # require an explicit --model on claude-code-action steps
      # - id: check-drift-guards         # a copies-agree test must state why no SSOT is feasible
      # - id: check-graceful-handwave    # allow-graceful: bans a vague "graceful" claim; name the real behaviour
      # - id: check-historical-comments  # a comment describes the present code, not its past
      # - id: check-doc-line-refs        # docs cite a symbol or section, not a line number
      # - id: check-workflow-refs        # docs/comments must not cite a workflow file that is gone
      # - id: check-flag-arity           # a value-taking CLI flag arm must guard $2 before it reads it
      # - id: check-secret-file-perms    # create a secret-named file private, do not chmod it later
      # - id: check-case-default         # every shell case block needs a bare *) default arm
      # - id: check-cron-comment         # a schedule comment must not contradict its cron
      # - id: check-cron-alert-coverage  # a cron's failures must reach a human, not just the Actions tab
      # - id: check-external-clock-targets  # every external-clock dispatch-manifest entry must name a fireable workflow
      # - id: check-multi-cron-gating    # in a multi-cron workflow, every job must name its cron
      # - id: check-unused-reusable-input  # a workflow_call input needs a caller that passes it
      # - id: check-workflow-run-branch-filter  # a workflow_run listener must filter the branches it answers
      # - id: check-toolchain-skips      # a which()-gated pytest skip must fail, not skip, in CI
      # - id: check-env-symmetry         # a prefixed env var must be both written and read
      #   args: [--prefix, GLOVEBOX_]    # required: the check reads only <PREFIX>… vars
      # - id: check-test-predicate-shadow  # a test may stub a dependency, not redefine a pure predicate
      # - id: check-stray-tool-markup    # ban a leaked tool-call tag committed into a file
```

### Checks outside of tiers

Add each `- id:` on its own if you want it:

- `check-absolute-symlinks` is a shell `language: script` hook, not a Python module.
- `check-lockstep-pins` is config-driven. It hard-errors without the per-repo `--pair` arguments that an aggregate cannot supply.
- `check-env-symmetry` scans the whole tree and needs a per-project `--prefix` argument that an aggregate cannot supply.

You may mix an aggregate with individual ids. The named check then simply runs twice.

### Select by tag

A tier says how much of your CI architecture a check assumes. A tag says what the check is about. The two are different questions, so a check carries one tier and as many tags as apply: `check-token-fallback` is `secrets` and `security` at once.

Select on either axis with `check-select`. It takes `--select` (repeatable, union) and `--ignore` (repeatable, subtraction):

```yaml
repos:
  - repo: https://github.com/AlexanderMattTurner/ci-truth-serum
    rev: v1.2.0
    hooks:
      - id: check-select
        args: [--select, "tag:security", --select, "tag:secrets"]
```

A selector is one of these four forms:

| selector                    | selects                                            |
| --------------------------- | -------------------------------------------------- |
| `all`                       | every aggregated check in the pack                 |
| `tier:<1\|2\|extras>`       | every check in that tier (what `check-tier1` runs) |
| `tag:<name>`                | every check carrying that tag                      |
| `check:<module-or-hook-id>` | one check, written either way                      |

Tier 1 without its Docker lint is one line:

```yaml
- id: check-select
  args: [--select, "tier:1", --ignore, "check:check-pinned-base-images"]
```

Three cases exit 2 instead of running a smaller set: no `--select` at all, a selector this pack does not ship, and a selection that ends up empty after the `--ignore` values. A hook that runs zero checks and reports success is the false green this pack exists to refuse.

The tag vocabulary is closed. These are the values:

| tag               | the defect it is about                                                        |
| ----------------- | ----------------------------------------------------------------------------- |
| `honesty`         | a failure that reports success: a masked exit code, a parsed error string     |
| `supply-chain`    | code that runs without naming what it is: a mutable tag, an unpinned download |
| `security`        | privilege or untrusted input reaching a place it must not                     |
| `secrets`         | a token or a secret file handled so its absence passes as its presence        |
| `required-checks` | a required check that never reports, or reports on the wrong events           |
| `concurrency`     | a concurrency group that cancels or strands the run a merge waits on          |
| `scheduling`      | a cron whose schedule, target, or gating does not do what it says             |
| `alerting`        | a failure that reaches no human                                               |
| `docs`            | narration that contradicts the tree it describes                              |
| `tests`           | a test that passes without testing anything                                   |
| `agents`          | an AI-agent surface: a model pin, a tool grant, tool markup left in a file    |
| `correctness`     | ordinary logic defects the other tags do not cover                            |
| `maintainability` | code shaped so the next reader cannot see what runs                           |
| `cost`            | CI minutes spent on a run that cannot finish or did not need to start         |

A tag is not a file type. The files a check reads come from its own `types:`, so there is no `shell` or `python` tag to restate them.

The three checks that sit in no aggregate carry no tag either, so no selector reaches them. `check-absolute-symlinks`, `check-lockstep-pins`, and `check-env-symmetry` stay standalone ids.

### Scope one check to specific paths

One check in a tier can need tighter file scoping than the rest. For example, `check-exit-suppression` may be too strict for your `tests/` directory. Use `--skip <module_name>` to drop that check from the aggregate. Then add it again as a standalone hook with the usual pre-commit `files:` and `exclude:` filters:

```yaml
- repo: https://github.com/AlexanderMattTurner/ci-truth-serum
  rev: v1.2.0
  hooks:
    - id: check-tier1
      args: [--skip, check_exit_suppression] # drop it from the aggregate...
    - id: check-exit-suppression # ...then add it again with scoped filters
      files: '^(bin/|setup\.bash$|\.devcontainer/|\.claude/hooks/)'
      exclude: "^bin/(bench-|check-)"
```

`--skip` is repeatable: pass one `--skip <name>` pair per check you drop. **An unknown name is a hard error**, which catches a typo that would otherwise include the check again in silence. Module names use underscores and match the registry in `ci_truth_serum/_cts_registry.py`. Write `check_exit_suppression`, not `check-exit-suppression`.

This keeps the property that matters. A new check added to the tier upstream still arrives automatically through the aggregate. You opt out only of the checks you scope on purpose.

`check-exit-suppression` also takes `--producer-only`, which restricts it to the captured-producer rule (a suppressed `$(gh api …)`/`$(jq …)` capture) and skips the uncaptured rule (a bare `cmd || true` with output kept). A consumer that wants the producer rule over a wider tree than it has ever enforced the uncaptured rule on adds a second `check-exit-suppression` entry with that flag and a broader `files:`, instead of widening the first entry's scope and inheriting uncaptured findings it never opted into.

### Autofix (opt-in): digest-pin base images

`check-pinned-base-images` can rewrite what it finds. Pass `--fix`, and it resolves the current registry digest of each unpinned `FROM` and appends it, so `FROM node:22` becomes `FROM node:22@sha256:…`. It preserves a `--platform` flag and an `AS <stage>` suffix. The flag is opt-in because `--fix` makes the only network call in the pack, a Docker Registry v2 manifest lookup. Detection stays offline. The check leaves an image untouched when it cannot resolve the digest, and it never guesses one.

```yaml
- id: check-pinned-base-images
  args: [--fix]
```

### Apply: mirror branch protection from the annotations

The tools in the "Apply" sections are command-line programs from the same package, not pre-commit lints. Each one applies or verifies a state that a lint alone cannot reach.

`check-required-reporter` lints locally, and `sync-required-checks` applies. It reads every job marked `# required-check: true`, which is any job and not only an `always()` reporter. It expands each `name:` across its `strategy.matrix` into concrete check contexts. It then rewrites the branch-protection ruleset of the repo, so `required_status_checks` matches that set exactly. The annotations become the single source of truth, and the required set stops drifting in the GitHub UI.

A `uses:` job (a reusable-workflow call) can never carry the marker, because `sync-required-checks` derives the context from that job's own `name:`, while GitHub reports its check run as `<caller job name> / <called job name>`. The lint rejects that combination; put the marker on a caller-local reporter job that `needs:` the call instead.

A marked job whose `name:` holds a `${{ matrix.* }}` reference must also run on every run. `sync-required-checks` registers one context per matrix combination, such as `Test (3.11)` and `Test (3.12)`. GitHub posts a check run for each context only when the job runs. Two things skip the job: its own `if:` closes, or a job it `needs:` skips. Each context then stays "Expected — Waiting for status to be reported". The branch blocks, no check turns red, and there is no log to read.

The lint rejects that shape too. Make the job unconditional and gate its steps instead. Or add a sibling job that runs on `if: always()`, carries the same `name:` template and covers the same matrix. A `uses:` job is no such sibling, because GitHub names its check run `<caller job name> / <called job name>`.

The lint reads a job's `if:` through the same three-valued evaluator `check-required-event-closure` uses. A condition the workflow's own triggers make true, such as `if: github.event_name == 'pull_request'` on a workflow that fires on nothing else, is no skip. The rest is an over-approximation, because the evaluator binds the event facts alone. A guard that never closes on the protected branch, such as `if: github.repository == '<owner>/<repo>'`, is skippable here and is no defect there. Answer that case with `# matrix-context-ok: <reason>` on the job. The reason is mandatory.

```bash
pip install "git+https://github.com/AlexanderMattTurner/ci-truth-serum@v1.0.0"

# Report drift and exit non-zero WITHOUT mutating (PR-safe gate):
sync-required-checks --repo owner/name --check

# Rewrite the ruleset to match the annotations:
GH_TOKEN=<token-with-administration:write> sync-required-checks --repo owner/name
```

The mutation path needs a token in `GH_TOKEN` or `GITHUB_TOKEN` with `administration: write`. It reads the marker from the same scoped lines that the lint classifies, so the gate and the apply step can never disagree. Pass `--ruleset-id` if the repo has more than one branch ruleset.

### Apply: keep a merge queue able to merge

`sync-merge-queue` reads the merge queue rule of the same branch ruleset. A merge queue stops merging when two of its parameters change, and nothing turns red: GitHub builds each group, watches every check pass, and merges none of them. The script repairs those two parameters and leaves every other parameter as a human set it.

- `grouping_strategy` is pinned to `ALLGREEN`. Under `HEADGREEN` an entry merges on another entry's build, so an untested change reaches the branch. Pass `--allow-headgreen` for a repo whose checks re-test the whole group.
- `max_entries_to_merge` and `max_entries_to_build` must be above zero. A zero lets a group hold no entry at merge time. The repair writes `1`, and any positive size survives.

Three more states stop every merge, and only a human can fix them. The script reports each one and exits non-zero: a ruleset that is not enforced, a queue whose `merge_method` the repo settings forbid, and a ruleset with no always-on bypass for the merge queue app. The queue merges a group by a push outside any pull request, so a bypass scoped to pull requests does not cover it. Pass `--skip-bypass-check` for a repo whose ruleset never refuses that push.

```bash
# Report what is broken and write nothing:
GH_TOKEN=<token-with-administration:write> sync-merge-queue --repo owner/name --check

# Repair the two parameters, then read the ruleset back:
GH_TOKEN=<token-with-administration:write> sync-merge-queue --repo owner/name
```

Run it on each push to the default branch, beside `sync-required-checks`. A repo whose branch ruleset carries no merge queue rule exits 0 and says so.

### Config: enforce twin pins with check-lockstep-pins

`check-lockstep-pins` replaces a “keep these in lockstep” comment with a gate. The motivating pair is a `rev:` in `.pre-commit-config.yaml` and a `pip install git+…@` pin of the same release in a workflow:

```yaml
- id: check-lockstep-pins
  args:
    - --pair
    - .pre-commit-config.yaml
    - 'ci-truth-serum\s+rev:\s*(\S+)'
    - .github/workflows/lint.yaml
    - 'ci-truth-serum\.git@(\S+)'
```

Each regex needs exactly one capture group, and it must match exactly once in its file. Zero matches means the pattern rotted, and several matches are ambiguous; both are a hard error. The two captures must be equal. Repeat `--pair` for more pins.

### Apply: verify a release with release-canary

`release-canary` confirms that the places where a release leaves its version agree. It reads two markers: the semver-max `v*` git tag, and the top dated `## [x.y.z]` heading in the changelog. It skips a `## Unreleased` heading. If the repo also ships to the AUR, the `pkgver=` line in a `PKGBUILD` is a third, optional marker. The tool reads that marker only when a PKGBUILD is present, so it catches a forgotten bump and leaves a repo without one unaffected. It skips a build-time `pkgver()` that it cannot read offline, and it never treats that as a failure. The tool reports a marker that is absent entirely as a missing marker. A changelog that somebody rolled but never tagged is the common case, and that is what a half-finished release looks like. On a mismatch the tool prints every present value with its label and exits non-zero. **The tool reads every marker locally, so it makes no network request and needs no registry credentials.** It runs in the same restricted job that cut the release.

```bash
pip install "git+https://github.com/AlexanderMattTurner/ci-truth-serum@v1.0.0"

release-canary                           # tag + changelog in the current repo
release-canary --changelog CHANGELOG.md --repo-dir .
release-canary --pkgbuild aur/PKGBUILD   # a non-default PKGBUILD location
```

Run it as a post-release workflow step. It then catches two failures the same day rather than at the next release. The first is a publish that died after tagging. The second is a tag push that returned 403 after publishing.

### Apply: find the failures nothing reported with startup-failure-scan

`startup-failure-scan` names the workflows whose runs failed before any job started. GitHub creates a run for a workflow file it cannot load. The run completes, it carries a failure, and it holds zero jobs. Every route that reports a failure needs a job, so this one route reaches nobody:

- a notifier that watches through `on.workflow_run` reports per job, and this run has none to name;
- an `if: always()` reporter is itself a job, so it never runs, and a required check waits at `Expected — Waiting` instead of turning red;
- the pre-commit lints in this pack cannot see the file either, because the YAML that a parser accepts is a larger set than the YAML that the Actions loader accepts.

The tool reads run history, so it needs the API and a token. It is not a pre-commit lint, and no tier aggregate runs it. Run it from a weekly health job:

```bash
pip install "git+https://github.com/AlexanderMattTurner/ci-truth-serum@v1.0.0"

GH_TOKEN=<token-with-actions:read> startup-failure-scan --repo owner/name
startup-failure-scan --repo owner/name --window-days 14 --format markdown
```

The scan reads the whole window for each workflow, and not the newest page of it. That matters on a busy repo: a workflow that runs 100 times a day puts 700 runs in a 7-day window, and a scan that read only the first 100 would answer about the last day while the report said a week. It exits non-zero when it finds anything; pass `--report-only` for a job that only publishes the report. `--format markdown` prints a table to paste into a tracking issue. This repo runs the scan every Monday; copy `.github/workflows/startup-failure-scan.yaml` for the whole job, which needs only the `actions: read` permission.

The cost is one request for each 100 completed runs, plus one for each failing run that did not conclude `startup_failure`. A successful run costs nothing. The Actions API stops paginating at 1000 items, so one workflow costs at most 10 listings. A workflow busier than that is the one case the scan cannot read in full, and the report names it and marks its count as a floor.

**The obvious version of this scan reports every repo healthy.** A run that failed to load concludes `startup_failure`, and not `failure`. The `status=` filter on the runs listing matches the conclusion, so `status=failure` never returns one. This tool asks for `status=completed` and classifies each conclusion itself. It leaves out `cancelled` and `skipped`, because a run cancelled in the queue also holds zero jobs and is not a broken file.

## Contributing

[`CONTRIBUTING.md`](CONTRIBUTING.md) states the rule for what belongs here. It gives three tests a proposed check must pass, says which tier and tag a new check takes, and lists the files one check has to ship. Read it before you open a pull request that adds a check.
