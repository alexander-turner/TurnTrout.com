#!/usr/bin/env bash
# Reconcile the .timestamps git remote with the current session type.
#
# Why this exists: the .timestamps repo lives *inside* the project directory,
# which claude-guard bind-mounts into the sandbox as a WRITABLE /workspace.
# So writes to .timestamps/.git/config land in the user's real host config.
#
#   - In an ephemeral web sandbox the container (and its .git/config) is
#     discarded on exit, so baking the session GH_TOKEN into the remote and
#     relaxing TLS verification is safe and lets the post-commit hook push.
#   - In a local claude-guard run those same writes persist onto the host:
#     the session token expires when the session ends and the http.sslVerify
#     downgrade lingers, silently breaking the user's push credentials on
#     every subsequent commit. So locally we never write session auth;
#     instead we REPAIR a config a prior session leaked into — restoring a
#     clean remote (handing auth back to the user's credential helper) and
#     re-enabling TLS verification.
#
# Usage: configure_timestamps_remote.sh <timestamps_repo_dir> <is_web_sandbox>
# Env:   GH_TOKEN — used only when is_web_sandbox=true.

set -uo pipefail

ts_repo="${1:?timestamps repo dir required}"
is_web_sandbox="${2:?is_web_sandbox (true|false) required}"

[ -d "$ts_repo/.git" ] || exit 0

token_marker="x-access-token"
clean_url="https://github.com/alexander-turner/.timestamps.git"
remote_url="$(git -C "$ts_repo" remote get-url origin 2>/dev/null || true)"

if [ "$is_web_sandbox" = true ]; then
	# Inject the session token only when we have one and the remote is not
	# already a token URL or the in-sandbox proxy URL the web harness set up
	# (rewriting the proxy URL to github.com would break the sandbox's only
	# authorized path).
	if [ -n "${GH_TOKEN:-}" ] &&
		[[ "$remote_url" != *"$token_marker"* ]] &&
		[[ "$remote_url" != *"local_proxy@"* ]]; then
		git -C "$ts_repo" remote set-url origin \
			"https://${token_marker}:${GH_TOKEN}@github.com/alexander-turner/.timestamps.git"
		git -C "$ts_repo" config http.sslVerify false
	fi
	exit 0
fi

# Local bind-mount: undo any session token + TLS downgrade a prior web/local
# session leaked into the host config.
if [[ "$remote_url" == *"$token_marker"* ]]; then
	git -C "$ts_repo" remote set-url origin "$clean_url"
fi
if [ "$(git -C "$ts_repo" config --local --get http.sslVerify 2>/dev/null || true)" = "false" ]; then
	git -C "$ts_repo" config --local --unset http.sslVerify
fi

exit 0
