#!/bin/bash
# Pre-push/PR hook: Runs unique pre-push checks not covered by CI.
# These auto-fix code (ESLint --fix, docformatter --in-place, stylelint --fix)
# and handle local-only tasks (asset compression/upload, alt-text scanning).
# Also checks DeepSource for issues when CLI and auth are available.

set -uo pipefail

GIT_ROOT=$(git rev-parse --show-toplevel)
uv run python "$GIT_ROOT/scripts/run_push_checks.py"

# Check DeepSource for issues on the default branch
if command -v deepsource &>/dev/null && [ -n "${DEEPSOURCE_PAT:-}" ]; then
  echo "Checking DeepSource for issues..."
  # Query critical/major issues on the default branch
  issues_json=$(deepsource issues --default-branch --severity critical --output json 2>/dev/null) || true
  if [ -n "$issues_json" ]; then
    issue_count=$(echo "$issues_json" | jq 'length' 2>/dev/null || echo "0")
    if [ "$issue_count" -gt 0 ]; then
      echo "⚠ DeepSource reports $issue_count critical issue(s) on the default branch"
      deepsource issues --default-branch --severity critical 2>/dev/null || true
    else
      echo "✓ No critical DeepSource issues"
    fi
  fi
fi
