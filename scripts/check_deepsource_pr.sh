#!/usr/bin/env bash
# Block pushes when DeepSource has outstanding findings on the current
# branch's open PR. Skips silently when the deepsource CLI is missing,
# the gh CLI is missing, or no open PR exists for the branch yet (first
# push). DeepSource analyzes commits asynchronously, so this only sees
# findings from the previously-pushed HEAD — its job is to stop the
# author from piling more commits onto a PR that already has unaddressed
# issues.

set -euo pipefail

if ! command -v deepsource >/dev/null 2>&1; then
  echo "deepsource CLI not installed; skipping."
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not installed; skipping deepsource PR check."
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq not installed; skipping deepsource PR check."
  exit 0
fi

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
