# PR Templates and Formatting Reference

## PR Creation Command

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
