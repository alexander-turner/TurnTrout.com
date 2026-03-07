#!/bin/bash
# PostToolUse hook: watch CI workflow runs after git push or gh pr create.
#
# Uses `gh run list` + polling (works for any push, with or without a PR).
# Previous approach used `gh pr checks --watch` which silently failed when
# no PR existed for the branch.

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR" || exit 1

# Match verify_ci.py's tempfile.gettempdir() — on Linux both resolve $TMPDIR then /tmp
MARKER_FILE="${TMPDIR:-/tmp}/claude-last-push-commit"

# Build --repo flag array (needed in web sessions where origin is a proxy URL)
repo_flag=()
if [ -n "${GH_REPO:-}" ]; then
	repo_flag=(--repo "$GH_REPO")
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
commit=$(git rev-parse HEAD 2>/dev/null || true)

if [ -z "$branch" ] || [ "$branch" = "HEAD" ] || [ -z "$commit" ]; then
	echo "post-push-ci-watch: could not determine branch/commit — skipping"
	exit 0
fi

# Record push immediately (so the Stop hook knows to check remote CI even
# if this hook times out or no workflow runs appear yet).
# Format: line 1 = commit SHA, line 2 = branch name
printf '%s\n%s\n' "$commit" "$branch" >"$MARKER_FILE"

short_commit=${commit:0:7}
echo "Watching CI for branch '$branch' (commit $short_commit)..."

# --- Wait for workflow runs to appear (GitHub can take 15-30s) ---
max_wait=90
waited=0
count=0

while [ "$waited" -lt "$max_wait" ]; do
	sleep 10
	waited=$((waited + 10))
	count=$(gh run list "${repo_flag[@]}" --branch "$branch" --commit "$commit" \
		--json databaseId --jq 'length' 2>/dev/null || echo "0")
	if [ "$count" -gt 0 ]; then
		break
	fi
done

if [ "$count" = "0" ]; then
	echo "post-push-ci-watch: no workflow runs found after ${max_wait}s — skipping"
	exit 0
fi

# --- Poll until all runs complete ---
max_poll=600
polled=0

while [ "$polled" -lt "$max_poll" ]; do
	sleep 15
	polled=$((polled + 15))

	# Get status of all runs for this commit
	run_data=$(gh run list "${repo_flag[@]}" --branch "$branch" --commit "$commit" \
		--json name,status,conclusion 2>/dev/null || true)

	if [ -z "$run_data" ]; then
		echo "post-push-ci-watch: lost contact with CI — skipping"
		exit 0
	fi

	# Count runs still in progress
	in_progress=$(echo "$run_data" | jq '[.[] | select(.status != "completed")] | length' 2>/dev/null || echo "0")
	total=$(echo "$run_data" | jq 'length' 2>/dev/null || echo "0")

	if [ "$in_progress" = "0" ]; then
		# All runs finished — check for failures
		failed_names=$(echo "$run_data" | jq -r '.[] | select(.conclusion != "success" and .conclusion != "skipped") | .name' 2>/dev/null || true)

		if [ -n "$failed_names" ]; then
			echo ""
			echo "=== CI FAILED ==="
			echo "Failed workflows:"
			while IFS= read -r name; do echo "  - $name"; done <<< "$failed_names"
			echo ""

			# Show logs from first failed run
			failed_id=$(gh run list "${repo_flag[@]}" --branch "$branch" --commit "$commit" \
				--json databaseId,conclusion \
				--jq '[.[] | select(.conclusion == "failure")] | .[0].databaseId' 2>/dev/null || true)
			if [ -n "$failed_id" ] && [ "$failed_id" != "null" ]; then
				echo "=== Logs from failed run $failed_id (last 80 lines) ==="
				gh run view "${repo_flag[@]}" "$failed_id" --log-failed 2>&1 | tail -80
			fi
			exit 1
		fi

		echo ""
		echo "CI passed — all $total workflow(s) succeeded"
		exit 0
	fi

	# Safe arithmetic: if total isn't numeric, just show in_progress count
	if [[ "$total" =~ ^[0-9]+$ ]]; then
		completed=$((total - in_progress))
		echo "CI in progress... ($completed/$total complete) [${polled}s elapsed]"
	else
		echo "CI in progress... ($in_progress runs remaining) [${polled}s elapsed]"
	fi
done

# Timed out — show final status
echo ""
echo "=== CI watch timed out after ${max_poll}s ==="
echo "Runs still in progress — check GitHub Actions manually."
gh run list "${repo_flag[@]}" --branch "$branch" --commit "$commit" \
	--json name,status,conclusion \
	--jq '.[] | "\(.name): \(.status) (\(.conclusion // "pending"))"' 2>/dev/null || true
exit 1
