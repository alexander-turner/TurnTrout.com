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

SETUP_WARNINGS=0
warn() {
  echo "WARNING: $1" >&2
  SETUP_WARNINGS=$((SETUP_WARNINGS + 1))
}
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

uv_install_if_missing() {
  local cmd="$1" pkg="${2:-$1}"
  if ! command -v "$cmd" &>/dev/null; then
    uv tool install --quiet "$pkg" || warn "Failed to install $pkg"
  fi
}

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
# Tool installation
#######################################

echo "Installing tools..."
# docformatter and pyupgrade are managed by uv.lock, not pip
uv_install_if_missing ots opentimestamps-client
webi_install_if_missing shfmt
webi_install_if_missing gh
webi_install_if_missing jq

if is_root; then
  apt_pkgs=()
  command -v shellcheck &>/dev/null || apt_pkgs+=(shellcheck)
  command -v fish &>/dev/null || apt_pkgs+=(fish)
  if [ ${#apt_pkgs[@]} -gt 0 ]; then
    if ! { apt-get update -qq && apt-get install -y -qq "${apt_pkgs[@]}"; } 2>/dev/null; then
      warn "Failed to install ${apt_pkgs[*]}"
    fi
  fi
fi

#######################################
# Clean up stale state from previous sessions
#######################################

# Remove stop-hook retry counter for THIS project so a new session starts fresh
# (keyed on project dir hash, matching verify_ci.py's _retry_file)
PROJ_HASH=$(printf '%s' "$PROJECT_DIR" | sha256sum | cut -c1-16)
rm -f "/tmp/claude-stop-attempts-${PROJ_HASH}"

#######################################
# Git setup
#######################################

# Clone .timestamps repo (required for post-commit hooks)
if [ ! -d "$PROJECT_DIR/.timestamps/.git" ]; then
  echo "Cloning .timestamps repo..."
  rm -rf "$PROJECT_DIR/.timestamps" 2>/dev/null
  git clone --quiet "$(github_url "$TIMESTAMPS_REPO")" "$PROJECT_DIR/.timestamps" ||
    warn "Failed to clone .timestamps repo. Post-commit hooks will not work."
fi

# Ensure .timestamps has correct auth (in case it was cloned without token)
if [ -n "${GH_TOKEN:-}" ] && [ -d "$PROJECT_DIR/.timestamps/.git" ]; then
  git -C "$PROJECT_DIR/.timestamps" remote set-url origin "$(github_url "$TIMESTAMPS_REPO")"
  # Verify push access works (fetch with auth should succeed if push would)
  if ! git -C "$PROJECT_DIR/.timestamps" ls-remote --quiet origin &>/dev/null; then
    warn "Cannot access .timestamps repo with GH_TOKEN. Check token has push permissions to $TIMESTAMPS_REPO"
  fi
fi

cd "$PROJECT_DIR" || exit 1
git config core.hooksPath .hooks

#######################################
# GitHub CLI auth
#######################################

if ! command -v gh &>/dev/null; then
  warn "gh CLI not found"
elif [ -z "${GH_TOKEN:-}" ]; then
  warn "GH_TOKEN is not set — GitHub CLI requires authentication"
else
  echo "Configuring GitHub authentication..."
  if ! echo "$GH_TOKEN" | gh auth login --with-token 2>&1; then
    warn "Failed to authenticate with GitHub"
  fi
fi

#######################################
# GitHub repo detection for proxy environments
#######################################

# In Claude Code web sessions, git remotes use a local proxy URL like:
#   http://local_proxy@127.0.0.1:18393/git/owner/repo
# The gh CLI can't detect the GitHub repo from this, so we extract
# owner/repo and export GH_REPO to make all gh commands work.

if [ -z "${GH_REPO:-}" ]; then
  remote_url=$(git -C "$PROJECT_DIR" remote get-url origin 2>/dev/null || true)
  if [[ "$remote_url" =~ /git/([^/]+/[^/]+)$ ]]; then
    GH_REPO="${BASH_REMATCH[1]}"
    GH_REPO="${GH_REPO%.git}"
    export GH_REPO
    echo "Detected GitHub repo from proxy remote: $GH_REPO"
    if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
      echo "export GH_REPO=\"$GH_REPO\"" >>"$CLAUDE_ENV_FILE"
    fi
  fi
fi

#######################################
# DeepSource CLI
#######################################

if ! command -v deepsource &>/dev/null; then
  echo "Installing DeepSource CLI..."
  curl -sSL https://deepsource.io/cli | BINDIR="$HOME/.local/bin" sh 2>/dev/null || warn "Failed to install DeepSource CLI"
fi

if [ -n "${DEEPSOURCE_PAT:-}" ] && command -v deepsource &>/dev/null; then
  echo "Configuring DeepSource authentication..."
  deepsource auth login --with-token "$DEEPSOURCE_PAT" 2>&1 || warn "Failed to authenticate with DeepSource"
fi

#######################################
# Project dependencies
#######################################

echo "Installing Node dependencies..."
pnpm install --silent || warn "Failed to install Node dependencies"

if command -v uv &>/dev/null; then
  uv sync --quiet 2>/dev/null
  # Add .venv/bin to PATH so Python tools (autoflake, isort, autopep8, etc.)
  # installed by uv sync are available to lint-staged and other commands
  if [ -d "$PROJECT_DIR/.venv/bin" ]; then
    export PATH="$PROJECT_DIR/.venv/bin:$PATH"
    if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
      echo "export PATH=\"$PROJECT_DIR/.venv/bin:\$PATH\"" >>"$CLAUDE_ENV_FILE"
    fi
  fi
fi

if [ "$SETUP_WARNINGS" -gt 0 ]; then
  echo "Session setup complete with $SETUP_WARNINGS warning(s)" >&2
else
  echo "Session setup complete"
fi
