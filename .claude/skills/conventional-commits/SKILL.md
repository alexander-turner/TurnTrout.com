---
# prettier-ignore
name: commit
description: >
  Creates well-structured git commits using Conventional Commits format.
  Activate this skill whenever the user asks to commit changes, make a commit, save progress,
  or says "commit this", "commit my changes", "/commit", or any variation of requesting a git commit.
  Also activate when task instructions say to commit when done.
---

# Conventional Commits Skill

## Workflow

### 1. Review Changes

Run in parallel: `git status`, `git diff`, `git diff --cached`, `git log --oneline -5`

### 2. Stage Files

Stage by name rather than reaching for `git add -A`/`git add .` reflexively — but stage the COMPLETE set of files you intend to commit, because a partial stage is what exposes unstaged edits to the lint-staged stash hazard (`CLAUDE.md` → Git Workflow). Skip secrets (`.env`, credentials). If changes span unrelated areas, ask user whether to split into multiple commits.

### 3. Commit

Format: `<type>(<optional scope>): <imperative lowercase description>`

- Allowed types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`, `style`, `perf`, `build`
- Under 72 chars, no trailing period
- Add `!` for breaking changes: `feat!: remove legacy API`
- Optional body (blank line after subject) for the **why**
- Use HEREDOC for multi-line messages:

```bash
git commit -m "$(cat <<'EOF'
feat(sdk): return Result type from authenticate

BREAKING CHANGE: authenticate() no longer throws on failure.
EOF
)"
```

### 4. Verify

If commitlint rejects the message, fix and create a **new** commit (don’t amend). Confirm hash and message to the user.

## Watch the clock

**Time every `git commit` and `git push`, and say so when one drags past ~60s.** Run them so the elapsed time lands in the tool output — `start=$SECONDS; git push -u origin <branch>; echo "elapsed=$((SECONDS - start))s"`. A slow git call is otherwise invisible: the tool result reads identically at 3s and at 4 minutes, so a minutes-long stall gets absorbed into "committed and pushed" and nobody learns the hook suite has rotted. Over the threshold, report the command, the elapsed seconds, and the cause you **diagnosed** — "git was slow" is not a diagnosis. A repeat offender is a defect to root-cause, exactly like a CI flake.
