#!/bin/bash
# Pre-push/PR hook: Runs configured checks before pushing or creating PRs
# Only runs scripts that exist and are properly configured in package.json

set -uo pipefail

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib-checks.sh
source "$HOOK_DIR/lib-checks.sh"

FAILED=0

run_check() {
  local name="$1" cmd="$2"
  echo "=== $name ===" >&2
  if ! $cmd 2>&1; then
    echo "$name FAILED" >&2
    FAILED=1
  fi
}

echo "=== PRE-PR CHECKS ===" >&2

# Node.js checks (tests intentionally omitted — they run in CI and the stop hook)
has_script build && run_check "build" "pnpm build"
has_script lint && run_check "lint" "pnpm lint"
has_script check && run_check "typecheck" "pnpm check"

# Python checks
if [[ -f pyproject.toml ]] || [[ -f uv.lock ]]; then
  PREFIX=""
  [[ -f uv.lock ]] && exists uv && PREFIX="uv run "

  { exists ruff || [[ -n "$PREFIX" ]]; } && run_check "ruff" "${PREFIX}ruff check ."
fi

exit $FAILED
