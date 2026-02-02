#!/bin/bash
# Session setup script for Claude Code
# Installs dependencies and configures environment for git hooks

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# Add local bin to PATH for this session
export PATH="$HOME/.local/bin:$PATH"

# Write to CLAUDE_ENV_FILE to persist PATH for subsequent Bash commands
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >>"$CLAUDE_ENV_FILE"
fi

# Install Python tools if missing
if ! command -v docformatter &>/dev/null; then
  pip3 install --quiet docformatter pyupgrade opentimestamps-client 2>/dev/null || true
fi

# Install shfmt if missing
if ! command -v shfmt &>/dev/null; then
  curl -sS https://webi.sh/shfmt 2>/dev/null | sh >/dev/null 2>&1 || true
fi

# Install shellcheck if missing (requires root)
if ! command -v shellcheck &>/dev/null && [ "$(id -u)" = "0" ]; then
  apt-get update -qq 2>/dev/null && apt-get install -y -qq shellcheck 2>/dev/null || true
fi

# Install gh CLI if missing (requires root)
if ! command -v gh &>/dev/null && [ "$(id -u)" = "0" ]; then
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg 2>/dev/null |
    tee /usr/share/keyrings/githubcli-archive-keyring.gpg >/dev/null
  chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null || true
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" |
    tee /etc/apt/sources.list.d/github-cli.list >/dev/null 2>&1
  apt-get update -qq 2>/dev/null && apt-get install -y -qq gh 2>/dev/null || true
fi

# Clone .timestamps repo if missing
if [ ! -d "$PROJECT_DIR/.timestamps/.git" ]; then
  rm -rf "$PROJECT_DIR/.timestamps" 2>/dev/null || true
  git clone --quiet https://github.com/alexander-turner/.timestamps "$PROJECT_DIR/.timestamps" 2>/dev/null || true
fi

# Enable git hooks
cd "$PROJECT_DIR" || exit 1
git config core.hooksPath .hooks

# Configure gh auth if GH_TOKEN is set
if [ -n "$GH_TOKEN" ]; then
  echo "$GH_TOKEN" | gh auth login --with-token 2>/dev/null || true
fi

# Install dependencies if needed
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  pnpm install --silent 2>/dev/null || true
fi
uv sync --quiet 2>/dev/null || true

echo "Session setup complete"
