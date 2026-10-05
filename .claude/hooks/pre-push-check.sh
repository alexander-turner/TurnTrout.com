#!/bin/bash
# Pre-push/PR hook: Runs unique pre-push checks not covered by CI.
# These auto-fix code (ESLint --fix, docformatter --in-place, stylelint --fix)
# and handle local-only tasks (asset compression/upload, alt-text scanning).
# Also checks DeepSource for issues when CLI and auth are available.

set -uo pipefail

<<<<<<< local
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
=======
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib-checks.sh
source "$HOOK_DIR/lib-checks.sh"

FAILED=0

run_check() {
  local name="$1"
  shift
  local output
  if ! output=$("$@" 2>&1); then
    echo "=== $name FAILED ===" >&2
    echo "$output" >&2
    FAILED=1
  fi
}

# Node.js checks
if [[ -f package.json ]] && ! exists jq; then
  echo "=== node scripts FAILED ===" >&2
  echo "jq is required to detect which package.json scripts are configured, but is not installed." >&2
  FAILED=1
else
  has_script build && run_check "build" pnpm build
  has_script lint && run_check "lint" pnpm lint
  has_script check && run_check "typecheck" pnpm check
  has_script test && run_check "tests" pnpm test
fi

# Python checks
if [[ -f pyproject.toml ]] || [[ -f uv.lock ]]; then
  if [[ -f uv.lock ]] && exists uv; then
    run_check "ruff" uv run ruff check .
  elif exists ruff; then
    run_check "ruff" ruff check .
  else
    echo "=== ruff FAILED ===" >&2
    echo "Neither ruff nor uv (with uv.lock) is available to run Python checks." >&2
    FAILED=1
  fi
>>>>>>> template
fi
