# Claude Automation Template

A GitHub template that makes [Claude Code](https://docs.anthropic.com/en/docs/claude-code) work reliably on your repositories. It wires up git hooks, CI workflows, and Claude session hooks so that Claude can autonomously fix code, create PRs, and respond to `@claude` mentions—with safeguards to prevent broken code from shipping.

## Why Use This

**Without this template**, using Claude Code on a repo requires manually configuring hooks, writing CI workflows, and building guardrails against common failure modes (infinite retry loops, pushing broken code, inconsistent formatting).

**With this template**, you get all of that out of the box:

- **A solid starting CLAUDE.md**—upholds high code quality standards, including a self-critique loop that catches bugs before they leave the editor
- **Pre-push verification**—build, lint, type checks, and tests run automatically before every `git push` or `gh pr create`
- **Deadlock-proof session hooks**—every hook is syntax-checked at session start, wrapped in a launcher that degrades to “ask” on parse failure, and commits with conflict markers are rejected up front
- **Skill-driven PR flow**—the `pr-creation` skill runs an iterative compress-critique-fix loop on the diff, then watches CI and fixes failures before reporting back
- **Enforced code quality**—Conventional Commits (via commitlint), Prettier formatting, and lint-staged run on every commit
- **`@claude` GitHub integration**—mention Claude in issues or PR comments and it responds with full repo context
- **Weekly security sweeps**—a scheduled workflow collects Dependabot, code-scanning, secret-scanning, and `pnpm audit` alerts, then hands them to Claude to open a rollup fix PR
- **Automatic template sync**—downstream repos receive improvements daily via PR, with 3-way merge that preserves your customizations
- **Multi-language support**—Node.js (pnpm), Python (uv/ruff/pytest), and shell (shfmt/shellcheck) work out of the box

## Prerequisites

- [Node.js](https://nodejs.org/) (see `.nvmrc` for the pinned version)
- [pnpm](https://pnpm.io/) (`npm install -g pnpm` if you don’t have it—`setup.sh` handles this automatically)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- (Optional) [uv](https://docs.astral.sh/uv/) for Python projects

## Quick Start

1. **Create your repo**—click **“Use this template”** on GitHub.
2. **Clone and set up:**

   ```bash
   git clone <your-repo-url>
   cd <your-repo>
   ./setup.sh
   ```

   This installs dependencies and configures git hooks. Verify the output ends with `✓ Setup complete!`.

3. **Install the [Claude GitHub App](https://github.com/apps/claude)** to enable `@claude` mentions in issues and PRs.

4. **Customize for your project:**
   - Edit **`CLAUDE.md`**—add project-specific context, architecture notes, and conventions for Claude.
   - Edit **`package.json`**—wire up your `dev`, `build`, `test`, `lint`, and `check` scripts. Unconfigured scripts are detected and skipped (the CI job reports success without running them), so nothing breaks on first push.

## What’s Included

### Git Hooks (`.hooks/`)

| Hook          | What it does                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit`  | Runs lint-staged—auto-formats with Prettier, shfmt, and ruff depending on file type                                                          |
| `commit-msg`  | Validates [Conventional Commits](https://www.conventionalcommits.org/) format via commitlint                                                 |
| `lint-skills` | Lint-staged helper—validates skill files have required frontmatter (`name`, `description`)                                                   |
| `pre-push`    | Reruns the pre-commit suite scoped to the pushed commit range, plus the portable-symlink check, before a plain `git push` reaches the remote |

### Claude Session Hooks (`.claude/hooks/`)

These run inside Claude Code sessions (local CLI or cloud), not in CI.

| Hook               | What it does                                                                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart`     | Installs tools (shfmt, shellcheck), configures git, installs dependencies                                                                                                          |
| `PreToolUse`       | Runs build/lint/typecheck/tests before `git push` or `gh pr create`                                                                                                                |
| `PostToolUse`      | Nudges once per turn (with the counts) when work runs serially instead of using parallel sub-agents or batched tool calls                                                          |
| `UserPromptSubmit` | Drops non-actionable PR webhook turns (a CI event on a SHA a newer push already superseded, or an opted-out bot notification) before the model runs; fails open on any uncertainty |

### Claude Skills (`.claude/skills/`)

| Skill                  | What it does                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `pr-creation`          | Self-critique workflow before PR submission, then watches CI and fixes failures                  |
| `update-pr`            | Updates an existing PR with new changes and optionally revises the description                   |
| `conventional-commits` | Guides Claude through properly formatted commits with secret detection                           |
| `markdown-block`       | Outputs content in a fenced code block so users can copy raw markdown                            |
| `peer-review`          | Runs the read-only `code-reviewer` agent on the diff, then triages and fixes                     |
| `explore-plan`         | Enforces the Explore → Plan → Critique → Review → Verify discipline for non-trivial work         |
| `ci-triage`            | Diagnoses a red or cancelled check from its log instead of assuming flake/pre-existing/unrelated |
| `writing-tests`        | Governs writing, changing, or reviewing tests—test behavior, not source text                     |

### Claude Subagents (`.claude/agents/`)

| Agent           | What it does                                                                         |
| --------------- | ------------------------------------------------------------------------------------ |
| `code-reviewer` | Read-only reviewer (Read/Grep/Glob, `model: opus`)—unbiased second opinion on a diff |

### GitHub Actions (`.github/workflows/`)

| Workflow                           | What it does                                                                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude.yaml`                      | Responds to `@claude` mentions in issues and PR comments                                                                                                               |
| `claude-review.yaml`               | The Claude reviewers: auto-reviews every PR, reviews merge-resolution deltas ("evil merge" content in neither parent), resolves addressed reviewer threads on push     |
| `claude-reviewer-hold-clear.yaml`  | Cron sweep that lifts a stale reviewer hold once all its threads are resolved                                                                                          |
| `auto-resolve-conflicts.yaml`      | Auto-resolves PR merge conflicts (deterministic pre-pass + Claude), bounded to one attempt per head per TTL and to recently-active branches                            |
| `pr-meta.yaml`                     | PR metadata upkeep: `merge-conflict` labeling, remerge-diff sticky comment, post-merge title/description accuracy, force-push history integrity                        |
| `pr-meta-privileged.yaml`          | The privileged half of PR meta (write-token jobs, e.g. cancelling superseded runs)                                                                                     |
| `pr-review-advisory.yaml`          | Computes advisory review guidance (split advice, line breakdown) for each PR                                                                                           |
| `pr-review-advisory-comment.yaml`  | Posts the advisory review guidance as a PR comment                                                                                                                     |
| `template-sync.yaml`               | Daily sync from template repo with 3-way merge and conflict detection                                                                                                  |
| `phone-home.yaml`                  | Propagates "Lessons Learned" from merged PRs back to the template                                                                                                      |
| `security-vulnerability-scan.yaml` | Weekly security sweep—collects alerts, opens a rollup fix PR                                                                                                           |
| `node-tests.yaml`                  | Runs `pnpm test` (skips gracefully if unconfigured) <!-- allow-graceful: exits 0 with a "not configured" message when no test script exists -->                        |
| `lint.yaml`                        | Runs `pnpm lint` and `pnpm check` (skips gracefully if unconfigured) <!-- allow-graceful: exits 0 with a "not configured" message when no lint/check script exists --> |
| `format-check.yaml`                | Checks Prettier formatting                                                                                                                                             |
| `pre-commit.yaml`                  | Runs pre-commit hooks in CI                                                                                                                                            |
| `validate-config.yaml`             | Validates `.claude/` and `.hooks/` config on every push                                                                                                                |
| `decide-reusable.yaml`             | Reusable path-gate job: diffs the change range and tells expensive jobs whether to run                                                                                 |
| `dependabot-auto-merge.yaml`       | Auto-merges minor/patch Dependabot PRs after CI passes                                                                                                                 |
| `auto-version.yaml`                | Post-merge, publishes to npm and tags `vX.Y.Z` (non-private packages)                                                                                                  |
| `release-canary.yaml`              | Publishes a canary prerelease from main                                                                                                                                |
| `ci-failure-notify.yaml`           | Files a `ci-failure` issue when a post-merge or scheduled run fails                                                                                                    |
| `ci-failure-rates.yaml`            | Weekly per-check failure-rate table over recent main runs, so CI-repair effort is targeted with data                                                                   |
| `gitleaks.yaml`                    | Scans for committed secrets (PR diff, full history on main); PR-gating                                                                                                 |
| `zizmor.yaml`                      | Security-audits workflows/actions with zizmor; PR-gating                                                                                                               |
| `hook-lifecycle.yaml`              | Runs the full Claude hook lifecycle on a clean checkout so a broken hook is caught in CI; PR-gating                                                                    |
| `build-publish-notify.yaml`        | Pushes a phone alert (ntfy) when a build/publish run fails outside a PR (opt-in via `GH_NTFY_*`)                                                                       |
| `sync-required-checks.yaml`        | Post-merge, syncs branch-protection required checks to the workflows' `# required-check:` annotations                                                                  |

#### Required checks & branch protection

Each PR-gating workflow (`format-check`, `lint`, `node-tests`, `pre-commit`, `validate-config`, `gitleaks`, `zizmor`, `hook-lifecycle`) ends with an `if: always()` summary job—`format-check-passed`, `lint-passed`, `node-tests-passed`, `pre-commit-passed`, `validate-config-passed`, `gitleaks-passed`, `zizmor-passed`, `hook-lifecycle-passed`—that `needs:` the real job(s) and passes only when they all succeed (or skip). **Mark these `*-passed` jobs as Required in branch protection, not the underlying jobs.** (`sync-required-checks.yaml` keeps that set in step with the workflows' `# required-check:` annotations automatically, if you grant it a token.) A job that is cancelled or skipped never reports a status to GitHub, so a directly-Required job can leave a PR stuck “pending” forever; the always-running summary job calls the shared `report-job-result` composite action (`.github/actions/report-job-result/`), which passes on success or skip and, on a `cancelled` result, checks the branch tip to tell a benign supersession (a newer push already superseded this run) from a still-current cancellation that must fail closed.

> **Caveat:** the summary job only helps when its workflow runs at all. `lint`, `node-tests`, and `validate-config` use `paths` filters, so on a PR that doesn’t touch their paths the _entire_ workflow (summary job included) is skipped and posts nothing. If you mark those `*-passed` checks Required, drop the workflow’s `paths` filter (let the job run and short-circuit internally) so the gate always reports.

### Releases & changelog (npm packages only)

`auto-version.yaml` automates npm releases for repos published as a **versioned npm package**. On every push to the default branch, [`.github/scripts/version-bump.sh`](.github/scripts/version-bump.sh):

1. Reads the latest published version from npm (the registry is the source of truth—the version is **never committed** to `package.json`).
2. Decides a [Conventional Commits](https://www.conventionalcommits.org/) semver bump from the commits since the last `vX.Y.Z` tag (`feat!`/`BREAKING CHANGE` → major, `feat` → minor, else patch).
3. Publishes to npm with `pnpm publish --provenance` via **OIDC trusted publishing** (`id-token: write`, so no `NPM_TOKEN`), then promotes the `## Unreleased` block in `CHANGELOG.md` into a dated section (drafting the prose with Claude when that block is empty) and pushes the doc commit plus the new tag.

> **Self-publish guard:** `version-bump.sh` exits early when `package.json` has `"private": true` (the template's own default), so the template never publishes itself. A consumer **opts in** by dropping `private` and setting a real, publishable `name`.
>
> **The sync never introduces this workflow.** `.github/workflows/auto-version.yaml` is listed in `OPT_IN_PATHS` in `template-sync.yaml`: template-sync only _updates_ a copy that already exists. Adopt it by copying the file in once (and creating `CHANGELOG.md`, which lives outside the synced paths); opt back out by deleting it—it stays deleted, with no `EXCLUDE_PATHS` entry needed. This is the guard against a repo that already publishes ending up with **two** publishers: their concurrency groups differ, so they never serialize, both compute the same semver bump, and the loser dies on `npm error code E404 … PUT`—a message that names neither the duplicate nor the workflow that beat it.
>
> **Keeping your own release workflow?** Give it the template's workflow `name:`—`Auto version bump and publish`—or add your own name to the `workflows:` lists in `ci-failure-notify.yaml` and `build-publish-notify.yaml`. Those bind by workflow **name**, not filename, so otherwise your release failures notify nobody.
>
> **Protected default branch?** The release commit and tag push ride `GITHUB_TOKEN` by default, which a ruleset with required status checks rejects with GH013—npm publishes and the tag is stranded, so the next run re-reads the climbed version and bumps again. Set the optional `RELEASE_BYPASS_TOKEN` secret to a PAT for **this repo's own owner**, registered as a bypass actor on the ruleset. A cross-account PAT is rejected 403 and strands the release the same way.

### MCP Servers (`.mcp.json`)

Team-shared [MCP servers](https://modelcontextprotocol.io/) live in `.mcp.json` at the repo root. A starter `.mcp.json.example` is included with GitHub, Context7, and Playwright entries:

```bash
cp .mcp.json.example .mcp.json   # then edit, set any referenced env vars, and run /mcp to verify
```

**Resist tool bloat**—each server expands Claude’s reasoning overhead, so enable only the ones you actually use and add more on demand. Personal (non-shared) servers belong in `~/.claude.json`, not the committed `.mcp.json`.

### Session Tuning (`.claude/settings.json` env)

The `env` block in `.claude/settings.json` sets defaults tuned for long-running web/automation sessions:

| Variable                                     | Why                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW=400000`     | Compacts earlier to curb context rot on long sessions (tune to taste)  |
| `CLAUDE_CODE_AUTO_BACKGROUND_TASKS=1`        | Auto-backgrounds long-running commands instead of blocking the session |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` | Disables autoupdater/telemetry/error reporting (CI- and web-safe)      |

See the [Claude Code environment variables reference](https://code.claude.com/docs/en/env-vars) for the full list.

The same file's `permissions.deny` block blocks Claude from reading secret files (`**/.env`, `**/.env.*`, `**/*.pem`, `**/*.key`) so credentials can't be surfaced into a session transcript.

## How the Pieces Fit Together

```text
Developer / Claude Code session
        │
        ├── git commit
        │     ├── pre-commit hook  → lint-staged (Prettier, shfmt, ruff)
        │     └── commit-msg hook  → commitlint (Conventional Commits)
        │
        ├── git push / gh pr create
        │     └── PreToolUse hook  → build + lint + typecheck + tests
        │
        └── /pr-creation skill    → self-critique loop → create PR → watch CI
                                                                │
GitHub Actions (CI)                                             ▼
        ├── format-check.yaml     → Prettier
        ├── lint.yaml             → pnpm lint + pnpm check
        ├── node-tests.yaml       → pnpm test
        ├── pre-commit.yaml       → pre-commit hooks
        ├── validate-config.yaml  → .claude/ and .hooks/ validation
        │
        ├── claude.yaml           → @claude mentions in issues/PRs
        ├── template-sync.yaml    → daily template updates (9am UTC)
        ├── phone-home.yaml       → sends Lessons Learned back to template
        ├── security-*.yaml       → weekly vulnerability sweep + fix PR
        └── dependabot-*.yaml     → auto-merge minor/patch dependency bumps
```

## Automatic Updates

Template improvements sync daily at 9am UTC via `template-sync.yaml`. You can also trigger manually from **Actions > Sync from Template**.

Changes arrive as a PR for you to review. The sync uses a 3-way merge that preserves local customizations in synced files—if there’s a conflict, Claude is asked to resolve it while keeping your project-specific changes intact.

### Auto-resolving merge conflicts

`auto-resolve-conflicts.yaml` picks up any open PR that conflicts with its base branch, merges the base in, resolves the conflicted files with Claude, and pushes the merge back to the PR branch. It is on by default. The resolver itself lives in [`agent-resolve-merge-conflicts`](https://github.com/AlexanderMattTurner/agent-resolve-merge-conflicts) and is called by SHA, so this repository ships the caller and none of the resolution machinery. Every part of it can be turned off with a repository variable — **Settings → Secrets and variables → Actions → Variables** — with no YAML edit and nothing to re-sync from the template.

Two jobs, and the split is the security boundary. `resolve` checks out the PR's own head, runs the PR's own dependencies and the model, and holds **no push credential**; the only thing it produces is a git bundle containing one merge commit. `land` holds the push token, runs nothing that came from the PR, and treats that bundle as untrusted: it replays the same merge itself in a clean tree and pushes only if the bundled commit differs from its own replay exclusively in files git actually left conflicted. Content that appears in neither side of the merge cannot reach your branch, whatever the model did.

Conflicts are resolved one file per model call, in parallel, so a single hard file cannot burn the whole run's budget — and before anything is bundled, a second model reviews the merge-resolution delta (the changes present in neither parent) and either corrects it or refuses to hand it on.

| Variable                            | Default                             | Effect                                                                                                                                                     |
| ----------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTO_RESOLVE_DISABLED`             | unset                               | `true` turns the whole workflow off. Nothing is discovered, so nothing is resolved, pushed, or commented on.                                               |
| `AUTO_RESOLVE_SCHEDULE_DISABLED`    | unset                               | `true` drops only the scheduled backstop scan. Conflicts are still resolved when a PR is opened, pushed to, or labelled `merge-conflict`.                  |
| `AUTO_RESOLVE_MAX_COMMIT_AGE_HOURS` | `24`                                | Only PRs whose newest commit is this recent are resolved, so a stale branch does not cost a model call on every push to the base. `0` disables the window. |
| `AUTO_RESOLVE_ATTEMPT_TTL_HOURS`    | `6`                                 | How long one attempt against a given PR head suppresses the next, so a push to the base costs at most one resolution per PR rather than one per push.      |
| `AUTO_RESOLVE_PROTECTED_RE`         | `^(\.github/\|\.claude/\|\.hooks/)` | Paths matched here are still resolved, but the pushed-resolution comment flags them for human review.                                                      |

To stop auto-resolve on **one PR** rather than repo-wide, add the `auto-resolve-blocked` label to it; remove the label to let it retry. The workflow applies that label itself when it hits a wall a human has to clear (no push token, a token without the `workflow` scope), so it never re-spends on the same rejection.

Turning the workflow off does not disable anything else: conflicts simply stay for a human, exactly as they would without the template.

### Secrets & repository settings

Repository **settings and secrets are never copied** when you create a repo from a template or when `template-sync` runs—both only move files. So each consuming repo configures these once. The workflows read:

| Secret                                    | Used by                                                                                  | Required?                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `CLAUDE_CODE_OAUTH_TOKEN`                 | Every Claude-backed workflow (via the `claude-run` composite), as the ladder's LAST rung | For Claude-backed workflows                                                                        |
| `CLAUDE_CODE_OAUTH_TOKEN_FALLBACK` … `_6` | Same — the rungs tried BEFORE it, in order, so CI spends them first                      | Optional—each unset rung is skipped, at no cost                                                    |
| `TEMPLATE_SYNC_TOKEN`                     | `template-sync`, `phone-home`, `claude-review`, `auto-resolve-conflicts`                 | Optional—falls back to `GITHUB_TOKEN` (which cannot resolve review threads or push workflow files) |
| `RELEASE_BYPASS_TOKEN`                    | `auto-version` (the release commit + tag push)                                           | Only for a protected default branch—an own-owner PAT registered as a ruleset bypass actor          |
| `RULESET_SYNC_TOKEN_ORG`                  | `sync-required-checks`                                                                   | For required-check syncing (`administration: write`)                                               |
| `PUSH_TOKEN`                              | `security-vulnerability-scan`                                                            | Optional—falls back to `GITHUB_TOKEN`                                                              |
| `GH_NTFY_SUBJECT`                         | `build-publish-notify`                                                                   | Optional—enables the ntfy failure alert (a no-op if unset)                                         |
| `GH_NTFY_URL`                             | `build-publish-notify`                                                                   | Optional—targets a self-hosted ntfy server (defaults to ntfy.sh)                                   |

`TEMPLATE_SYNC_TOKEN` should be a **fine-grained PAT** (it lets sync/release PRs touch workflow files and clear tag protection, which `GITHUB_TOKEN` can’t):

| Permission      | Access         |
| --------------- | -------------- |
| `contents`      | Read and write |
| `workflows`     | Read and write |
| `pull requests` | Read and write |

**Enable [GitHub security features](https://docs.github.com/en/code-security) per repo** (Settings → Code security): secret scanning, push protection, and Dependabot alerts + security updates. The committed `.github/dependabot.yml` assumes Dependabot is on at the repo level. These are settings, not files, so they don’t sync—turn them on when you adopt the template.

> **Doing this across many repos?** Hosting them in a GitHub **organization** lets you set the secrets above **once as org secrets** (scoped to all repos) and enable the security features above via org-level **default code-security settings**, so every new repo inherits them with zero per-repo work. The org route is an optional convenience—the template works identically on a personal account, you just configure each repo individually.

## Project Structure

```text
.
├── .claude/
│   ├── hooks/              # Claude session hooks (SessionStart, PreToolUse)
│   ├── skills/             # Claude skills (pr-creation, peer-review, explore-plan, ...)
│   ├── agents/             # Claude subagents (code-reviewer)
│   └── settings.json       # Claude Code hooks + session env tuning
├── .mcp.json.example       # Starter team-shared MCP servers (copy to .mcp.json)
├── .hooks/                 # Git hooks (pre-commit, commit-msg, lint-skills, pre-push, lib-gate.sh)
├── .github/
│   ├── workflows/          # CI workflows
│   └── dependabot.yml      # Dependabot configuration
├── config/                 # Shared configuration (e.g., JavaScript linting)
├── tests/                  # Python tests for hooks and config validation
├── CHANGELOG.md            # Changelog; auto-version promotes "## Unreleased" on release (npm packages)
├── CLAUDE.md               # Instructions for Claude Code sessions
├── package.json            # Node.js deps + lint-staged config
├── pyproject.toml          # Python project config (ruff, pytest)
└── setup.sh                # One-command setup script
```
