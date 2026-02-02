# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

<!-- Describe your project in 1-2 sentences -->

[Project description here]

## Development Commands

### Building & Running

```bash
pnpm dev          # Development server
pnpm build        # Production build
pnpm start        # Start the application
```

### Testing

```bash
pnpm test         # Run tests
pnpm check        # Type checking
```

### Code Quality

```bash
pnpm lint         # Run linter
pnpm format       # Format code
```

## Architecture

<!-- Describe your project's architecture -->
<!-- Include key directories, patterns, and technologies -->

### Directory Structure

```
src/              # Source code
tests/            # Test files
config/           # Configuration files
```

## Git Workflow

**Hooks auto-configured**: Git hooks are automatically enabled via `.claude/settings.json` SessionStart hook.

**Pre-commit**: Runs lint-staged formatters/linters on changed files

**Commit messages**: Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

- `feat:` New features
- `fix:` Bug fixes
- `refactor:` Code refactoring
- `docs:` Documentation changes
- `test:` Test changes
- `chore:` Maintenance tasks

**Pull requests**: Always follow `.claude/skills/pr-creation.md` before creating any PR.

## Testing Requirements

<!-- Describe your testing requirements -->

- Unit tests for business logic
- Integration tests for APIs
- E2E tests for critical user flows

## Key Technical Details

<!-- Add project-specific technical details -->
<!-- Include patterns, conventions, and gotchas -->

## Design Philosophy

- Minimal, targeted changes only
- Verify information before generating code
- Derive style from existing codebase
- Security-first approach
- Modern best practices with explicit typing
- No unnecessary refactoring or whitespace changes

## Development Practices

### Before Writing Code

- Ask clarifying questions if uncertain about scope or approach
- Check for existing libraries before creating custom solutions
- Look for existing patterns in the codebase

### Code Style

- Prefer throwing errors that "fail loudly" over silent failures
- Combine related checks into single blocks
- Create shared helpers when the same logic is needed in multiple places

### Testing

- Write focused, non-duplicative tests
- Use parameterized tests for coverage with minimal code
