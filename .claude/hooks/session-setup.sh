#!/bin/bash
# Session setup script for Claude Code
# Installs dependencies and configures environment for git hooks

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

#######################################
# Helpers
#######################################

SETUP_WARNINGS=0
warn() {
	echo "WARNING: $1" >&2
	SETUP_WARNINGS=$((SETUP_WARNINGS + 1))
}
is_root() { [ "$(id -u)" = "0" ]; }

# Install a command via uv if missing
uv_install_if_missing() {
	local cmd="$1" pkg="${2:-$1}"
	if ! command -v "$cmd" &>/dev/null; then
		uv tool install --quiet "$pkg" || warn "Failed to install $pkg"
	fi
}

# Install a command via webi if missing
webi_install_if_missing() {
	local cmd="$1"
	if ! command -v "$cmd" &>/dev/null; then
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

# Install tools quietly — only warn on failure
webi_install_if_missing shfmt
webi_install_if_missing gh
webi_install_if_missing jq
if ! command -v shellcheck &>/dev/null && is_root; then
	{ apt-get update -qq && apt-get install -y -qq shellcheck; } || warn "Failed to install shellcheck"
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

cd "$PROJECT_DIR" || exit 1
git config core.hooksPath .hooks

#######################################
# GitHub CLI auth
#######################################

if ! command -v gh &>/dev/null; then
	warn "gh CLI not found"
elif [ -z "${GH_TOKEN:-}" ]; then
	warn "GH_TOKEN is not set — GitHub CLI requires authentication"
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
		if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
			echo "export GH_REPO=\"$GH_REPO\"" >>"$CLAUDE_ENV_FILE"
		fi
	fi
fi

# Set gh's default repo so commands like `gh pr create` work even when
# the git remote is a local proxy URL that gh can't resolve.
if [ -n "${GH_REPO:-}" ] && command -v gh &>/dev/null; then
	gh repo set-default "$GH_REPO" || warn "Failed to set default repo for gh"
fi

#######################################
# DeepSource CLI (fork with --commit support)
# Source: https://github.com/DeepSourceCorp/cli/pull/267
#######################################

if ! command -v deepsource &>/dev/null; then
  echo "Installing DeepSource CLI (fork with --commit flag)..."
  if command -v go &>/dev/null; then
    _ds_tmp=$(mktemp -d)
    if git clone --quiet --branch feat/issues-list-by-commit --depth 1 \
      "$(github_url "alexander-turner/cli")" "$_ds_tmp/cli" 2>/dev/null; then
      (cd "$_ds_tmp/cli" && go build -o "$HOME/.local/bin/deepsource" ./cmd/deepsource) 2>/dev/null \
        || warn "Failed to build DeepSource CLI fork"
    else
      warn "Failed to clone DeepSource CLI fork"
    fi
    rm -rf "$_ds_tmp"
  else
    # Fallback to official CLI (without --commit support)
    curl -sSL https://deepsource.io/cli | BINDIR="$HOME/.local/bin" sh 2>/dev/null || warn "Failed to install DeepSource CLI"
  fi
fi

if [ -n "${DEEPSOURCE_PAT:-}" ] && command -v deepsource &>/dev/null; then
  echo "Configuring DeepSource authentication..."
  deepsource auth login --with-token "$DEEPSOURCE_PAT" 2>&1 || warn "Failed to authenticate with DeepSource"
fi

#######################################
# Project dependencies
#######################################

if [ -f "$PROJECT_DIR/package.json" ]; then
	if command -v pnpm &>/dev/null; then
		pnpm install --silent || warn "Failed to install Node dependencies"
	elif command -v npm &>/dev/null; then
		npm install --silent || warn "Failed to install Node dependencies"
	fi
fi

if [ -f "$PROJECT_DIR/uv.lock" ] && command -v uv &>/dev/null; then
	uv sync --quiet || warn "Failed to sync Python dependencies"
	if [ -d "$PROJECT_DIR/.venv/bin" ]; then
		export PATH="$PROJECT_DIR/.venv/bin:$PATH"
		if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
			echo "export PATH=\"$PROJECT_DIR/.venv/bin:\$PATH\"" >>"$CLAUDE_ENV_FILE"
		fi
	fi
fi

if [ "$SETUP_WARNINGS" -gt 0 ]; then
	echo "Setup done with $SETUP_WARNINGS warning(s) — see above" >&2
fi
