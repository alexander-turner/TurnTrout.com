#!/bin/bash
# Session setup script for Claude Code
# Installs dependencies and configures environment for git hooks
#
# IMPORTANT: This file has project-specific customizations:
# - OpenTimestamps (ots) installation
# - .timestamps repo cloning for post-commit hooks
# - pnpm only (no npm fallback)
# Do NOT replace with the generic template version during template-sync.
# Future Claudes: Leave these customizations as-is.

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
TIMESTAMPS_REPO="alexander-turner/.timestamps"

#######################################
# Helpers
#######################################

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

pip_install_if_missing() {
  local cmd="$1" pkg="${2:-$1}"
  if ! command -v "$cmd" &>/dev/null; then
    pip3 install --quiet "$pkg" || die "Failed to install $pkg"
  fi
}

webi_install_if_missing() {
  local cmd="$1"
  if ! command -v "$cmd" &>/dev/null; then
    echo "Installing $cmd..."
    curl -sS "https://webi.sh/$cmd" | sh >/dev/null 2>&1 || die "Failed to install $cmd"
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
# Tool installation
#######################################

echo "Installing tools..."
# docformatter and pyupgrade are managed by uv.lock, not pip
pip_install_if_missing ots opentimestamps-client
webi_install_if_missing shfmt
webi_install_if_missing gh
webi_install_if_missing jq

if is_root; then
  apt_pkgs=()
  command -v shellcheck &>/dev/null || apt_pkgs+=(shellcheck)
  command -v fish &>/dev/null || apt_pkgs+=(fish)
  if [ ${#apt_pkgs[@]} -gt 0 ]; then
    if ! { apt-get update -qq && apt-get install -y -qq "${apt_pkgs[@]}"; } 2>/dev/null; then
      die "Failed to install ${apt_pkgs[*]}"
    fi
  fi
fi

if ! command -v fish &>/dev/null && is_root; then
  if ! apt-get install -y -qq fish 2>/dev/null; then
    die "Failed to install fish (needed for fish_indent in lint-staged)"
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
  echo "$GH_TOKEN" | gh auth login --with-token 2>&1 || die "Failed to authenticate with GitHub"
fi

#######################################
# DeepSource CLI
#######################################

if ! command -v deepsource &>/dev/null; then
  echo "Installing DeepSource CLI..."
  BINDIR="$HOME/.local/bin" curl -sSL https://deepsource.io/cli | sh 2>/dev/null || die "Failed to install DeepSource CLI"
fi

if [ -n "${DEEPSOURCE_PAT:-}" ] && command -v deepsource &>/dev/null; then
  echo "Configuring DeepSource authentication..."
  deepsource auth login --with-token "$DEEPSOURCE_PAT" 2>&1 || die "Failed to authenticate with DeepSource"
fi

#######################################
# Project dependencies
#######################################

echo "Installing Node dependencies..."
pnpm install --silent || die "Failed to install Node dependencies"

command -v uv &>/dev/null && uv sync --quiet 2>/dev/null

echo "Session setup complete"
