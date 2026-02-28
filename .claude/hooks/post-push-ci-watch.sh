#!/bin/bash
# PostToolUse hook: watch CI checks after git push or gh pr create.
# In web sessions the origin remote is a local proxy URL that gh can't
# auto-detect as GitHub, so we extract the repo from the URL ourselves
# and pass it explicitly with --repo <branch>.

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR" || exit 1

# Extract owner/repo from proxy-style remote URL:
#   http://local_proxy@127.0.0.1:PORT/git/owner/repo
remote_url=$(git remote get-url origin 2>/dev/null || true)
if [[ "$remote_url" =~ /git/([^/]+/[^/?]+) ]]; then
	repo="${BASH_REMATCH[1]%.git}"
else
	echo "post-push-ci-watch: could not determine repo from remote — skipping CI watch" >&2
	exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
if [ -z "$branch" ] || [ "$branch" = "HEAD" ]; then
	echo "post-push-ci-watch: could not determine current branch — skipping CI watch" >&2
	exit 0
fi

log=/tmp/claude-ci-watch.log
sleep 10

timeout 300 gh pr checks --repo "$repo" "$branch" --watch >"$log" 2>&1
rc=$?

if [ $rc -ne 0 ]; then
	echo "CI failed (exit $rc) — see $log"
	tail -20 "$log"
	exit $rc
fi

echo "CI passed"
