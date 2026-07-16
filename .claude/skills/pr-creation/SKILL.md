---
# prettier-ignore
name: pr-creation
description: >
  Creates high-quality pull requests with an iterative compress-critique-fix loop before submission.
  Activate this skill whenever you are asked to create, open, submit, or push a pull request,
  OR whenever a new feature, fix, or refactor is complete and ready to ship.
  Also activate when the user says "make a PR", "open a PR", "submit this for review",
  "push and create a PR", "I'm done, create the PR", "the feature is done", "I'm finished",
  or any variation of completing work / requesting a pull request.
  Always activate before running `gh pr create`.
---

# Pull Request Creation Skill

**IMPORTANT: Always follow this skill before creating any PR.** Do not skip steps, especially the iterative compress-critique-fix loop.

**Opening a PR is not optional and not something to ask permission for.** The moment a unit of work (a fix, feature, or refactor) is committed and pushed to a feature branch in this repo, create the PR unconditionally as part of finishing the task—don't stop and ask "would you like a PR?" or "let me know if you'd like one." Only skip PR creation if the user has explicitly said not to open one, or a PR for this branch already exists (update that one instead).

## When to Use

Activate this skill when the user says any of the following (or similar):

- “Create a PR” / “Create a pull request”
- “Open a PR” / “Open a pull request”
- “Make a PR for this”
- “Submit this for review”
- “Push and create a PR”
- “I’m done, create the PR”
- “Can you PR this?”
- “Send this up for review”
- “The feature is done” / “I’m finished” / “Ship it”

Also activate when:

- You have just finished implementing a new feature, fix, or refactor—run the loop, then create the PR
- The user asks you to submit completed work
- CLAUDE.md or task instructions say to create a PR when done

**Always open a PR at the end of a unit of work for this repo.** Once the changes are committed and pushed, create the PR without waiting to be asked—this overrides any default "only open a PR when explicitly asked" behavior.

Do **NOT** use this skill for:

- Reviewing an existing PR (use `gh pr view` or `gh pr diff` instead)
- Merging a PR (`gh pr merge`)
- Updating a PR description only (just run `gh pr edit`)

## Prerequisites

- GitHub CLI (`gh`) must be authenticated
- All changes must be committed to a feature branch (not `$CLAUDE_CODE_BASE_REF`/`master`)

## Updating an Existing PR

Before updating an existing PR (pushing new commits, editing the description, etc.), you MUST check its current status:

1. Run `gh pr view <pr-number> --json state` to check the PR state
2. Based on the result:
   - **Open**: Proceed with the update normally
   - **Merged**: Do NOT update it. Create a new PR instead with the additional changes
   - **Closed** (not merged): Ask the user what they’d like to do, if not already clarified

## Workflow

### Step 1: Gather Context

1. The base branch is in the env variable `$CLAUDE_CODE_BASE_REF`
2. Run `git diff <base-branch>...HEAD` to see all changes
3. Run `git log <base-branch>..HEAD --oneline` to see all commits
4. Review the changed files to understand the scope
5. **Check for PR description guidance**—look for `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`, or similar files in the repo. If found, read them and adapt the PR description to follow the repository’s conventions (see [pr-templates.md](pr-templates.md) for details)

### Step 2: Push and Create the Pull Request

You MUST read [pr-templates.md](pr-templates.md) for the PR template and formatting guidelines before this step.

1. Push the branch: `git push -u origin HEAD`
2. Check if a PR already exists for the current branch:

   ```bash
   EXISTING_PR=$(gh pr list --head "$(git branch --show-current)" --json number --jq '.[0].number' 2>/dev/null)
   ```

   If a PR already exists, update it with `gh pr edit` instead of creating a new one.

3. Create the PR using `gh pr create` with the template from the resource file. Make sure that you use the target branch

### Step 3: Iterative Compress-Critique-Fix Loop

CI is already running; use this time to improve the code.

Run an iterative loop until you reach a fixed point—a full critique pass that turns up nothing worth changing. This is the same loop described in `CLAUDE.md`’s Self-Critique Loop section; apply it here on the full diff.

You MUST read `.claude/skills/pr-creation/critique-prompt.md` once before the first pass—it contains the detailed checklist the sub-agent needs.

Each pass:

1. Launch a critique sub-agent using the Task tool:
   - `subagent_type`: “general-purpose”
   - `description`: “Critique code changes”
   - `prompt`: Include the full diff (`git diff $CLAUDE_CODE_BASE_REF...HEAD`) and the critique prompt from the resource file
2. For each issue raised, assess validity, then take the easy wins first:
   - **Compress**—delete dead code, unused imports, commented-out blocks, WHAT-comments, backwards-compat shims, premature abstractions
   - **Readability**—tighter names, un-nest conditionals, combine related checks, guard-clause early returns
   - **Code reuse**—extract duplicated logic into helpers; search for existing utilities before adding new ones
   - **Parametrize tests**—collapse near-identical tests into a single parametrized/table-driven test with exact-equality assertions
   - **Fixtures**—pull repeated setup/teardown into shared fixtures
   - **Correctness**—bugs, edge cases, security, swallowed errors
3. Commit the fixes (Conventional Commits format, per `CLAUDE.md`)
4. Start a fresh critique pass—the previous output is now stale

**Stop** when a full pass returns no actionable issues. Cap at ~5 passes; if issues are still being found at pass 5, stop, summarize what’s left, and ask the user how to proceed rather than looping silently.

**Skip the loop** for trivial changes (typo fixes, single-line config tweaks, pure docs edits)—say so explicitly when you skip.

### Step 4: Run Validation

If an open PR already exists for this branch, also run `bash scripts/check_deepsource_pr.sh` (or `deepsource issues --pr <N> --output json`) and address any findings before pushing. DeepSource is no longer a pre-push gate, so this step is your responsibility.

### Step 4: Push and Create the Pull Request

You MUST read [pr-templates.md](pr-templates.md) for the PR template and formatting guidelines before this step.

1. Push the branch: `git push -u origin HEAD`
2. Check if a PR already exists for the current branch:

   ```bash
   EXISTING_PR=$(gh pr list --head "$(git branch --show-current)" --json number --jq '.[0].number' 2>/dev/null)
   ```

   If a PR already exists, update it with `gh pr edit` instead of creating a new one.

3. Create the PR using `gh pr create` with the template from the resource file. Make sure that you use the target branch

Push any commits made during the critique and validation steps, then update the PR to reflect the final state.

1. Push: `git push`

1. Re-read the diff (`git diff $CLAUDE_CODE_BASE_REF...HEAD`) and commit log (`git log $CLAUDE_CODE_BASE_REF..HEAD --oneline`) to see the full scope
1. Rewrite the title and body to accurately describe the **current totality** of changes, not just the original scope:

   ```bash
   gh pr edit <pr-number> --title "<type>: <updated description>" --body "$(cat <<'EOF'
   <updated body using template from pr-templates.md>
   EOF
   )"
   ```

Skip the description update if no commits were made after Step 2.

### Step 6: Wait for CI Checks (MANDATORY)

1. Run `gh pr checks <pr-number> --watch` to monitor
2. If any checks fail, investigate and fix the issues
3. Push fixes, update the PR description (Step 5), and wait again
4. Only proceed once all checks are green

**Visual-testing results: don't block on churn.** The `visual-testing-*`
shards stay green on snapshot-only diffs by design (see `CLAUDE.md`), and a
snapshot diff is an _expected outcome_ for any change that touches rendering—it
is handled via the diff gallery + approve-baselines button, not by waiting.
Only stop for a visual result when it is **relevant to the task and signals a
real failure**: a shard that goes red (timeout, page error, exception before the
screenshot assertion), or a diff on a component your change was _supposed_ to
leave untouched. Do **not** sit and wait on:

- intermediate/in-progress visual shards when the change is expected to alter pixels,
- snapshot diffs that are the anticipated result of your own change (that's churn to approve, not a failure to fix),
- visual jobs unrelated to what you touched.

When the only outstanding checks are visual snapshot diffs that match what you
intended to change, treat CI as effectively green: report the PR and note the
baselines need approving, rather than blocking the turn on them.

### Step 7: Scrub AI Attribution from the Description

Re-read the current PR description (`gh pr view <pr-number> --json body --jq .body`) and remove anything related to “authored by Claude Code” or similar AI-tool attribution—`claude.ai` URLs, session links, “Generated with Claude Code” footers, co-author lines referencing Claude, etc. This mirrors the `CLAUDE.md` rule to never include such links in PRs, and catches any that slipped in via templates or earlier edits. If any are found, update the description with `gh pr edit` to remove them.

### Step 8: Report Result

Provide the PR URL and confirm all CI checks have passed.

### Step 9: Iteration Retrospective

After reporting the result, briefly reflect on how you could have iterated faster on this task. Consider:

- **Parallelization**: Which investigations, tool calls, or sub-agent launches could have run in parallel instead of sequentially?
- **Targeted checks over full sweeps**: Were there broad searches or full test runs you ran locally that CI would have caught anyway? Could a more targeted check (single file, single test, quick lint) have been faster?
- **Earlier CI delegation**: CI started at Step 2; did the critique loop or local validation catch issues CI would have caught anyway?
- **Critique loop efficiency**: Did any critique passes surface issues that a quick re-read would have caught before launching the sub-agent?

State each insight as one concrete line. Skip this step if the task was trivial (single-file, no iteration needed).

## Examples

### Example 1: Simple Bug Fix

**User says:** “I’m done fixing the login bug, create a PR”

**Claude’s actions:**

1. Runs `git diff $CLAUDE_CODE_BASE_REF...HEAD`—sees changes in `src/auth/login.ts` and `tests/auth/login.test.ts`
2. Runs `git log $CLAUDE_CODE_BASE_REF..HEAD --oneline`—sees 2 commits
3. Launches critique sub-agent with the diff
4. Critique returns: “Looks good, minor suggestion to add null check on line 42”
5. Fixes the null check, commits: `fix: add null check for empty session token`
6. Runs `pnpm check && pnpm test && pnpm lint`—all pass
7. Pushes and creates PR:

   ```bash
   gh pr create --title "fix: handle null session token in login flow" --body "..."
   ```

8. Updates PR description to reflect the null-check fix added during critique
9. Watches CI with `gh pr checks 47 --watch`—all green
10. Reports: “PR #47 created and all CI checks pass: <https://github.com/org/repo/pull/47>″

### Example 2: Multi-Commit Feature

**User says:** “Submit this for review”

**Claude’s actions:**

1. Runs `git diff $CLAUDE_CODE_BASE_REF...HEAD`—sees changes across 8 files including new components, tests, and API routes
2. Runs `git log $CLAUDE_CODE_BASE_REF..HEAD --oneline`—sees 5 commits
3. Pushes and creates PR with a draft description—CI starts immediately
4. **Pass 1:** Critique flags 4 issues—unused import, two near-identical tests that should parametrize, duplicated validation logic across 2 components, an over-engineered single-caller wrapper. Fixes them: deletes the import, collapses the tests with `it.each`, extracts a shared `validateInput` helper for the duplication, inlines the single-caller wrapper. Commits.
5. **Pass 2:** Critique flags 2 more—a leftover WHAT-comment from the refactor and a nested conditional. Un-nests and removes the comment. Commits.
6. **Pass 3:** Critique returns clean—fixed point reached, exit loop.
7. Runs validation—all pass
8. Pushes fixes, updates PR title and description to reflect all changes
9. Watches CI—one check fails (lint warning on new file)
10. Fixes lint issue, pushes, updates PR description again—all green
11. Reports success with PR URL

### Example 3: Ambiguous Follow-up

**User says:** “Push this up”

**Claude’s actions:** Pushes the branch and opens a PR against `$CLAUDE_CODE_BASE_REF` by default — finishing work is the explicit ask per CLAUDE.md. Only pushes without opening a PR if the user said not to, or a PR for this branch already exists (then updates that PR instead).

## Error Handling

- **Critique finds issues**: Fix them before proceeding—do not skip
- **Tests fail**: Fix the tests, don’t skip them
- **`gh` not authenticated**: Tell user to run `gh auth login` or set `GH_TOKEN`
- **Push fails**: Check branch permissions and remote configuration
- **PR already exists (HTTP 422)**: Check for existing PRs first with `gh pr list --head "$(git branch --show-current)"`, then use `gh pr edit` to update
- **No changes to PR**: Confirm with the user that work is committed
