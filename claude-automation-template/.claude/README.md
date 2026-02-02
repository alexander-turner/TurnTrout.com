# Claude Code Configuration

This directory contains configuration and skills for Claude Code.

## Structure

```
.claude/
├── settings.json           # Claude Code hooks configuration
├── hooks/
│   └── session-setup.sh   # Runs on session start (installs tools, configures git)
└── skills/
    └── pr-creation.md     # PR creation workflow with self-critique
```

## How It Works

### Session Start Hook

When Claude Code starts a session, it automatically runs `session-setup.sh` which:

1. **Installs tools**: shfmt, gh (GitHub CLI), shellcheck
2. **Configures git hooks**: Sets `core.hooksPath` to `.hooks/`
3. **Authenticates GitHub CLI**: Uses `GH_TOKEN` if available
4. **Installs dependencies**: Node (pnpm/npm) and Python (uv) if applicable

### Skills

Skills in `skills/` are reusable workflows that guide Claude through complex tasks:

- **pr-creation.md**: Creating pull requests with mandatory self-critique before submission

Skills are automatically available to Claude Code when working in this repository.

## Customization

### Adding Tools

Edit `hooks/session-setup.sh` to add more tools:

```bash
# Via pip
pip_install_if_missing mycommand mypackage

# Via webi (https://webinstall.dev)
webi_install_if_missing mytool

# Via apt (requires root)
if is_root; then
  apt-get install -y mytool
fi
```

### Adding Skills

Create new `.md` files in `skills/` following the pattern in `pr-creation.md`.

### Customizing Hooks

Modify `settings.json` to add more hooks. See the [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) for available hook types.
