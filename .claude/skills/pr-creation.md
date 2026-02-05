# Pull Request Creation Skill

**IMPORTANT: Always follow this skill before creating any PR.** Do not skip steps, especially the self-critique.

This skill guides Claude through creating high-quality pull requests with mandatory self-critique before submission.

## When to Use

Use this skill when:

- Creating a pull request for completed work
- The user asks to "create a PR", "open a pull request", or similar

## Prerequisites

- GitHub CLI (`gh`) must be authenticated
- All changes must be committed to a feature branch

## Workflow

### Step 1: Gather Context

Before creating the PR, gather information about the changes:

1. Identify the base branch (typically `main` or `master`)
2. Run `git diff <base-branch>...HEAD` to see all changes that will be in the PR
3. Run `git log <base-branch>..HEAD --oneline` to see all commits
4. Review the changed files to understand the scope

### Step 2: Self-Critique (Required)

**Before creating the PR**, launch a critique sub-agent using the Task tool:

- `subagent_type`: "general-purpose"
- `description`: "Critique code changes"
- `prompt`: Include the diff output and use the critique prompt below

**Critique Prompt:**

> Review the code changes for this PR and provide a critical assessment. Look for:
>
> **Problems:**
>
> - Logic errors, bugs, or unhandled edge cases
> - Security vulnerabilities (OWASP top 10)
> - Race conditions, memory leaks, or resource management issues
>
> **Best Practices:**
>
> - Does the code follow existing patterns in the codebase?
> - Are there unnecessary abstractions or over-engineering?
> - Is error handling appropriate (fail loudly for critical issues)?
> - Is there duplicated logic that should use shared helpers?
>
> **Bloat Detection:**
>
> - Unnecessary code, comments, or documentation
> - Features beyond what was requested
> - Backwards-compatibility hacks that can just be deleted
> - Premature abstractions or hypothetical future requirements
>
> **Testing:**
>
> - Are tests adequate for the changes?
> - Are tests focused and non-duplicative?
>
> Provide specific, actionable feedback with file/line references where applicable.

### Step 3: Address Critique

Review the critique and fix legitimate issues:

1. For each issue, determine if it's valid
2. Make necessary fixes and commit them
3. If you fixed more than 3 issues or made structural changes, re-run the critique

### Step 4: Run Validation

Ensure quality checks pass before creating the PR.

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

Customize these commands based on your project's tooling.

### Step 5: Push and Create the Pull Request

1. Push the branch: `git push -u origin HEAD`

2. Create the PR with `gh pr create`:

```bash
gh pr create --title "<type>: <description>" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points describing what changed and why>

## Changes
<List of specific changes made>

## Testing
<How the changes were tested>

https://claude.ai/code/session_...
EOF
)"
```

**Title format:** Use imperative mood with optional type prefix (`fix:`, `feat:`, `refactor:`, `docs:`, `test:`)

**Body guidelines:**

- Focus the summary on the "why"
- List concrete changes
- Note any breaking changes
- Include the Claude session URL at the end

### Step 6: Report Result

Provide the PR URL and title to the user.

## Updating the PR Description

**After each subsequent commit**, update the PR description to reflect the new changes:

```bash
gh pr edit --body "$(cat <<'EOF'
## Summary
<Updated summary reflecting all changes>

## Changes
<Updated list of all changes, including new commits>

## Testing
<Updated testing information>

https://claude.ai/code/session_...
EOF
)"
```

This keeps reviewers informed of the PR's current state without requiring them to parse individual commits.

## Error Handling

- **Critique finds issues**: Fix them before proceeding
- **Tests fail**: Fix the tests, don't skip them
- **gh not authenticated**: User should run `gh auth login`
- **Push fails**: Check branch permissions and remote configuration
