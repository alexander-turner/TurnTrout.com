#!/bin/bash
# Shared helpers for Claude Code hook scripts

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 1

exists() { command -v "$1" &>/dev/null; }

has_script() {
  [[ -f package.json ]] || return 1
<<<<<<< local
  jq -e ".scripts.$1" package.json &>/dev/null &&
    ! jq -r ".scripts.$1" package.json | grep -q "ERROR: Configure"
=======
  local val
  # A jq parse failure means package.json is malformed, not that the script is
  # simply unconfigured — fail loudly instead of silently skipping checks.
  if ! val=$(jq -r --arg name "$1" '.scripts[$name] // empty' package.json 2>&1); then
    echo "ERROR: package.json is not valid JSON, cannot check for script \"$1\": $val" >&2
    exit 1
  fi
  [[ -n "$val" && "$val" != *"ERROR: Configure"* ]]
>>>>>>> template
}
