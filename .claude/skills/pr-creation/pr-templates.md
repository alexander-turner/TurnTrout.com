# PR Templates and Formatting Reference

## PR Creation Command

First, check if a PR already exists for the current branch:

```bash
EXISTING_PR=$(gh pr list --head "$(git branch --show-current)" --json number --jq '.[0].number' 2>/dev/null)
```

If `EXISTING_PR` is non-empty, update the existing PR with `gh pr edit` instead of creating a new one.

```bash
gh pr create --base "$CLAUDE_CODE_BASE_REF" --title "<type>: <description>" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points describing what changed and why>

## Changes
<List of specific changes made>

## Testing
<How the changes were tested>

## Lessons Learned



- **What**: <concrete change — e.g., "Add X to CLAUDE.md", "Hook Y should also check Z">
- **Where**: <file or component — e.g., `CLAUDE.md`, `session-setup.sh`, `phone-home.yaml`>
- **Why**: <1-2 sentences — what went wrong or was discovered>

https://claude.ai/code/session_...
EOF
)"
```

## Title Format

Use imperative mood with a Conventional Commits type prefix:

- `fix:` Bug fixes
- `feat:` New features
- `refactor:` Code refactoring
- `docs:` Documentation
- `test:` Test changes
- `chore:` Maintenance

## Body Guidelines

- Focus the summary on the "why", not the "what"
- List concrete changes
- Note any breaking changes
- Include a "Lessons Learned" section if you discovered generalizable insights that could improve the template (this triggers the phone-home workflow). Each lesson must specify **what** to change, **where**, and **why** — vague observations get ignored. Delete the section entirely if there are no lessons.
- Include the Claude session URL at the end

## Updating PR Description After Additional Commits

```bash
gh pr edit --body "$(cat <<'EOF'
## Summary
<Updated summary reflecting all changes>

## Changes
<Updated list of all changes, including new commits>

## Testing
<Updated testing information>

## Lessons Learned


- **What**: <concrete change>
- **Where**: <file or component>
- **Why**: <what went wrong or was discovered>

https://claude.ai/code/session_...
EOF
)"
```

## Validation Commands

**TypeScript/JavaScript:**

```bash
pnpm check        # Type checking (if applicable)
pnpm test         # Run tests
pnpm lint         # Run linter
```

**Python:**

```bash
mypy <changed_files>
pylint <changed_files>
ruff check <changed_files>
pytest <test_files>
```

Customize these commands based on your project's tooling.
