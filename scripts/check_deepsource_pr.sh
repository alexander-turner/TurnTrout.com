#!/usr/bin/env bash
# Block pushes when DeepSource has outstanding findings on the current
# branch's open PR. Requires `deepsource`, `gh`, and `jq` to be on PATH
# (installed by the SessionStart hook). Exits 0 cleanly when no open PR
# exists for the branch yet (first push). DeepSource analyzes commits
# asynchronously, so this only sees findings from the previously-pushed
# HEAD — its job is to stop the author from piling more commits onto a
# PR that already has unaddressed issues.

set -euo pipefail

branch=$(git rev-parse --abbrev-ref HEAD)
pr_number=$(gh pr list --head "$branch" --state open --json number \
  --jq '.[0].number // ""' 2>/dev/null || true)

if [ -z "$pr_number" ]; then
  echo "No open PR for branch $branch; skipping deepsource check."
  exit 0
fi

issues_json=$(deepsource issues --pr "$pr_number" --output json 2>/dev/null || echo "[]")
count=$(echo "$issues_json" | jq 'length')

if [ "$count" -gt 0 ]; then
  echo "DeepSource has $count outstanding issue(s) on PR #$pr_number:"
  echo "$issues_json" | jq -r '.[] | "  \(.path):\(.begin_line) [\(.issue_code)] \(.title)"'
  echo
  echo "Fix the findings (or document false-positive suppressions) before pushing more commits."
  exit 1
fi

echo "DeepSource clean on PR #$pr_number."
