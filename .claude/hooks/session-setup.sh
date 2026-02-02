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
  echo "Installing Python tools..."
  pip3 install --quiet docformatter pyupgrade opentimestamps-client || echo "Warning: Failed to install Python tools"
fi

# Install shfmt if missing (uses webi - works without root)
if ! command -v shfmt &>/dev/null; then
  echo "Installing shfmt..."
  curl -sS https://webi.sh/shfmt | sh >/dev/null 2>&1 || echo "Warning: Failed to install shfmt"
fi

# Install shellcheck if missing
if ! command -v shellcheck &>/dev/null; then
  echo "Installing shellcheck..."
  if [ "$(id -u)" = "0" ]; then
    apt-get update -qq && apt-get install -y -qq shellcheck || echo "Warning: Failed to install shellcheck"
  else
    echo "Warning: shellcheck requires root to install via apt-get"
  fi
fi

# Install gh CLI if missing
if ! command -v gh &>/dev/null; then
  echo "Installing GitHub CLI..."
  if [ "$(id -u)" = "0" ]; then
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg |
      tee /usr/share/keyrings/githubcli-archive-keyring.gpg >/dev/null &&
      chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg &&
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" |
      tee /etc/apt/sources.list.d/github-cli.list >/dev/null &&
      apt-get update -qq &&
      apt-get install -y -qq gh || echo "Warning: Failed to install gh via apt"
  else
    # Try webi as fallback for non-root
    curl -sS https://webi.sh/gh | sh >/dev/null 2>&1 || echo "Warning: Failed to install gh"
  fi
fi

# Clone .timestamps repo if missing
if [ ! -d "$PROJECT_DIR/.timestamps/.git" ]; then
  echo "Cloning .timestamps repo..."
  rm -rf "$PROJECT_DIR/.timestamps" 2>/dev/null
  git clone --quiet https://github.com/alexander-turner/.timestamps "$PROJECT_DIR/.timestamps" || echo "Warning: Failed to clone .timestamps"
fi

# Enable git hooks
cd "$PROJECT_DIR" || exit 1
git config core.hooksPath .hooks

# Configure gh auth if GH_TOKEN is set
if [ -n "$GH_TOKEN" ] && command -v gh &>/dev/null; then
  echo "Configuring GitHub authentication..."
  echo "$GH_TOKEN" | gh auth login --with-token 2>&1 || echo "Warning: Failed to authenticate with GitHub"
fi

# Install dependencies if needed
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo "Installing Node dependencies..."
  pnpm install --silent || echo "Warning: Failed to install Node dependencies"
fi

if command -v uv &>/dev/null; then
  uv sync --quiet || true
fi

echo "Session setup complete"
