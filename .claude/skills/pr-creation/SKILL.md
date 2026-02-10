---
# prettier-ignore
name: pr-creation
description: >
  Creates high-quality pull requests with mandatory self-critique before submission.
  Activate this skill whenever you are asked to create, open, submit, or push a pull request.
  Also activate when the user says "make a PR", "open a PR", "submit this for review",
  "push and create a PR", "I'm done, create the PR", or any variation of requesting a pull request.
  Always activate before running `gh pr create`.
---

# Pull Request Creation Skill

**IMPORTANT: Always follow this skill before creating any PR.** Do not skip steps, especially the self-critique.

## When to Use

Activate this skill when the user says any of the following (or similar):

- "Create a PR" / "Create a pull request"
- "Open a PR" / "Open a pull request"
- "Make a PR for this"
- "Submit this for review"
- "Push and create a PR"
- "I'm done, create the PR"
- "Can you PR this?"
- "Send this up for review"

Also activate when:

- You have completed a task and the user asks you to submit it
- CLAUDE.md or task instructions say to create a PR when done

Do **NOT** use this skill for:

- Reviewing an existing PR (use `gh pr view` or `gh pr diff` instead)
- Merging a PR (`gh pr merge`)
- Updating a PR description only (just run `gh pr edit`)

## Prerequisites

- GitHub CLI (`gh`) must be authenticated
- All changes must be committed to a feature branch (not `main`/`master`)

## Updating an Existing PR

Before updating an existing PR (pushing new commits, editing the description, etc.), you MUST check its current status:

1. Run `gh pr view <pr-number> --json state` to check the PR state
2. Based on the result:
   - **Open**: Proceed with the update normally
   - **Merged**: Do NOT update it. Create a new PR instead with the additional changes
   - **Closed** (not merged): Ask the user what they'd like to do, if not already clarified

## Workflow

### Step 1: Gather Context

1. Identify the base branch (typically `main` or `master`)
2. Run `git diff <base-branch>...HEAD` to see all changes
3. Run `git log <base-branch>..HEAD --oneline` to see all commits
4. Review the changed files to understand the scope

### Step 2: Self-Critique (Required)

**Before creating the PR**, you MUST read [critique-prompt.md](critique-prompt.md) and launch a critique sub-agent using the Task tool:

- `subagent_type`: "general-purpose"
- `description`: "Critique code changes"
- `prompt`: Include the full diff output and the critique prompt from that file

Do NOT skip reading the resource file — it contains the detailed checklist the sub-agent needs.

### Step 3: Address Critique

1. For each issue raised, determine if it's valid
2. Make necessary fixes and commit them
3. If you fixed more than 3 issues or made structural changes, re-run the critique (max 2 re-runs total — if issues persist after 2 rounds of critique, proceed to validation rather than looping indefinitely)

### Step 3b: Run Playwright Tests (If Applicable)

If the PR adds or modifies Playwright spec tests (`*.spec.ts`), run them locally before proceeding to catch test logic errors early. Follow the instructions in the project's CLAUDE.md under "Running Playwright Tests Locally" to set up the server and run the new tests. If the local environment cannot run browsers (e.g., sandbox crashes), note this and rely on CI to validate.

### Step 4: Run Validation

Run the project's test/lint/typecheck commands (see [pr-templates.md](pr-templates.md) for common commands per language). Fix any failures before proceeding.

### Step 5: Push and Create the Pull Request

You MUST read [pr-templates.md](pr-templates.md) for the PR template and formatting guidelines before this step.

1. Push the branch: `git push -u origin HEAD`
2. Create the PR using `gh pr create` with the template from the resource file
3. **CI label**: If the PR includes code changes that should be validated by Playwright/visual regression tests, add the `ci:full-tests` label: `gh pr edit --add-label "ci:full-tests"`. Without this label, expensive test suites (Playwright, visual testing) are skipped on PRs to save compute. They will still run in the merge queue before merging.

After creating the PR, and after any subsequent fix commits, update the PR description with `gh pr edit --body "..."` to reflect the current state of all changes.

### Step 6: Wait for CI Checks

1. Run `gh pr checks <pr-number> --watch` to monitor
2. If any checks fail, investigate and fix the issues
3. Push fixes and wait again
4. Only proceed once all checks are green

### Step 7: Check DeepSource Issues

After CI checks pass, check for DeepSource static analysis issues on the branch:

1. Get the current commit SHA: `git rev-parse HEAD`
2. Wait briefly for DeepSource analysis to complete (it runs on push via the GitHub App)
3. Run: `deepsource issues list --commit <SHA>`
4. If the command fails (e.g., analysis not ready yet), retry after 30 seconds (up to 3 attempts)
5. Review any issues found:
   - Fix legitimate issues, commit, and push
   - After pushing fixes, re-run `deepsource issues list --commit <new-SHA>` to verify
6. If the `--commit` flag is not available (official CLI without fork), skip this step with a note

### Step 8: Report Result

Provide the PR URL and confirm all CI checks have passed.

## Examples

### Example 1: Simple Bug Fix

**User says:** "I'm done fixing the login bug, create a PR"

**Claude's actions:**

1. Runs `git diff main...HEAD` — sees changes in `src/auth/login.ts` and `tests/auth/login.test.ts`
2. Runs `git log main..HEAD --oneline` — sees 2 commits
3. Launches critique sub-agent with the diff
4. Critique returns: "Looks good, minor suggestion to add null check on line 42"
5. Fixes the null check, commits: `fix: add null check for empty session token`
6. Runs `pnpm check && pnpm test && pnpm lint` — all pass
7. Pushes and creates PR:

   ```bash
   gh pr create --title "fix: handle null session token in login flow" --body "..."
   ```

8. Watches CI with `gh pr checks 47 --watch` — all green
9. Runs `deepsource issues list --commit $(git rev-parse HEAD)` — no issues found
10. Reports: "PR #47 created and all CI checks pass: <https://github.com/org/repo/pull/47>"

### Example 2: Multi-Commit Feature

**User says:** "Submit this for review"

**Claude's actions:**

1. Runs `git diff main...HEAD` — sees changes across 8 files including new components, tests, and API routes
2. Runs `git log main..HEAD --oneline` — sees 5 commits
3. Launches critique sub-agent with the full diff
4. Critique returns 4 issues: unused import, missing error boundary, test not covering edge case, over-engineered helper
5. Fixes all 4 issues across 2 additional commits
6. Re-runs critique (>3 fixes) — clean this time
7. Runs validation — all pass
8. Pushes and creates PR with detailed body summarizing the feature
9. Watches CI — one check fails (lint warning on new file)
10. Fixes lint issue, pushes, watches again — all green
11. Runs `deepsource issues list --commit $(git rev-parse HEAD)` — finds 1 style issue, fixes it
12. Reports success with PR URL

### Example 3: When Input Is Unclear

**User says:** "Push this up"

**Claude asks:** "I see you have changes on branch `feat/user-dashboard`. Would you like me to create a pull request against `main`, or just push the branch without creating a PR?"

## Error Handling

- **Critique finds issues**: Fix them before proceeding — do not skip
- **Tests fail**: Fix the tests, don't skip them
- **`gh` not authenticated**: Tell user to run `gh auth login` or set `GH_TOKEN`
- **Push fails**: Check branch permissions and remote configuration
- **No changes to PR**: Confirm with the user that work is committed
- **DeepSource analysis not ready**: Retry `deepsource issues list --commit <SHA>` after 30 seconds, up to 3 times
- **DeepSource `--commit` flag unavailable**: Skip the DeepSource check step and note it in the PR report
