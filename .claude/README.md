# Claude Code Configuration

This directory contains configuration and skills for Claude Code.

## Structure

```text
.claude/
├── settings.json              # Claude Code hooks configuration
├── agents/
│   └── code-reviewer.md       # Read-only reviewer subagent (Read/Grep/Glob)
├── hooks/
<<<<<<< local
│   ├── session-setup.sh      # Runs on session start (installs tools, configures git)
│   ├── pre-push-check.sh    # Runs before git push / gh pr (build, lint, typecheck)
│   ├── check-narrative-comments.sh  # Runs after Edit/Write (warns on "previously…" / regression comments)
│   └── lib-checks.sh        # Shared bash helpers (exists, has_script)
=======
│   ├── session-setup.sh       # Runs on session start (installs tools, configures git)
│   ├── pre-push-check.sh      # Runs before git push / gh pr (build, lint, typecheck)
│   ├── lib-checks.sh          # Shared bash helpers (exists, has_script)
│   ├── safe-launch.sh         # Wraps PreToolUse hooks so a parse error can't lock the session
│   └── safe-launch-parse.py   # Helper: extracts tool_name/target path from the PreToolUse payload
>>>>>>> template
└── skills/
    ├── pr-creation/           # PR creation workflow with self-critique
    ├── update-pr/             # Update an existing PR with new changes
    ├── peer-review/           # Drive the code-reviewer subagent, then triage/fix
    ├── explore-plan/          # Explore → Plan → Critique → Review → Verify discipline
    ├── conventional-commits/  # Conventional Commits helper (invoke with /commit)
    └── markdown-block/        # Emit copyable raw markdown in a fenced block
```

## How It Works

### Session Start Hook

When Claude Code starts a session, it automatically runs `session-setup.sh` which:

1. **Installs tools**: shfmt, gh (GitHub CLI), jq, shellcheck
2. **Configures git hooks**: Sets `core.hooksPath` to `.hooks/`
3. **Validates GitHub CLI auth**: Fails fast if `GH_TOKEN` is missing
4. **Detects GitHub repo**: Extracts `owner/repo` from proxy remotes in web sessions
5. **Installs dependencies**: Node (pnpm/npm) and Python (uv) if applicable

### Pre-Push Check Hook

Before `git push` or `gh pr` commands, `pre-push-check.sh` runs any configured checks:

- **build** (`pnpm build`): Catches type errors in TypeScript projects
- **lint** (`pnpm lint`): Catches code quality issues
- **typecheck** (`pnpm check`): Additional type checking if configured
- **ruff**: Python linting if applicable

Only runs scripts that are actually configured in `package.json`—skips placeholder scripts.

### PostToolUse: Narrative-Comments Check

After every `Edit` / `Write`, `check-narrative-comments.sh` greps the new content for
comments that narrate prior versions (“previously…”, “the old code,” “regression: …”)
and exits 2 (non-blocking) to surface a reminder. Skips docs/config files.

### Skills

Skills in `skills/` are reusable workflows that guide Claude through complex tasks:

- **pr-creation**: Creating pull requests with mandatory self-critique before submission (invoke with `/pr-creation`)
- **update-pr**: Updating an existing PR with new changes and an optionally revised description (`/update-pr`)
- **peer-review**: Running the read-only `code-reviewer` subagent on the diff, then triaging and fixing findings (`/peer-review`)
- **explore-plan**: Enforcing the Explore → Plan → Critique → Review → Verify discipline for non-trivial work (`/explore-plan`)
- **conventional-commits**: Guiding Conventional Commits with secret detection—invoke with `/commit` (the skill's `name` is `commit`)
- **markdown-block**: Emitting copyable raw markdown in a fenced code block (`/markdown-block`)

The `agents/` directory holds subagents—currently `code-reviewer`, a read-only (Read/Grep/Glob) reviewer used by the `peer-review` skill for an unbiased second opinion on a diff.

Skills are automatically available to Claude Code when working in this repository.

## Customization

### Adding Tools

Edit `hooks/session-setup.sh` to add more tools:

```bash
# Via uv
uv_install_if_missing mycommand mypackage

# Via webi (https://webinstall.dev)
webi_install_if_missing mytool

# Via apt (requires root)
if is_root; then
  apt-get install -y mytool
fi
```

### Adding Skills

Create new skill directories in `skills/` following the pattern in `pr-creation/SKILL.md`. Each skill should be a directory with a `SKILL.md` entrypoint and optional supporting files.

### Customizing Hooks

Modify `settings.json` to add more hooks. See the [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) for available hook types.

**Always wrap PreToolUse hooks with `safe-launch.sh`.** A PreToolUse hook that fails to parse (e.g. unresolved merge conflict markers) exits non-zero, which Claude Code treats as a block—locking the session out of repairing the very file that’s broken. `safe-launch.sh` detects the parse failure and degrades open: edits under `.claude/hooks/` and `.hooks/` are allowed for self-repair; all other tools get `permissionDecision: "ask"`.

```json
{
  "type": "command",
  "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/safe-launch.sh \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/your-new-hook.sh"
}
```

Any script under `.claude/hooks/` or `.hooks/` is also syntax-checked at session start by `session-setup.sh`—broken hooks surface as loud warnings before they can block the first tool call.
