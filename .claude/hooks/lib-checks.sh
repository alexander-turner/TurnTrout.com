#!/bin/bash
# Shared helpers for Claude Code hook scripts

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 1

exists() { command -v "$1" &>/dev/null; }

has_script() {
  [[ -f package.json ]] || return 1
  local val
  # A jq parse failure means package.json is malformed, not that the script is
  # simply unconfigured — fail loudly instead of silently skipping checks.
  # Exit 2, matching .github/scripts/script-configured.sh's contract: >=2 means
  # "could not classify", distinct from 1 = "not configured".
  if ! val=$(jq -r --arg name "$1" '.scripts[$name] // empty' package.json 2>&1); then
    echo "ERROR: package.json is not valid JSON, cannot check for script \"$1\": $val" >&2
    exit 2
  fi
  [[ -n "$val" && "$val" != *"ERROR: Configure"* ]]
}
