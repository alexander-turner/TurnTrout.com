# ci-truth-serum

**Make your CI confess what it’s hiding.** A pack of fast, offline pre-commit
lints that catch two kinds of lie a green check can hide:

- **Honesty lies:** the pipeline reports success while the real work failed
  (exit codes masked by pipes), or a required check silently never reports and
  the PR hangs forever.
- **Identity lies:** a base image or downloaded artifact is pinned to a
  _mutable_ name (a tag, a bare URL), so the bytes you run aren’t provably the
  bytes you reviewed.

## What it checks

### Honesty (Tier 1, default-on)

| Hook                       | Failure it prevents                                                                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check-workflow-pipefail`  | CI went green while `pytest` was crashing, because `pytest \| tee log` exits with `tee`’s status—under a `runCmd:` / `shell: sh` / custom `bash` that lacks `pipefail`.                                                                    |
| `check-exit-suppression`   | A teardown that left a volume pinned reported success, because `cleanup \|\| true` discarded its non-zero exit while keeping its output.                                                                                                   |
| `check-stderr-suppression` | A container launch failed with a bare non-zero and no clue why, because `docker compose up 2>/dev/null` threw away the only diagnostic.                                                                                                    |
| `check-substitution-exit-swallow` | An allowlist-building loop reported success while adding nothing, because `done < <(jq …)` (or `jq … \| while read`) discards `jq`/`yq`'s exit status—a renamed key or malformed input makes the producer exit non-zero, the loop iterates zero times, and the fail-open goes unnoticed. Curated to `jq`/`yq` (structured-data extractors whose non-zero exit is a fail-closed signal); opt out with `# allow-substitution-exit: <reason>`. |
| `check-pr-paths`           | A required check hung at “Expected—Waiting” forever and the PR could never merge, because `paths:`/`paths-ignore:`/`branches:` on `pull_request` skipped the workflow without reporting (a stacked PR on a non-main base is the branch-filter trap). |
| `check-pipefail-grep-pipe` | A teardown check reported a still-present secret as removed, because `secret_store ls \| grep -q "$name"` under `pipefail` let grep’s early exit SIGPIPE the producer, surfacing 141 as no-match once the listing outgrew the pipe buffer. |

### Identity (Tier 1, default-on)

| Hook                       | Failure it prevents                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-pinned-base-images` | The base image you reviewed and the one CI built diverged, because `FROM node:22` is a mutable tag the registry can re-point. **Demands a `@sha256:` digest.** |
| `check-pinned-downloads`   | A tampered release or compromised mirror swapped the binary you `curl`ed and then ran, because the download carried no checksum/signature check.               |

### Opinionated (Tier 2, opt-in)

| Hook                         | Failure it prevents                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check-always-reporter`      | A gated workflow stranded a required check at “Expected—Waiting” when the decide gate skipped every work job. Assumes a **decide-job + `always()` reporter** pattern.                                                                                                                                                    |
| `check-required-reporter`    | A new `always()` reporter shipped as a green-but-never-required check because nothing tied a workflow’s reporters to the branch-protection required-set. Assumes the required-set is mirrored from these annotations.                                                                                                    |
| `check-inline-run-length`    | A long inline `run:` block shipped unchecked (unquoted expansions, missing `pipefail`) because shellcheck/shfmt/shellharden only see standalone `.sh` files.                                                                                                                                                             |
| `check-concurrency`          | New pushes queued behind stale runs instead of cancelling, because a `concurrency:` block omitted `cancel-in-progress` and it silently defaulted to `false`.                                                                                                                                                             |
| `check-static-concurrency`   | A required check hung at “Expected—Waiting” forever, because a static workflow-level `concurrency.group` (no `github.ref`/`head_ref` key) let a sibling ref’s run cancel this one’s pending run wholesale before any job—and its `always()` reporter—ever started.                                                       |
| `check-requires-concurrency` | A `pull_request(_target)` workflow shipped with **no** `concurrency:` block at all, so every push to a PR started a second full run instead of cancelling the superseded one—stacking runs on a capped, shared runner pool. (`check-concurrency` only validates a block that exists; this one requires it to exist.) Satisfied by a block at the workflow level **or** on any job. Opt out with `# concurrency-not-required`. |
| `check-externalized-markers` | A workflow guard that scans inline `run:` for a policy marker (e.g. a history-rewrite command that demands `fetch-depth: 0`) went blind and passed vacuously the moment that command moved into `.github/scripts/*.sh` or a composite action. Flags any job where the marker is reachable only through that indirection. |
| `check-path-gate-deps`       | A gated job silently skipped—and its `always()` reporter went green—on the exact PR that changed a file the job depends on, because the decide job's path filters omitted a composite action or `.github/scripts/` helper. Verifies every gated job's static dependencies (composites, run scripts one `source` hop deep, and `# gate-deps:`-declared paths) are covered by the decide filters; suppress one dep with `# path-gate-ok: <dep> <reason>`.                                              |
| `check-failure-notifier-coverage` | A new push/schedule workflow failed silently forever because `ci-failure-notify.yaml`'s `on.workflow_run.workflows` list (necessarily a hand-copied list—`workflow_run` has no wildcard) was never updated. Round-trip freshness check: the list must equal the tree's push/schedule workflow names; prints the corrected block on mismatch. Pass `--require-notifier` to fail when the notifier workflow itself is missing.                                                          |

### Unrelated bonus checks (Extras)

| Hook                         | Failure it prevents                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `check-symlinks`             | A tracked symlink with an absolute target (`/Users/you/...`) broke on every machine but the author’s.                       |
| `check-unnamed-regex-groups` | A regex’s match handling went positional and brittle because a `re.*` literal used an unnamed `( )` group.                  |
| `check-global-stdio-swap`    | Concurrent calls clobbered each other’s output because code reassigned the process-global `sys.stdout` to capture I/O.      |
| `check-claude-model`         | A `claude-code-action` step billed Opus silently because it omitted `--model` and rode the action’s expensive default tier. |
| `check-drift-guards`         | A copies-agree ("drift guard") test shipped with no stated reason why a single source of truth is infeasible—the duplication it polices kept drifting anyway. Requires `@pytest.mark.drift_guard("<why no SSOT is feasible>")` on any test whose name/docstring reads as a drift guard, so the judgement is reviewed, not implied. |
| `check-graceful-handwave`    | A doc or comment claimed the code "fails gracefully"—a guarantee that specifies nothing (which input? which exit code?)—and nobody could tell whether the behaviour was real or wished-for. Scans prose (Markdown/RST) line-by-line and code comment-only; opt out by stating the behaviour: `allow-graceful: <what actually happens>`. Pass `--prose` to scan a free-standing text file (e.g. a PR body) line-by-line. |
| `check-historical-comments`  | A comment narrating the past ("renamed from X", "now uses Y") rotted into a lie the moment the code moved—the reader can't see the old code, so the note was unverifiable from day one. Bans only tokens with no present-tense reading; opt out (e.g. a reader of a legacy on-disk format) with `# allow-history: <reason>`. |
| `check-doc-line-refs`        | A doc cited source by exact line number and pointed at whatever now happens to live there after the next refactor. Bans `<file>.<ext>:<N>` and `(L<N>)`-style cites in Markdown (fenced code blocks and any `CHANGELOG.md` are skipped); cite a function/section/anchor instead, or suppress with `<!-- allow-line-ref: <reason> -->`. |
| `check-flag-arity`           | A CLI parser died with a raw `$2: unbound variable` instead of a clean "--branch needs a value", because a `--branch) X="$2"; shift 2` arm trusted the loop's outer `$# -gt 0` (which proves only `$1`) and the flag was passed last. Flags any `case` arm whose label is a `-x`/`--xxx`/`--xxx=*` option that reads `$2`/`shift 2` without its own guard; satisfied by `[[ $# -ge 2 ]] \|\| die`, a self-guarding `${2:?…}`, or a `need_val`/`need_arg` helper. Suppress with `# flag-arity-ok: <why>`. |

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
  - repo: https://github.com/alexander-turner/ci-truth-serum
    rev: v0.1.0 # pin to a tag
    hooks:
      # ── Tier 1 · Honesty (default-on) ──
      - id: check-workflow-pipefail
      - id: check-exit-suppression
      - id: check-stderr-suppression
      - id: check-substitution-exit-swallow
      - id: check-pr-paths
      - id: check-pipefail-grep-pipe
      # ── Tier 1 · Identity (default-on) ──
      - id: check-pinned-base-images
      - id: check-pinned-downloads
      # ── Tier 2 · Opinionated (opt-in: uncomment to enable) ──
      # - id: check-always-reporter      # assumes a decide-job + always() reporter
      # - id: check-required-reporter    # classify each always() reporter required-check: true|false
      # - id: check-inline-run-length
      # - id: check-concurrency
      # - id: check-static-concurrency   # static workflow-level concurrency.group on a required check
      # - id: check-requires-concurrency  # every pull_request workflow must declare a concurrency block
      # - id: check-externalized-markers  # marker reachable only via script/composite indirection
      # - id: check-path-gate-deps       # decide filters must cover every gated-job dependency
      # - id: check-failure-notifier-coverage  # keep ci-failure-notify's workflow_run list fresh
      # ── Extras · Unrelated bonus checks (opt-in) ──
      # - id: check-symlinks
      # - id: check-unnamed-regex-groups
      # - id: check-global-stdio-swap
      # - id: check-claude-model         # require an explicit --model on claude-code-action steps
      # - id: check-drift-guards         # copies-agree tests must justify why no SSOT is feasible
      # - id: check-graceful-handwave    # "graceful" hand-waves must state the concrete behaviour
      # - id: check-historical-comments  # comments describe the present code, not its past
      # - id: check-doc-line-refs        # docs cite symbols/sections, not line numbers
      # - id: check-flag-arity           # value-taking CLI flag arms must guard $2 before reading it
```

`pre-commit run --all-files` sweeps the whole repo (handy on first adoption).

### Enable a whole tier with one id

Instead of adding a new `- id:` every time a check ships, enable a tier
aggregate: one id runs every Python check in that tier, and checks added later
are picked up with **no change to your config**:

```yaml
repos:
  - repo: https://github.com/alexander-turner/ci-truth-serum
    rev: v0.1.0 # pin to a tag
    hooks:
      - id: check-tier1 # all honesty + identity checks (the safe default-on set)
      # - id: check-tier2   # all opinionated checks: assumes the decide-gate + reporter architecture
      # - id: check-extras  # the Python extras (vendor-/style-specific)
```

`check-symlinks` is the only check not in an aggregate: it is a shell
(`language: script`) hook, not a Python module, so add its `- id:` separately if
you want it. Mixing an aggregate with individual ids is fine (a check just runs
twice).

### Scope one check to specific paths

When one check in a tier needs tighter file scoping than the rest (e.g.,
`check-exit-suppression` is too strict for your `tests/` directory), use
`--skip <module_name>` to drop it from the aggregate, then re-add it as a
standalone hook with normal pre-commit `files:`/`exclude:` filters:

```yaml
- repo: https://github.com/alexander-turner/ci-truth-serum
  rev: v0.1.0
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
registry in `hooks/run_tier.py` (e.g., `check_exit_suppression`, not
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

## Complements, doesn’t replace

ci-truth-serum enforces policy gaps; keep running the tools it doesn’t
duplicate: [`zizmor`](https://github.com/woodruffw/zizmor) to SHA-pin `uses:`
references, [`hadolint`](https://github.com/hadolint/hadolint) for Dockerfiles
(`check-pinned-base-images` is stronger: it demands a `@sha256:` digest, not just
an explicit tag), [`actionlint`](https://github.com/rhysd/actionlint) for
workflow syntax/types, and `shellcheck` for shell.
