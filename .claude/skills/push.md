# Push Skill

**IMPORTANT: Always follow this skill when pushing commits to an existing PR branch.**

This skill ensures PR descriptions stay up-to-date and quality checks pass before pushing.

## When to Use

Use this skill when:

- Pushing commits to an existing PR branch
- Making additional changes after PR creation
- Addressing review feedback
- Fixing bugs or refactoring code on a PR branch

## Workflow

### Step 1: Run Validation Checks

Ensure quality checks pass before pushing.

**TypeScript/JavaScript changes:**

```bash
pnpm check        # Type checking (if applicable)
pnpm test         # Run tests
pnpm lint         # Run linter
```

**Python changes:**

```bash
mypy <changed_files>
pylint <changed_files>
ruff check <changed_files>
pytest <test_files>
```

Skip checks that aren't relevant to your changes.

### Step 2: Update PR Description

**CRITICAL: You MUST update the PR description to reflect the new changes.**

First, get the current PR details:

```bash
gh pr view --json number,title,body
```

Then update the description with all changes:

```bash
gh pr edit --body "$(cat <<'EOF'
## Summary
<Updated summary reflecting all changes, including new commits>

## Changes
<Updated list of all changes - include both original and new commits>

## Testing
<Updated testing information>

https://claude.ai/code/session_...
EOF
)"
```

**Why this matters:**
- Keeps reviewers informed without parsing individual commits
- Shows the current state of the PR in one place
- Prevents confusion about what the PR actually contains

**What to update:**
- Add new changes to the Changes section
- Update the Summary if the scope changed
- Add new testing notes if applicable
- Update Lessons Learned if you discovered new patterns

### Step 3: Push Changes

Push the commits to the remote branch:

```bash
git push
```

Or if this is the first push for the branch:

```bash
git push -u origin HEAD
```

### Step 4: Check for CI Issues

After pushing:

1. Monitor the PR for CI failures
2. If DeepSource or other static analysis tools flag issues, fix them
3. Repeat this workflow for fixes (validate → update PR → push)

## Error Handling

- **Tests fail**: Fix the tests before pushing
- **Linting errors**: Fix formatting/style issues
- **Push rejected**: Check branch permissions and pull latest changes
- **gh not authenticated**: User should run `gh auth login`

## Tips

- Commit related changes together with clear messages
- Keep the PR description as a living document
- Update the description immediately after pushing, not later
