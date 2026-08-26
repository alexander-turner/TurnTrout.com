#!/bin/bash
# Pre-push/PR hook: Runs unique pre-push checks not covered by CI.
# These auto-fix code (ESLint --fix, docformatter --in-place, stylelint --fix)
# and handle local-only tasks (asset compression/upload, alt-text scanning).
# Also checks DeepSource for issues when CLI and auth are available.

set -uo pipefail

GIT_ROOT=$(git rev-parse --show-toplevel)
uv run python "$GIT_ROOT/scripts/run_push_checks.py"

# Check DeepSource for all issues on the default branch
if command -v deepsource &>/dev/null && [ -n "${DEEPSOURCE_PAT:-}" ]; then
  echo "Checking DeepSource for issues..."
  issues_json=$(deepsource issues --default-branch --output json 2>/dev/null) || true
  if [ -n "$issues_json" ]; then
    issue_count=$(echo "$issues_json" | jq 'length' 2>/dev/null || echo "0")
    if [ "$issue_count" -gt 0 ]; then
      echo "DeepSource reports $issue_count issue(s) on the default branch:"
      deepsource issues --default-branch 2>/dev/null || true
      exit 1
    else
      echo "✓ No DeepSource issues"
    fi
  fi
fi
