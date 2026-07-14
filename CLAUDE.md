# CLAUDE.md

Guidance for Claude Code working in this repo. **For detail on the build pipeline, asset processing, visual regression, CI cost optimization, GitHub Actions, and other rarely-needed material, read `.claude/dev-notes.md` on demand**—it’s deliberately kept out of CLAUDE.md to keep per-turn context small.

## Overview

Personal blog (turntrout.com) on Quartz, a static site generator. TypeScript (Quartz customizations + plugins) and Python (asset processing, validation).

## Commands

```bash
pnpm dev          # Dev server with hot reload
pnpm build        # Production build (needs network)
pnpm start        # Build and serve on :8080
pnpm test         # TypeScript tests with coverage (100% required)
pnpm check        # Type check + lint
pnpm format       # Format all code
pnpm test:visual  # Playwright visual regression
uv run pytest <path>   # Python tests
```

For offline builds, Playwright local setup, and visual baseline approval, see `.claude/dev-notes.md`.

## Architecture (brief)

Quartz pipeline is **Transform → Filter → Emit** (`quartz/plugins/{transformers,filters,emitters}/`), orchestrated by `quartz/build.ts` with a dependency graph (`quartz/depgraph.ts`). UI components live in `quartz/components/`. Python in `scripts/` handles assets and validation.

Place magic numbers / shared constants in `config/constants.json` (static) or `quartz/components/constants.ts` (dynamic).

Configuration entry points: `config/quartz/quartz.config.ts`, `config/quartz/quartz.layout.ts`, `config/typescript/tsconfig.json`, `config/javascript/jest.config.js`.

## Content

- `website_content/`: Markdown source with YAML frontmatter; Obsidian-flavored with custom extensions (spoilers, subtitles, table captions)
- `public/`: built static site

## Git workflow

- **Hooks auto-configured** via `.claude/settings.json` SessionStart hook (also exports `GH_REPO` for proxy environments). Manual: `git config core.hooksPath .hooks`.
- **Pre-commit**: lint-staged formatters/linters on changed files.
- **Pre-push**: stashes uncommitted changes, runs auto-fix formatters, pylint, asset upload, alt-text scan. Resume from last failure with `RESUME=true git push`.
- **Pull requests**: always follow `.claude/skills/pr-creation/SKILL.md`. Once a unit of work (a fix, feature, or refactor) is committed and pushed, open a PR for it immediately and unconditionally—don't push to the branch and stop, and don't ask the user whether they want one or say "let me know if you'd like a PR." This overrides any default "only open a PR when explicitly asked" behavior. Opening the PR is part of finishing the task, not a follow-up step. **Finishing a code change means: branch → commit → push → open PR, as one uninterrupted action.** Never stop after a fix to ask "want me to commit and open a PR?"—the answer is always yes; just do it and report the PR link.
- **Don't ask overdetermined questions.** If the answer is already fixed by these instructions, the surrounding context, or an obvious sensible default, act on it—don't surface it as a yes/no question. Reserve questions for genuine forks where your choice would change what you build and you can't infer the user's intent. "Should I commit?", "Want a PR?", "Shall I proceed?", "Want me to also fix the lint error?" are overdetermined—just do them and state what you did.
- **Dev branch workflow**: when working on `dev`, first merge `main` into `dev`, push `dev`, then start the new feature branch from `dev`.
- **Merging PRs**: never call `merge_pull_request` directly. Once checks are green, call `mcp__github__enable_pr_auto_merge` (MERGE method—the repo disallows squash merging). Required status checks gate the merge—the full suite (Linux Chromium + Firefox, macOS WebKit, visual, a11y, lighthouse, site-build-checks, python, lint, node) runs on every PR where the `paths:` filter matches. Do **not** force-merge with empty “run ALL CI” commits or a direct merge—auto-merge is the only sanctioned path to `main`.

## Testing requirements

- **Zero flakiness tolerance.** Every CI check must pass every time. Prioritize root-cause fixes for anything we control. For external services we can't control (e.g. Cloudflare API 504s), retry as a last resort. No flakiness is acceptable regardless of source.
- **Never assume a failure is flaky or will self-resolve on a new commit.** Every red check is real until you have hard proof otherwise (e.g. the run's own logs say "The operation was canceled" or "Canceling since a higher priority waiting request exists"). "It was probably stale," "CI variance," "should pass on retry," and "will clear once X lands" are not diagnoses — they're deferrals that let real bugs ship. Pull the logs, read the actual error, trace it to a root cause. If the failure is in your code, fix it before moving on. If it's an external service failure, don't just label it external and move on — make the pipeline resilient to it (add retries, remove fragile options like blobless clones, add fallback paths). The goal is green CI, not an explanation for why it's red.
- **TypeScript**: 100% branch/statement/function/line coverage enforced by Jest (see `coveragePathIgnorePatterns`). Tests live next to implementation as `*.test.ts`.
- **Python**: 100% line coverage enforced locally.
- **Interaction features/bug fixes**: add Playwright `*.spec.ts` covering both mobile and desktop viewports; verify visual state, not just DOM.

## Code style

- Prefer throwing errors over logging warnings for critical issues—fail loudly.
- Un-nest conditionals; combine related checks.
- Create shared helpers when the same logic appears in multiple places.
- TypeScript: avoid `!` non-null assertions (linter flags them); use proper null checks.
- **Never add backward-compat re-exports** (`export { foo } from "./other-module"`). Update imports at the call site.
- **Prefer immutable types** for read-only collections: `ReadonlySet`, `ReadonlyMap`, `readonly T[]`, `Readonly<Record<K,V>>`, `as const`. Python: `frozenset`, `tuple`, `frozendict`. Function parameters should accept `readonly` types when they don’t mutate.
- **Never embed code in template literal strings.** Put scripts, styles, and other code in their own files (e.g. `*.inline.ts` for bundled client scripts) so they get linting, type-checking, and IDE support. Import the file instead of quoting the code.
- **Comments describe current code, not its history or alternatives.** Don’t narrate prior fixes, old bug saga, “previously…”, “the short-lived NBSP-always fork,” “Regression: the old code did X,” or what an earlier iteration tried—that belongs in commit messages or PR descriptions, which is where future readers should look for history. Equally, don’t narrate the rejected alternative: phrases like “doing X immediately _would_ cause Y,” “if we instead did Z…”, “this avoids the problem where…” describe a counterfactual, not the code in front of the reader. State the invariant or constraint directly (“must stay interactive during the grace period”) and stop there. Comments that age into stale archaeology—or that explain code that no longer exists—are worse than no comments. When fixing a regression, write the comment as “WHY this code is the way it is” without mentioning the old version or the alternative you didn’t take. The git log is the changelog; the PR description is the rationale.

## Error handling

- **Never use empty catch blocks.** Errors should be handled or propagated.
- Don’t catch just to ignore—let unexpected errors fail loudly.
- Catch only specific errors you know how to handle.
- If you must catch for cleanup, rethrow after.
- Don’t try/catch to silence errors without a documented reason.

## Testing rules

- Parametrize with `it.each()` for compactness.
- Write focused, non-duplicative tests.
- **NEVER update test expectations without asking the user first.**
- **NEVER lower CI thresholds or weaken assertions to make tests pass.** Fix the underlying issue (improve site performance, fix flaky test logic, etc.). Cheap shortcuts like lowering Lighthouse score thresholds or loosening test criteria are not acceptable.
- **Visual regression tests must include `(screenshot)` in the title.** CI splits Playwright into two workflows by `--grep "(screenshot)"`: `visual-testing.yaml` (downloads R2 baselines) vs. `playwright-tests.yaml` (no baselines). A test that calls `takeRegressionScreenshot` / `toHaveScreenshot` without “screenshot” in its full describe-prefixed title gets routed to `playwright-tests` and dies with “A snapshot doesn’t exist.”
- **Visual-testing shards are green for snapshot diffs, red only for real failures.** New or updated screenshots are expected outcomes—the diff gallery + approve-baselines button is the workflow for handling them, so individual `visual-testing-(linux|macos)` shards stay green on snapshot-only outcomes. Real failures (timeouts, page errors, exceptions before the screenshot assertion) still fail the shard. The split is enforced by `scripts/classify_visual_failures.py` (called from `.github/actions/visual-shard-finalize`); the overall `visual-testing` status and `publish-visual-report` job carry the snapshot-diff signal forward via the `visual-status-*` artifacts. **When touching `visual-testing.yaml`, preserve this invariant**: snapshot diffs ≠ shard failure, but real test failures must surface on the shard.

## Dependencies

- Use `pnpm` (not npm) for all package operations.

## Documentation

When a change touches user-facing behavior, update the relevant doc:

- **`website_content/design.md`**: any new design feature—visual, layout, UX, asset-pipeline behavior, or anything else already documented there. Match the conversational, first-person prose style of the surrounding sections (motivation and tradeoffs, not implementation detail). **Default to NOT editing design.md.** It is the user’s personal essay, not a changelog: most changes (refinements, expirations, edge-case tweaks to already-documented features) do not warrant a new paragraph or section. Don’t add prose just because a behavior is user-facing; the bar is a genuinely new design feature the user would want to write about themselves. When in doubt, **ask first**: propose the addition in chat as a yes/no question rather than drafting and inserting it preemptively. Only once the user agrees, write it to match the surrounding voice and **surface the drafted prose in chat before committing** so they can rewrite the framing or push back. Don’t make design.md overly technical—code-level minutiae belong in `.claude/dev-notes.md`.
- **`website_content/test-page.md`**: any new visual element (e.g. glyph margin before favicon, new dropcap variant, new admonition style). Add a representative example so the next visual-regression run captures the new element as a baseline.
- **`.claude/dev-notes.md`**: any new dev procedure that’s only useful occasionally—build steps, pre-push checks, CI cost optimization, debugging recipes. Keep CLAUDE.md itself slim—it’s loaded every turn.
- **Generalizable “lessons learned”**: add to the **PR description** under a `## Lessons learned` heading, _not_ to `dev-notes.md`. The claude-automation-template reviewer picks them up from PR descriptions and propagates them across all relevant repos. Repo-specific procedures still belong in `dev-notes.md`; lessons that apply broadly (CI primitives, sandbox tooling, cross-repo conventions) go in the PR description.
- **If a lesson would help future sessions in other repos too, upstream it.** When the user’s feedback would generalize beyond this codebase—comment discipline, test-quality bars, sandbox/CI patterns, “stop renaming things speculatively,” “you keep adding unneeded abstractions”—proactively, on first hearing, (a) add a rule to the relevant `.claude/` doc (CLAUDE.md or `dev-notes.md`) so the same session doesn’t repeat the mistake, and (b) write the lesson into the PR description’s `## Lessons learned` so the upstream automation can propagate it to sibling repos. Repo-specific procedures (build steps, this project’s directory layout) stay in `dev-notes.md` only. The test for “is this general?” is: would the rule still apply if the file paths and tech stack were different?

Design philosophy from `design.md`: minimal targeted changes; verify before generating; derive style from existing code; security-first; modern best practices with explicit typing; no unnecessary refactoring or whitespace changes.

## Before writing code

- Ask clarifying questions if uncertain about scope.
- Check for existing libraries before rolling custom solutions.
- Look for existing patterns before creating new ones.

## CI monitoring

After pushing, monitor CI until pass or fail. The PostToolUse hook polls GitHub Actions; the Stop hook blocks completion on remote CI failures. See `.claude/dev-notes.md` for manual commands and CI cost-optimization labels.

- **Never sit on a CI failure.** If the Stop hook reports a failure—or any check on the open PR is red—investigate and fix it before reporting the task done. Do not assume a remote failure is “just stale local deps” without verifying remote status via `mcp__github__pull_request_read` (`get_status` + `get_check_runs`).
- This includes lint/static-analysis services (DeepSource, Socket, etc.) shown alongside GitHub Actions checks—fix their findings even when the underlying file came from a parent branch, since they block the PR all the same.
- If a failure is genuinely outside the PR’s scope and not fixable here, say so explicitly with evidence rather than going silent.
- **`gh` is authenticated by the SessionStart hook**—use it directly to read failure logs, e.g. `gh run view <run-id> --log-failed --job <job-id>`. Annotations and `mcp__github__pull_request_read` only return generic “exit code 1”; the real test names and tracebacks are only in the full log. Do not rely on `WebFetch` against actions.github.com—it returns the un-authenticated HTML and never shows the log.
- **A PR run executing on a synthetic merge ref (`refs/remotes/pull/<N>/merge`) means CI sees `main` + your branch.** If a test fails in CI but passes locally, check whether `main` has moved ahead and merge it in: `git fetch origin main && git merge origin/main`. A “this was already fixed in #XYZ on main” answer is more common than a real bug in your code.

## DeepSource issues

- The `deepsource` CLI is authenticated by the SessionStart hook.
- **Any DeepSource alert that arrives while you hold a PR subscription is itself an actionable event—always fix it, never just acknowledge it.** A `<github-webhook-activity>` event mentioning DeepSource, a `DeepSource: <analyzer>` check-run flipping to failed/neutral, or a DeepSource bot review comment all mean the same thing: run `deepsource issues --pr <N> --output json`, fix every finding it returns, push, and update your status checklist—before replying. This holds even when the alert lands on a PR whose original task was something else; an open DeepSource finding blocks the PR regardless of why you opened it. Do not defer to "a later pass," do not assume it will self-resolve, and do not unsubscribe to make the alert stop.
- **DeepSource findings are not optional. If `deepsource issues --pr <N> --output json` returns a non-empty list, you MUST fix every issue before the task is done—even MINOR severity, even in files that came in from a parent branch via merge. Listing or summarizing the findings is not a substitute for fixing them.** This is the most common failure mode: surfacing the list and then stopping. Don’t.
- **Always fix, in the same PR—never defer or ask whether to fix.** When a `DeepSource: <analyzer>` status is red on the PR head, fix it directly in that PR. Do not offer to “leave it,” propose a “separate PR,” or ask the user how to handle it—those deferrals just leave the PR blocked. This applies even when `deepsource issues --pr <N>` is empty but the commit-level status is red (the finding lives in a parent-branch file pulled in by a merge—e.g. a cyclomatic-complexity or regex-flag issue in a file you never touched): a red analyzer status on your head commit is yours to clear, so refactor/fix the offending code in-place. A separate PR does not unblock the current one until it round-trips through `main`.
- **Run the CLI three times per PR, every time:**
  1. **Right after pushing the first commit** — `deepsource issues --pr <N> --output json`. Fix everything it returns, then push the fix commit.
  2. **When a DeepSource webhook arrives** (PR-status check posts a comment, or you see `DeepSource: <analyzer>` change state)—re-run the CLI and fix any new findings.
  3. **Before declaring the task complete**—once the most recent CI run finishes, re-run the CLI to confirm the count is zero.
- DeepSource is asynchronous, so the CLI lags behind your local HEAD; that’s why this is a checklist, not a pre-push hook.
- Don’t rely on the GitHub PR comment alone—it lags further than the CLI. The CLI is the canonical list.
- Also useful:
  - `deepsource issues --default-branch --analyzer python --output json` (issues on `main`)
  - `deepsource issues --default-branch --analyzer javascript --output json`
- Fix root causes, not by appending `# skipcq: <CODE>` / `// skipcq: <CODE>`—only suppress when the warning is genuinely a false positive and write a comment explaining why on the same line.
- Group fixes into one focused PR per analyzer (or per issue cluster if a single PR would balloon), keeping the diff reviewable. After landing, re-run the CLI to confirm the count went down.
