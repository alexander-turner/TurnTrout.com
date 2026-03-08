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
		curl -sS "https://webi.sh/$cmd" | sh >/dev/null || warn "Failed to install $cmd"
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
uv_install_if_missing alt-text-llm
if is_root; then
	apt_pkgs=()
	command -v shellcheck &>/dev/null || apt_pkgs+=(shellcheck)
	command -v fish &>/dev/null || apt_pkgs+=(fish)
	if [ ${#apt_pkgs[@]} -gt 0 ]; then
		{ apt-get update -qq && apt-get install -y -qq "${apt_pkgs[@]}"; } ||
			warn "Failed to install ${apt_pkgs[*]}"
	fi
fi

#######################################
# Clean up stale state from previous sessions
#######################################

# Remove stop-hook retry counter for THIS project so a new session starts fresh
# (keyed on project dir hash, matching verify_ci.py's _retry_file)
PROJ_HASH=$(printf '%s' "$PROJECT_DIR" | sha256sum | cut -c1-16)
TMPDIR_ACTUAL=$(python3 -c "import tempfile; print(tempfile.gettempdir())" 2>/dev/null || echo "/tmp")
rm -f "${TMPDIR_ACTUAL}/claude-stop-attempts-${PROJ_HASH}"
# Remove stale push-commit marker (used by verify_ci.py to check remote CI)
rm -f "${TMPDIR_ACTUAL}/claude-last-push-commit"

#######################################
# Git setup
#######################################

cd "$PROJECT_DIR" || exit 1
git config core.hooksPath .hooks

# Pre-fetch the base branch so diffs against $CLAUDE_CODE_BASE_REF work
# immediately (e.g. when creating PRs). Failure is non-fatal.
if [ -n "${CLAUDE_CODE_BASE_REF:-}" ]; then
	git fetch origin "$CLAUDE_CODE_BASE_REF" --quiet 2>/dev/null ||
		warn "Failed to fetch base branch $CLAUDE_CODE_BASE_REF"
fi

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
#
# Lessons learned: `gh repo set-default` still needs at least one remote
# that points to a recognized GitHub host — exporting GH_REPO alone is
# not enough. We therefore add a "github" remote with the real URL so
# that both `gh repo set-default` and `gh pr create --head` resolve
# correctly without manual workarounds.

if [ -z "${GH_REPO:-}" ]; then
	remote_url=$(git -C "$PROJECT_DIR" remote get-url origin 2>/dev/null || true)
	if [[ "$remote_url" =~ /git/([^/]+/[^/]+)$ ]]; then
		GH_REPO="${BASH_REMATCH[1]}"
		GH_REPO="${GH_REPO%.git}"
		export GH_REPO
		if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
			echo "export GH_REPO=\"$GH_REPO\"" >>"$CLAUDE_ENV_FILE"
		fi

		# Add a real GitHub remote so gh CLI can resolve the host
		if ! git -C "$PROJECT_DIR" remote get-url github &>/dev/null; then
			git -C "$PROJECT_DIR" remote add github "https://github.com/${GH_REPO}.git" ||
				warn "Failed to add github remote"
		fi
	fi
fi

# Set gh's default repo so commands like `gh pr create` work even when
# the git remote is a local proxy URL that gh can't resolve.
if [ -n "${GH_REPO:-}" ] && command -v gh &>/dev/null; then
	if ! gh repo set-default "$GH_REPO" 2>/dev/null; then
		# gh repo set-default fails when remotes point to a local proxy.
		# Write .gh-resolved directly — this is the file gh uses internally.
		printf 'base\n%s\n' "$GH_REPO" >"$PROJECT_DIR/.gh-resolved"
	fi
fi

#######################################
# DeepSource CLI
# Official CLI now supports --commit, --pr, --default-branch flags
#######################################

if ! command -v deepsource &>/dev/null; then
  echo "Installing DeepSource CLI..."
  curl -fsSL https://cli.deepsource.com/install | BINDIR="$HOME/.local/bin" sh 2>/dev/null \
    || warn "Failed to install DeepSource CLI"
fi

if [ -n "${DEEPSOURCE_PAT:-}" ] && command -v deepsource &>/dev/null; then
  echo "Configuring DeepSource authentication..."
  deepsource auth login --with-token "$DEEPSOURCE_PAT" || warn "Failed to authenticate with DeepSource"
fi

#######################################
# Timestamps repo (required by post-commit hook)
#######################################

if [ ! -d "$PROJECT_DIR/.timestamps/.git" ]; then
	# In web sessions, direct GitHub URLs may not work through the local proxy.
	# Use GH_TOKEN for authentication if available.
	if [ -n "${GH_TOKEN:-}" ]; then
		git clone --quiet "https://x-access-token:${GH_TOKEN}@github.com/alexander-turner/.timestamps.git" \
			"$PROJECT_DIR/.timestamps" ||
			warn "Failed to clone .timestamps repo"
	else
		git clone --quiet https://github.com/alexander-turner/.timestamps "$PROJECT_DIR/.timestamps" ||
			warn "Failed to clone .timestamps repo"
	fi
fi

# Configure .timestamps push access using GH_TOKEN (the local proxy only
# authorizes the main repo, so .timestamps needs direct GitHub auth)
if [ -d "$PROJECT_DIR/.timestamps/.git" ] && [ -n "${GH_TOKEN:-}" ]; then
	git -C "$PROJECT_DIR/.timestamps" remote set-url origin \
		"https://x-access-token:${GH_TOKEN}@github.com/alexander-turner/.timestamps.git"
fi

# Install opentimestamps-client (needed by post-commit hook, not pre-installed in web sessions)
uv_install_if_missing ots opentimestamps-client

#######################################
# Project dependencies
#######################################

if [ -f "$PROJECT_DIR/package.json" ]; then
	# Always run install (git hooks are configured in package.json postinstall)
	if command -v pnpm &>/dev/null; then
		pnpm install --silent || warn "Failed to install Node dependencies"
	elif command -v npm &>/dev/null; then
		npm install --silent || warn "Failed to install Node dependencies"
	fi
fi

if [ -f "$PROJECT_DIR/uv.lock" ] && command -v uv &>/dev/null; then
	uv sync --quiet || warn "Failed to sync Python dependencies"
	# Add .venv/bin to PATH so Python tools are available to hooks
	if [ -d "$PROJECT_DIR/.venv/bin" ]; then
		export PATH="$PROJECT_DIR/.venv/bin:$PATH"
		if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
			echo "export PATH=\"$PROJECT_DIR/.venv/bin:\$PATH\"" >>"$CLAUDE_ENV_FILE"
		fi
	fi
	# Pre-warm dmypy daemon in the background so lint-staged mypy checks are
	# fast (~1s) on all commits rather than cold-starting (~18s) on the first.
	uv run dmypy start -- --config-file "$PROJECT_DIR/config/python/mypy.ini" \
		>/dev/null &
fi

if [ "$SETUP_WARNINGS" -gt 0 ]; then
	echo "Setup done with $SETUP_WARNINGS warning(s) — see above" >&2
fi
