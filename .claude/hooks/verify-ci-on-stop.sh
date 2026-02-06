#!/bin/bash
# Stop hook: Verifies CI checks pass before allowing Claude to complete
# Returns decision=block with reason to make Claude continue fixing issues

set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 1

FAILURES=""
OUTPUT=""

# Helpers
exists() { command -v "$1" &>/dev/null; }

run_check() {
    local name="$1" cmd="$2"
    echo "Running $name..." >&2
    local result
    if result=$($cmd 2>&1); then
        return 0
    else
        FAILURES="${FAILURES}$name failed. "
        OUTPUT="${OUTPUT}=== $name ===\n${result}\n\n"
        return 1
    fi
}

has_script() {
    [[ -f package.json ]] && \
    jq -e ".scripts.$1" package.json &>/dev/null && \
    ! jq -r ".scripts.$1" package.json | grep -q "ERROR: Configure"
}

# Node.js checks
has_script test && run_check "tests" "pnpm test"
has_script lint && run_check "lint" "pnpm lint"
has_script check && run_check "typecheck" "pnpm check"

# Python checks (use uv run if uv.lock exists)
if [[ -f pyproject.toml ]] || [[ -f uv.lock ]]; then
    PREFIX=""
    [[ -f uv.lock ]] && exists uv && PREFIX="uv run "

    exists ruff || [[ -n "$PREFIX" ]] && run_check "ruff" "${PREFIX}ruff check ."
    [[ -d tests ]] && { exists pytest || [[ -n "$PREFIX" ]]; } && run_check "pytest" "${PREFIX}pytest"
fi

# Return result
if [[ -n "$FAILURES" ]]; then
    jq -n --arg f "$FAILURES" --arg o "$OUTPUT" \
        '{decision:"block", reason:("CI failed: "+$f+"\n\n"+$o)}'
else
    echo '{"decision":"approve"}'
fi
