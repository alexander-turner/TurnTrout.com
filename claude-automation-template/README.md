# Claude Automation Template

A template repository with Claude Code automation, common workflows, and pre-commit hooks for modern software projects.

## Features

- **Claude Code Integration**: Automatic session setup, skills for PR creation with self-critique
- **Git Hooks**: Pre-commit formatting/linting, conventional commit validation
- **GitHub Actions**: CI workflows, Dependabot auto-merge, failure tracking for Claude branches
- **Template Sync**: Workflow to pull updates from this template into child repositories

## Quick Start

### Option 1: Use as GitHub Template

1. Click "Use this template" on GitHub
2. Clone your new repository
3. Run `pnpm install` to install dependencies
4. Customize `CLAUDE.md` with your project details
5. Update `package.json` with your project info and scripts

### Option 2: Copy Files Manually

Copy these directories to your existing project:

```bash
.claude/           # Claude Code configuration
.hooks/            # Git hooks
.github/           # GitHub Actions and Dependabot
config/javascript/ # Commitlint configuration
```

Then merge relevant sections from `package.json` into your own.

## What's Included

### Claude Code Configuration (`.claude/`)

| File                     | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `settings.json`          | Configures SessionStart hook to run setup script                  |
| `hooks/session-setup.sh` | Installs tools, configures git hooks, authenticates gh CLI        |
| `skills/pr-creation.md`  | Guides Claude through high-quality PR creation with self-critique |

### Git Hooks (`.hooks/`)

| Hook         | Purpose                                                      |
| ------------ | ------------------------------------------------------------ |
| `pre-commit` | Runs lint-staged to format/lint changed files                |
| `commit-msg` | Validates commit messages against conventional commit format |

### GitHub Actions (`.github/workflows/`)

| Workflow                        | Purpose                                               |
| ------------------------------- | ----------------------------------------------------- |
| `node-tests.yaml`               | Runs tests on Node.js changes                         |
| `lint.yaml`                     | Type checking and linting                             |
| `comment-on-failed-checks.yaml` | Comments on PRs from `claude/` branches when CI fails |
| `dependabot-auto-merge.yaml`    | Auto-merges minor/patch Dependabot PRs                |
| `template-sync.yaml`            | Syncs updates from template to child repos            |

### Configuration Files

| File                                     | Purpose                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `CLAUDE.md`                              | Project guidance for Claude Code (customize this!) |
| `package.json`                           | lint-staged and commitlint dependencies            |
| `config/javascript/commitlint.config.js` | Conventional commits configuration                 |
| `.github/dependabot.yml`                 | Dependabot configuration                           |

## Customization

### 1. Update CLAUDE.md

Replace placeholder content with your project's:

- Overview and description
- Development commands
- Architecture details
- Testing requirements
- Technical details

### 2. Configure lint-staged

Edit the `lint-staged` section in `package.json` to match your project's file types and tools:

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.py": ["ruff check --fix", "black"]
  }
}
```

### 3. Update GitHub Workflows

- Edit workflow triggers (`paths:`) to match your project structure
- Add/remove workflows based on your needs
- Update `comment-on-failed-checks.yaml` with your workflow names

### 4. Add Project-Specific Tools

Edit `.claude/hooks/session-setup.sh` to install additional tools:

```bash
# Via pip
pip_install_if_missing mycommand mypackage

# Via webi
webi_install_if_missing mytool
```

## Syncing Template Updates

Child repositories can pull updates from this template using the `template-sync.yaml` workflow.

### Setup

1. Create a GitHub Personal Access Token (PAT) with `repo` scope
2. Add it as a secret named `TEMPLATE_SYNC_TOKEN` in your child repository
3. Update `TEMPLATE_REPO` in the workflow to point to your template

### Usage

- **Automatic**: Runs weekly on Mondays (configurable via cron)
- **Manual**: Go to Actions → "Sync from Template" → "Run workflow"
- **Dry run**: Check "Show what would be synced" to preview changes

The workflow creates a PR with template updates for review.

### Configuring Sync Paths

In `template-sync.yaml`, customize:

```yaml
env:
  # Files to sync FROM template
  SYNC_PATHS: ".claude .hooks .github/actions"
  # Files to NEVER overwrite in child repos
  EXCLUDE_PATHS: "CLAUDE.md package.json"
```

## Alternative Sync Methods

### Copier/Cruft

For more sophisticated template management with variable interpolation:

```bash
# Install copier
pip install copier

# Create project from template
copier copy gh:your-org/claude-automation-template my-project

# Update existing project
copier update
```

### Git Subtree

Keep template as a subtree within your repo:

```bash
# Add template as subtree
git subtree add --prefix=_template https://github.com/your-org/claude-automation-template main --squash

# Pull updates
git subtree pull --prefix=_template https://github.com/your-org/claude-automation-template main --squash
```

## How It Works

### Session Startup

When Claude Code starts a session:

1. `settings.json` triggers `session-setup.sh`
2. The script installs tools (shfmt, gh, shellcheck)
3. Git hooks path is set to `.hooks/`
4. GitHub CLI is authenticated (if `GH_TOKEN` is set)
5. Dependencies are installed (pnpm/npm, uv)

### Pre-commit Flow

When you commit:

1. `pre-commit` hook runs lint-staged
2. lint-staged formats/lints only staged files
3. `commit-msg` hook validates commit message format

### PR Creation with Claude

When Claude creates a PR:

1. Claude follows `.claude/skills/pr-creation.md`
2. Self-critique sub-agent reviews changes
3. Issues are fixed before PR creation
4. Validation commands are run
5. PR is created with structured description

### CI Failure Handling

When CI fails on a `claude/` branch:

1. `comment-on-failed-checks.yaml` triggers
2. A comment is added to the PR tagging @claude
3. Claude sees the failure and can fix it
4. After 2 failures per workflow, commenting stops (prevents spam)

## Requirements

- Node.js 18+ (for lint-staged, commitlint)
- pnpm (recommended) or npm
- Git 2.9+ (for `core.hooksPath`)
- GitHub CLI (`gh`) for PR workflows

## License

MIT - Feel free to use and modify for your projects.
