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
# Downloads the installer to a temp file first (avoid piping curl to sh directly)
webi_install_if_missing() {
	local cmd="$1"
	if ! command -v "$cmd" &>/dev/null; then
		local installer
		installer=$(mktemp "${TMPDIR:-/tmp}/webi-${cmd}-XXXXXX.sh")
		if curl -fsSL "https://webi.sh/$cmd" -o "$installer" 2>/dev/null; then
			sh "$installer" >/dev/null 2>&1 || warn "Failed to install $cmd"
		else
			warn "Failed to download installer for $cmd"
		fi
		rm -f "$installer"
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
# rclone (needed for R2 asset uploads in pre-push hook)
#######################################

if ! command -v rclone &>/dev/null; then
	if is_root; then
		{ apt-get update -qq && apt-get install -y -qq rclone; } 2>/dev/null ||
			warn "Failed to install rclone via apt"
	else
		curl -fsSL https://rclone.org/install.sh | sudo bash 2>/dev/null ||
			warn "Failed to install rclone"
	fi
fi

# Configure rclone R2 remote from environment variables
if command -v rclone &>/dev/null && \
   [ -n "${ACCESS_KEY_ID_TURNTROUT_MEDIA:-}" ] && \
   [ -n "${SECRET_ACCESS_TURNTROUT_MEDIA:-}" ] && \
   [ -n "${S3_ENDPOINT_ID_TURNTROUT_MEDIA:-}" ]; then
	RCLONE_CONFIG_DIR="${HOME}/.config/rclone"
	mkdir -p "$RCLONE_CONFIG_DIR"
	cat > "$RCLONE_CONFIG_DIR/rclone.conf" <<RCLONE_EOF
[r2]
type = s3
provider = Cloudflare
access_key_id = ${ACCESS_KEY_ID_TURNTROUT_MEDIA}
secret_access_key = ${SECRET_ACCESS_TURNTROUT_MEDIA}
endpoint = https://${S3_ENDPOINT_ID_TURNTROUT_MEDIA}.r2.cloudflarestorage.com
no_check_bucket = true
RCLONE_EOF
	chmod 600 "$RCLONE_CONFIG_DIR/rclone.conf"
fi

#######################################
# Clean up stale state from previous sessions
#######################################

# Remove stop-hook retry counter for THIS project so a new session starts fresh
# (keyed on project dir hash, matching verify_ci.py's _retry_file)
PROJ_HASH=$(printf '%s' "$PROJECT_DIR" | sha256sum | cut -c1-16)
TMPDIR_ACTUAL=$(python3 -c "import tempfile; print(tempfile.gettempdir())" 2>/dev/null || echo "/tmp")
RETRY_DIR="${TMPDIR_ACTUAL}/claude-stop-$(id -u)"
rm -f "${RETRY_DIR}/attempts-${PROJ_HASH}"
# Remove stale push-commit marker (used by verify_ci.py to check remote CI)
rm -f "/tmp/claude-last-push-commit"

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
# Always write .gh-resolved in proxy environments — `gh repo set-default`
# may exit 0 via the `github` remote but `gh pr create` still fails
# trying to resolve `origin`.
if [ -n "${GH_REPO:-}" ] && command -v gh &>/dev/null; then
	printf 'base\n%s\n' "$GH_REPO" >"$PROJECT_DIR/.gh-resolved"
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
	# Web sessions lack CA certs for direct GitHub access; disable SSL
	# verification for this repo only (the token provides auth security).
	git -C "$PROJECT_DIR/.timestamps" config http.sslVerify false
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
