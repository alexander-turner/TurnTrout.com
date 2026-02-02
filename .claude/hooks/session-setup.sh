#!/bin/bash
# Session setup script for Claude Code
# Installs dependencies and configures environment for git hooks

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
TIMESTAMPS_REPO="alexander-turner/.timestamps"

#######################################
# Helpers
#######################################

warn() { echo "Warning: $1" >&2; }
die() {
  echo "ERROR: $1" >&2
  exit 1
}
is_root() { [ "$(id -u)" = "0" ]; }

github_url() {
  local repo="$1"
  if [ -n "${GH_TOKEN:-}" ]; then
    echo "https://x-access-token:${GH_TOKEN}@github.com/${repo}"
  else
    echo "https://github.com/${repo}"
  fi
}

# Install a command via pip if missing
pip_install_if_missing() {
  local cmd="$1" pkg="${2:-$1}"
  if ! command -v "$cmd" &>/dev/null; then
    pip3 install --quiet "$pkg" || warn "Failed to install $pkg"
  fi
}

# Install a command via webi if missing
webi_install_if_missing() {
  local cmd="$1"
  if ! command -v "$cmd" &>/dev/null; then
    echo "Installing $cmd..."
    curl -sS "https://webi.sh/$cmd" | sh >/dev/null 2>&1 || warn "Failed to install $cmd"
  fi
}

#######################################
# PATH setup
#######################################

export PATH="$HOME/.local/bin:$PATH"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >>"$CLAUDE_ENV_FILE"
fi

#######################################
# Tool installation (optional - warn on failure)
#######################################

echo "Installing tools..."
pip_install_if_missing docformatter
pip_install_if_missing pyupgrade
pip_install_if_missing ots opentimestamps-client
webi_install_if_missing shfmt
webi_install_if_missing gh

if ! command -v shellcheck &>/dev/null && is_root; then
  if ! { apt-get update -qq && apt-get install -y -qq shellcheck; } 2>/dev/null; then
    warn "Failed to install shellcheck"
  fi
fi

#######################################
# Git setup (required - fail on error)
#######################################

# Clone .timestamps repo (required for post-commit hooks)
if [ ! -d "$PROJECT_DIR/.timestamps/.git" ]; then
  echo "Cloning .timestamps repo..."
  rm -rf "$PROJECT_DIR/.timestamps" 2>/dev/null
  git clone --quiet "$(github_url "$TIMESTAMPS_REPO")" "$PROJECT_DIR/.timestamps" ||
    die "Failed to clone .timestamps repo. Post-commit hooks will not work."
fi

# Ensure .timestamps has correct auth (in case it was cloned without token)
if [ -n "${GH_TOKEN:-}" ] && [ -d "$PROJECT_DIR/.timestamps/.git" ]; then
  git -C "$PROJECT_DIR/.timestamps" remote set-url origin "$(github_url "$TIMESTAMPS_REPO")"
  # Verify push access works (fetch with auth should succeed if push would)
  if ! git -C "$PROJECT_DIR/.timestamps" ls-remote --quiet origin &>/dev/null; then
    die "Cannot access .timestamps repo with GH_TOKEN. Check token has push permissions to $TIMESTAMPS_REPO"
  fi
fi

cd "$PROJECT_DIR" || exit 1
git config core.hooksPath .hooks

#######################################
# GitHub CLI auth
#######################################

if [ -n "${GH_TOKEN:-}" ] && command -v gh &>/dev/null; then
  echo "Configuring GitHub authentication..."
  echo "$GH_TOKEN" | gh auth login --with-token 2>&1 || warn "Failed to authenticate with GitHub"
fi

#######################################
# Project dependencies
#######################################

if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo "Installing Node dependencies..."
  pnpm install --silent || warn "Failed to install Node dependencies"
fi

command -v uv &>/dev/null && uv sync --quiet 2>/dev/null

echo "Session setup complete"
