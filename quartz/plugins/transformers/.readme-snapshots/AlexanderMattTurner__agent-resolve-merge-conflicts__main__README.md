# agent-resolve-merge-conflicts

**A reusable GitHub Actions workflow that clears a pull request's merge conflicts for you.** It merges the base branch into the pull request, then pushes the result as an ordinary merge commit.

It resolves in two passes:

1. **The pre-pass rebuilds every conflicted generated file instead of guessing it.** A lockfile goes through its own lock command, and a generated artifact through its generator.
2. **A model resolves the source conflicts that remain.**

A conflict that neither pass can settle stops the run and comments on the pull request. A binary file is one example, and a `-merge` file that no rule owns is another. This check runs before any model call, so an unresolvable conflict costs nothing.

You call it from your own repository by `uses:`, pinned to a commit with the release version in a trailing comment — see [Versioning](#versioning).

## Call it

```yaml
jobs:
  resolve:
    # The ceiling this workflow's own jobs are narrowed from. A called workflow
    # may request only what the calling job holds, so granting less ends the run
    # in `startup_failure` before any job starts.
    permissions:
      actions: write
      contents: write
      issues: write
      pull-requests: write
      statuses: write
    uses: AlexanderMattTurner/agent-resolve-merge-conflicts/.github/workflows/auto-resolve.yaml@c1fb78da6cb6a769e41d4d6fee71225a963b3191 # v1.18.0
    with:
      pr: ${{ matrix.pr.number }}
      resolver-repository: AlexanderMattTurner/agent-resolve-merge-conflicts
      # Leave `resolver-ref` unset. The workflow reads the sha the `uses:` line
      # names back out of `job.workflow_sha`, so the pin is written once.
      # Set `debug: true` while adopting: every run then comments its own
      # diagnostics on the PR, including a run that died before it started.
      #
      # Drop these three if your repository has no generated files. Together
      # they turn the deterministic pre-pass on; without them a lockfile
      # conflict reaches the model, which has no correct resolution for one.
      marked-regions: true
      resolver-mjs: .github/scripts/resolve-generated.mjs
      pre-pass-command: node .github/scripts/resolve-generated.mjs
    secrets:
      FAR_ANTHROPIC_API_KEY: ${{ secrets.FAR_ANTHROPIC_API_KEY }}
      # ... the remaining 9; see `.github/workflows/auto-resolve-conflicts.yaml`
      # in this repository for a block a consumer can copy verbatim.
```

That job is half of an adoption. Copy `.github/workflows/auto-resolve-conflicts.yaml` from this repository as your starting caller: it owns the triggers, the `discover` job that decides which pull requests to hand over, and the `relay` job that re-fires a push or scheduled scan as a `workflow_dispatch`. This workflow owns everything after that.

The `permissions:` block on the calling job is the ceiling its nested jobs are narrowed from, not a grant. GitHub lets a called workflow request only what the calling job already holds, so a caller that grants less ends the whole run in `startup_failure` before any job starts — no red job, no reported check.

Every input fails closed when empty. No `log-redactor` publishes no fan-out logs. No `setup-command` prepares nothing, so a repository whose checkout an agent cannot start in — a tracked symlink that dangles in CI, for one — names its own repair there. It runs on the merged tree just before the model, whatever it changes is put back before the merge is bundled, and a fork head runs none. It is the one command input evaluated by a shell (`bash -eo pipefail -c`); `pre-pass-command` and `post-merge-check-command` are split into argv and run with none. No `pre-pass-command` refuses to bundle a deferred generated file rather than shipping bytes no build produces. An empty `bot-actors` admits no bot. `post-merge-check-command` is the exception in one direction only: empty runs no whole-tree check, so a merge that keeps both parents' definition of one name reaches the branch with nothing naming what it broke. Name your type-checker or import-check there — `bash .github/scripts/pyright-passes.sh` — and a resolution that breaks the tree is pushed with a comment naming what it broke, so the conflict is resolved once and the finding is fixed on a branch that no longer conflicts. The command runs in the `resolve` job, which holds no push credential, and it must only REPORT; one that stages a file is refused. Exit 1 to 125 judges the merged tree, and 126 and above is read as the shell's `never ran`, which blames this workflow's provisioning rather than your branch. The pre-push merge-delta self-review is opt-in: pass `self-review: true` when no CI of yours reads the pushed delta and gates the merge on the finding, because the resolver otherwise pushes merges nothing will ever review.

## Configuration

Every knob is a repository VARIABLE, so you tune the resolver without editing a file that template-sync would hand back.

| Variable                             | Default                             | What it does                                                                                                                   |
| ------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `AUTO_RESOLVE_DISABLED`              | unset                               | `true` turns the whole workflow off.                                                                                           |
| `AUTO_RESOLVE_SCHEDULE_DISABLED`     | unset                               | `true` turns off the scheduled backstop scan and leaves the event-driven triggers on.                                          |
| `AUTO_RESOLVE_MAX_COMMIT_AGE_HOURS`  | `24`                                | How old a pull request's newest activity may be and still be resolved. `0` removes the window.                                 |
| `AUTO_RESOLVE_ATTEMPT_TTL_HOURS`     | `2`                                 | How long one head's attempt mark suppresses a second paid resolve.                                                             |
| `AUTO_RESOLVE_ATTEMPT_FLOOR_MINUTES` | `20`                                | How old that mark must be before a push to the base branch re-enables the pull request.                                        |
| `AUTO_RESOLVE_PROTECTED_RE`          | `^(\.github/\|\.claude/\|\.hooks/)` | ERE over repo-relative paths. A conflict inside one is still resolved, and the pushed-resolution comment flags it for a human. |
| `AUTO_RESOLVE_CHAINED_CHILDREN`      | `on`                                | `log` reports each stacked pull request the resolver would take, and refuses it.                                               |

The scheduled scan runs every 5 minutes and costs a few `gh` API calls. It reaches the model only when it finds a conflicting pull request, so an idle repository pays no model cost for the cadence. Change the cron in your own copy of the caller to slow it.

## Derived files

The three inputs above need three files in your own repository. `config/auto-resolve-regen-rules.json` lists each rule: the `sources` that change, the `command` or `generator` that re-derives, and the `owns` paths it writes. `.github/scripts/resolve-generated.mjs` reads that file and runs the rules. `scripts/lib_marked_region.py` handles a file that is only PARTLY generated, through `BEGIN GENERATED:`/`END GENERATED:` markers.

Copy all three from this repository and replace the rules with your own. This repository ships two: `uv lock` for `uv.lock`, and `pnpm install --lockfile-only` for `pnpm-lock.yaml`.

## Hook toolchain pins

Before it bundles a resolution, the resolver runs YOUR pre-commit hooks over the merged files, so it installs the toolchain those hooks need. It reads the versions from your own repository at the base ref: `SHELLCHECK_PY_VERSION` and `SHFMT_VERSION` in `.github/tool-versions.sh`, and the `dev` extra of `pyproject.toml` for the Python packages a `language: system` hook imports. A missing pin fails the run by name rather than installing whatever PyPI ships that day.

## When it cannot resolve

A conflict with neither a deterministic nor a textual resolution fails the run with a pull request comment, before any model cost. That is a binary file, or a file marked `-merge` in `.gitattributes` that no regen rule owns.

A YAML or TOML conflict always goes to the model, never to the free structural pre-pass. On those two types mergiraf keeps one side and drops the other while reporting success, so the pre-pass would push a resolution that lost content with no marker to show it. For the same reason the resolver redirects those files to git's line merge for the run, by writing `$GIT_DIR/info/attributes`. It lists only the paths your tree binds to `mergiraf`, so a file you mark `-merge` — every lockfile — keeps refusing to merge; nothing else you set is touched.

A merge that changes `.github/workflows/` needs the workflow-scoped `TEMPLATE_SYNC_TOKEN_ORG` PAT: GitHub refuses a workflow edit pushed with any other credential. Without that secret, such a merge is refused and the pull request gets the `auto-resolve-blocked` label. A labeled pull request is skipped until a human removes the label, so a broken grant stops the treadmill instead of buying the same failure on every scan.

## The trust model

Two jobs, and the split IS the security boundary.

`resolve` checks out the PULL REQUEST'S OWN HEAD to merge into it, and runs the model there. It holds `contents: read`, the Claude billing tokens, and `pull-requests: write` on the calling repository's own `GITHUB_TOKEN` — nothing else.

`land` holds every write credential (`AUTOFIX_TOKEN_ORG`, and the workflow-scoped `TEMPLATE_SYNC_TOKEN_ORG`) and runs none of the untrusted code.

The separation is load-bearing rather than tidy. Anything running in `resolve` can append to `$GITHUB_ENV` or `$GITHUB_PATH`, so the unit of exposure is the JOB, not the step. **A composite action runs in one job and cannot express this split.** One artifact crosses the boundary — a git bundle of the merge commit — and `land` treats it as untrusted: it requires both parents to be commits already on the two named branches, refuses conflict markers, and replays the merge in a tree the model never touched.

### The three trees

| Tree                      | Holds                              | Trusted |
| ------------------------- | ---------------------------------- | ------- |
| `${RUNNER_TEMP}/resolver` | this repository, at the pinned sha | yes     |
| `${RUNNER_TEMP}/base`     | the caller at `github.sha`         | yes     |
| `${GITHUB_WORKSPACE}`     | the pull request head, mid-merge   | **no**  |

Both trusted trees are a plain `git clone`, because `actions/checkout`'s `path` must sit under `$GITHUB_WORKSPACE`.

`resolver-mjs` arrives repo-relative and is absolutized against the trusted base checkout once, in the `base` step. One of its two readers is `remerge-diff-report.py`, which decides which deltas the self-review stops reading — so a relative path would let a pull request declare its own evil merge generator-owned.

## Secrets

The `secrets:` block names 10 secrets and never uses `secrets: inherit`. The list IS the contract a consumer configures against; inheriting would hand a resolver run every unrelated secret the calling repository holds. Each is optional — an unset ladder rung is dropped, and an unset org PAT narrows what `land` can push rather than failing the call.

`tests/test_auto_resolve_reusable_secrets.py` asserts the read set and the declared set are equal in BOTH directions, because an undeclared secret arrives empty and reads as a dead credential rather than as a mistake.

## Versioning

Each release tags `vX.Y.Z` and advances a moving major tag (`v1`) to the same commit. This repository publishes no package, so the git tag IS the release.

A `uses:` ref may be a SHA, a tag or a branch. GitHub calls [the commit SHA the safest option](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows), because a tag can be moved onto a commit you never reviewed. `v1` moves on every compatible release, so it is the least reviewable ref this repository offers.

**Pin the SHA and name the version beside it**, the way this repository's own caller does:

```yaml
uses: AlexanderMattTurner/agent-resolve-merge-conflicts/.github/workflows/auto-resolve.yaml@c1fb78da6cb6a769e41d4d6fee71225a963b3191 # v1.18.0
```

That line reads as a version and resolves as an immutable commit. It names the newest release: `.github/scripts/release-tag.sh` rewrites both copies in this README, and the caller's, in the commit after each release. Copy it as it stands.

In your own repository Dependabot's `github-actions` ecosystem updates a reusable-workflow ref, so it bumps the SHA and rewrites the comment for you. This repository moves its own copies instead, because a caller pins the releases of the repository it calls rather than its own.

A tag ref works if you prefer one. The resolver checks out whatever commit the ref names, so nothing inside the run depends on the choice.

## Tests

```bash
node --test .github/resolver/auto-resolve/*.test.mjs   # the resolver's own suite
uv run --extra dev pytest tests/ -q                    # the repository's suite
uvx pre-commit==4.6.0 run --all-files
uvx zizmor==1.25.2 .github/
```

## Decisions

**No GitHub Marketplace listing, and no root `action.yml`.** [Marketplace lists actions only](https://docs.github.com/en/actions/creating-actions/publishing-actions-in-github-marketplace), from an `action.yml` in the repository root, so a reusable workflow cannot be listed. A thin root composite would be listable, but a composite runs in ONE job, so it cannot give the two-job privilege split that is the reason this workflow exists; publishing one would advertise a shape that silently drops the security boundary.

A listing is a discovery surface, not a delivery one. Every public repository is already callable by `uses:`, so a listing would change nothing about how you adopt this workflow or how you pin it.
