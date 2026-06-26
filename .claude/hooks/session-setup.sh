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

# Install vale (prose linter) if missing, from a pinned GitHub release.
# webi has no vale package, so pull the official tarball directly. The version
# is the single source of truth in config/vale/version, shared with CI
# (lint-and-validate.yaml) so pre-push and CI never drift; required by the
# pre-push spellcheck/prose gate.
VALE_VERSION="$(cat "$PROJECT_DIR/config/vale/version")"
vale_install_if_missing() {
	command -v vale &>/dev/null && return 0
	local os arch
	case "$(uname -s)" in
	Linux) os=Linux ;;
	Darwin) os=macOS ;;
	*) warn "Unsupported OS for vale install: $(uname -s)" && return 0 ;;
	esac
	case "$(uname -m)" in
	x86_64 | amd64) arch=64-bit ;;
	aarch64 | arm64) arch=arm64 ;;
	*) warn "Unsupported arch for vale install: $(uname -m)" && return 0 ;;
	esac
	local url tarball
	url="https://github.com/errata-ai/vale/releases/download/v${VALE_VERSION}/vale_${VALE_VERSION}_${os}_${arch}.tar.gz"
	tarball=$(mktemp "${TMPDIR:-/tmp}/vale-XXXXXX.tar.gz")
	mkdir -p "$HOME/.local/bin"
	if curl --proto '=https' -fsSL "$url" -o "$tarball" 2>/dev/null; then
		tar -xzf "$tarball" -C "$HOME/.local/bin" vale 2>/dev/null || warn "Failed to extract vale"
	else
		warn "Failed to download vale from $url"
	fi
	rm -f "$tarball"
}

# Install a command via webi if missing
# $1 = command name, $2 = optional webi package specifier (e.g. tool@version)
# Hardened: HTTPS-only, shebang validation, version pinning via $2
webi_install_if_missing() {
	local cmd="$1" pkg="${2:-$1}"
	if ! command -v "$cmd" &>/dev/null; then
		local installer
		installer=$(mktemp "${TMPDIR:-/tmp}/webi-${cmd}-XXXXXX.sh")
		if curl --proto '=https' -fsSL "https://webi.sh/$pkg" -o "$installer" 2>/dev/null; then
			if head -n 1 "$installer" | grep -q '^#!'; then
				sh "$installer" >/dev/null 2>&1 || warn "Failed to install $cmd"
			else
				warn "Installer for $cmd is not a shell script (missing shebang) — skipping"
			fi
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

# Install tools quietly — only warn on failure (versions pinned for supply-chain safety)
webi_install_if_missing shfmt shfmt@3
webi_install_if_missing gh gh@2
webi_install_if_missing jq jq@1.7
# vale is required by the pre-push spellcheck/prose gate (it errors when vale
# is absent), so install it here rather than letting it silently skip.
vale_install_if_missing
uv_install_if_missing alt-text-llm
if is_root; then
	# Map: command-to-probe -> apt package name. ffmpeg/imagemagick are
	# needed by scripts/tests/test_compress.py et al. (the Stop hook runs
	# pytest, and ~75 tests + 60 errors fall over without them). rclone
	# (R2 uploads/downloads in scripts/r2_*.py and the pre-push hook) is
	# only added below when R2 creds are present — fresh sandboxes
	# without creds skip the ~5s apt install.
	declare -A apt_needed=(
		[shellcheck]=shellcheck
		[fish]=fish
		[ffmpeg]=ffmpeg
		[convert]=imagemagick
		[exiftool]=libimage-exiftool-perl
	)
	if [ -n "${ACCESS_KEY_ID_TURNTROUT_MEDIA:-}" ] && \
	   [ -n "${SECRET_ACCESS_TURNTROUT_MEDIA:-}" ] && \
	   [ -n "${S3_ENDPOINT_ID_TURNTROUT_MEDIA:-}" ]; then
		apt_needed[rclone]=rclone
	fi
	apt_pkgs=()
	for cmd in "${!apt_needed[@]}"; do
		command -v "$cmd" &>/dev/null || apt_pkgs+=("${apt_needed[$cmd]}")
	done
	if [ ${#apt_pkgs[@]} -gt 0 ]; then
		{ apt-get update -qq && apt-get install -y -qq "${apt_pkgs[@]}"; } ||
			warn "Failed to install ${apt_pkgs[*]}"
	fi
fi

# scripts/compress.py and convert_markdown_yaml.py hard-code the IM7
# `magick` binary. Ubuntu's `imagemagick` apt package only ships the
# legacy IM6 `convert`, so first try the official IM7 portable AppImage,
# then fall back to a thin wrapper over IM6 `convert`.
if ! command -v magick &>/dev/null; then
	IM_DIR="$HOME/.local/imagemagick"
	mkdir -p "$IM_DIR"
	MAGICK_INSTALLED=false
	if curl -fsSL https://imagemagick.org/archive/binaries/magick \
		-o "$IM_DIR/magick.AppImage" 2>/dev/null; then
		chmod +x "$IM_DIR/magick.AppImage"
		if (cd "$IM_DIR" && "$IM_DIR/magick.AppImage" --appimage-extract >/dev/null 2>&1); then
			ln -sf "$IM_DIR/squashfs-root/AppRun" "$HOME/.local/bin/magick" &&
				MAGICK_INSTALLED=true
		fi
	fi
	# Fallback: create a wrapper that delegates to IM6 `convert`.
	# The codebase calls `magick <input> <flags> <output>` which is
	# equivalent to IM6's `convert <input> <flags> <output>`.
	if [ "$MAGICK_INSTALLED" = false ] && command -v convert &>/dev/null; then
		cat > "$HOME/.local/bin/magick" <<'WRAPPER'
#!/bin/sh
# Thin IM6 compatibility wrapper: `magick` → `convert`
# IM7's `magick <args>` ≈ IM6's `convert <args>` for image operations
exec convert "$@"
WRAPPER
		chmod +x "$HOME/.local/bin/magick"
	elif [ "$MAGICK_INSTALLED" = false ]; then
		warn "ImageMagick not available (neither IM7 AppImage nor IM6 convert)"
	fi
fi

#######################################
# rclone (needed for R2 asset uploads in pre-push hook)
#
# Install via apt above (bundled with other system deps for atomicity).
# Non-root sandboxes fall back to the official installer.
#######################################

if ! command -v rclone &>/dev/null && ! is_root; then
	curl -fsSL https://rclone.org/install.sh | sudo bash 2>/dev/null ||
		warn "Failed to install rclone"
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

# Distinguish an ephemeral web sandbox (the main repo's remote is the local
# proxy and the container is discarded on exit) from a local claude-guard run,
# where the project — including a nested .timestamps — is a WRITABLE bind-mount
# of the host repo. Session auth written into .timestamps/.git/config persists
# onto the host in the local case and breaks the user's real credentials once
# the session token expires, so this distinction gates every auth write below.
project_remote=$(git -C "$PROJECT_DIR" remote get-url origin 2>/dev/null || true)
is_web_sandbox=false
[[ "$project_remote" == *"local_proxy@"* ]] && is_web_sandbox=true

if [ ! -d "$PROJECT_DIR/.timestamps/.git" ]; then
	# Bake the session token into the clone only in a web sandbox; locally,
	# clone clean and let the user's credential helper provide auth.
	if [ "$is_web_sandbox" = true ] && [ -n "${GH_TOKEN:-}" ]; then
		git clone --quiet "https://x-access-token:${GH_TOKEN}@github.com/alexander-turner/.timestamps.git" \
			"$PROJECT_DIR/.timestamps" ||
			warn "Failed to clone .timestamps repo"
	else
		git clone --quiet https://github.com/alexander-turner/.timestamps "$PROJECT_DIR/.timestamps" ||
			warn "Failed to clone .timestamps repo"
	fi
fi

# Reconcile the .timestamps remote with the session type: inject the session
# token in a web sandbox, or repair host config a prior session leaked into.
bash "$PROJECT_DIR/scripts/configure_timestamps_remote.sh" \
	"$PROJECT_DIR/.timestamps" "$is_web_sandbox" ||
	warn "Failed to configure .timestamps remote"

# Pre-fetch .timestamps origin/master so the post-commit hook's
# `git pull --rebase` works against an already-warm DNS/TLS connection
# and an already-up-to-date ref (the rebase still fetches, but the
# delta is empty/small).
if [ -d "$PROJECT_DIR/.timestamps/.git" ]; then
	pre_fetch_err=$(git -C "$PROJECT_DIR/.timestamps" \
		fetch --quiet origin master 2>&1) ||
		warn "Failed to pre-fetch .timestamps origin/master: $pre_fetch_err"
fi

# Configure `.timestamps`'s local git identity from the authenticated
# GitHub user so post-commit-hook timestamp commits are attributed to
# the real human, not to whatever the session's global git config
# defaults to (in Claude Code web sandboxes that's "Claude" /
# noreply@anthropic.com). Falls back to the GitHub noreply email when
# the public email is hidden. Only writes when the local config is
# unset, so a deliberate user override survives subsequent sessions.
if [ -d "$PROJECT_DIR/.timestamps/.git" ] && \
   command -v gh >/dev/null 2>&1; then
	if ! command -v jq >/dev/null 2>&1; then
		warn "jq missing; skipping .timestamps identity setup"
	else
		gh_user_json=$(gh api user 2>/dev/null) || {
			[ -n "${GH_TOKEN:-}" ] && warn \
				"gh api user failed; .timestamps identity not configured"
			gh_user_json=""
		}
		if [ -n "$gh_user_json" ]; then
			ts_repo="$PROJECT_DIR/.timestamps"
			gh_name=$(echo "$gh_user_json" | jq -r '.name // empty')
			gh_email=$(echo "$gh_user_json" | jq -r '.email // empty')
			gh_login=$(echo "$gh_user_json" | jq -r '.login // empty')
			gh_id=$(echo "$gh_user_json" | jq -r '.id // empty')
			if [ -n "$gh_name" ] && \
			   ! git -C "$ts_repo" config --local --get user.name >/dev/null; then
				git -C "$ts_repo" config user.name "$gh_name"
			fi
			if ! git -C "$ts_repo" config --local --get user.email >/dev/null; then
				if [ -n "$gh_email" ]; then
					git -C "$ts_repo" config user.email "$gh_email"
				elif [ -n "$gh_id" ] && [ -n "$gh_login" ]; then
					git -C "$ts_repo" config user.email \
						"${gh_id}+${gh_login}@users.noreply.github.com"
				fi
			fi
		fi
	fi
fi

# Install opentimestamps-client (needed by post-commit hook, not pre-installed in web sessions)
uv_install_if_missing ots opentimestamps-client

# Verify ots is actually callable. Catches a silent install failure now
# rather than at the next commit, where the post-commit hook would roll
# back the commit with a stale-looking error. Surface the prior warning
# count so a slow install isn't drowned out by the exit-1 message.
die_ots() {
	[ "$SETUP_WARNINGS" -gt 0 ] && echo \
		"(plus $SETUP_WARNINGS earlier warning(s) — see above)" >&2
	exit 1
}
if ! command -v ots >/dev/null 2>&1; then
	echo "ERROR: ots not on PATH after install; post-commit hook will fail" >&2
	die_ots
elif ! ots --version >/dev/null 2>&1; then
	echo "ERROR: ots --version failed; post-commit hook may misbehave" >&2
	die_ots
fi

#######################################
# Project dependencies
#######################################

if [ -f "$PROJECT_DIR/package.json" ]; then
	# Always run install (git hooks are configured in package.json postinstall)
	# Skip Puppeteer's Chrome download — sandboxed environments can't reach
	# storage.googleapis.com, and we use Playwright's browsers instead.
	# Without this, subfont's nested `pnpm install` fails on puppeteer's
	# postinstall, aborting the entire install and leaving node_modules incomplete.
	export PUPPETEER_SKIP_DOWNLOAD=true
	if command -v pnpm &>/dev/null; then
		# Skip Puppeteer browser download — sandboxed environments can't reach
		# storage.googleapis.com and Playwright browsers are used instead.
		PUPPETEER_SKIP_DOWNLOAD=true pnpm install --silent || warn "Failed to install Node dependencies"
	elif command -v npm &>/dev/null; then
		npm install --silent || warn "Failed to install Node dependencies"
	fi
	# Add node_modules/.bin to PATH so binaries like `sass` (used by
	# source_file_checks.py) and `vale`/`spellchecker` are reachable from
	# the pre-push hook without invoking pnpm exec.
	if [ -d "$PROJECT_DIR/node_modules/.bin" ]; then
		export PATH="$PROJECT_DIR/node_modules/.bin:$PATH"
		if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
			echo "export PATH=\"$PROJECT_DIR/node_modules/.bin:\$PATH\"" >>"$CLAUDE_ENV_FILE"
		fi
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
fi

if [ "$SETUP_WARNINGS" -gt 0 ]; then
	echo "Setup done with $SETUP_WARNINGS warning(s) — see above" >&2
fi
