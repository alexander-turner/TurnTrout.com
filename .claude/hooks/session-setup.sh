#!/bin/bash
# Session setup script for Claude Code
# Installs dependencies and configures environment for git hooks

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

#######################################
# Helpers
#######################################

warn() { echo "Warning: $1" >&2; }
die() {
  echo "ERROR: $1" >&2
  exit 1
}
is_root() { [ "$(id -u)" = "0" ]; }

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

# Install shfmt for shell script formatting
webi_install_if_missing shfmt

# Install GitHub CLI for PR workflows
webi_install_if_missing gh

# Install jq for JSON processing (used by hooks)
webi_install_if_missing jq

# Install shellcheck for shell script linting (requires root)
if ! command -v shellcheck &>/dev/null && is_root; then
  if ! { apt-get update -qq && apt-get install -y -qq shellcheck; } 2>/dev/null; then
    warn "Failed to install shellcheck"
  fi
fi

#######################################
# Git setup
#######################################

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

# Install Node dependencies if package.json exists and node_modules is missing
if [ -f "$PROJECT_DIR/package.json" ] && [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo "Installing Node dependencies..."
  if command -v pnpm &>/dev/null; then
    pnpm install --silent || warn "Failed to install Node dependencies"
  elif command -v npm &>/dev/null; then
    npm install --silent || warn "Failed to install Node dependencies"
  fi
fi

# Install Python dependencies if uv.lock exists
if [ -f "$PROJECT_DIR/uv.lock" ] && command -v uv &>/dev/null; then
  uv sync --quiet 2>/dev/null || warn "Failed to sync Python dependencies"
fi

echo "Session setup complete"
