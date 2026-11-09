#!/bin/bash
# Shared helpers for Claude Code hook scripts

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || exit 1

exists() { command -v "$1" &>/dev/null; }

# Resolved beside this library, not under the project root: template-sync ships
# .claude/ and .github/scripts/ together. Parameter expansion, not `dirname`, so
# a caller with a bare PATH can still source this file.
_SCRIPT_CONFIGURED="${BASH_SOURCE[0]%/*}/../../.github/scripts/script-configured.sh"

# has_script NAME — is the package.json script NAME configured? Asks
# script-configured.sh, the one definition of that predicate. A status of 2 or
# more means "could not classify", so it EXITS 2 rather than returning: read as
# "not configured", it would skip real pre-push checks in silence.
has_script() {
<<<<<<< local
  [[ -f package.json ]] || return 1
  jq -e ".scripts.$1" package.json &>/dev/null &&
    ! jq -r ".scripts.$1" package.json | grep -q "ERROR: Configure"
=======
  if [[ ! -f "$_SCRIPT_CONFIGURED" ]]; then
    echo "ERROR: lib-checks.sh: has_script needs $_SCRIPT_CONFIGURED, which is missing" >&2
    exit 2
  fi
  local rc=0
  # $BASH, not `bash`: the interpreter already running, so no PATH lookup.
  "$BASH" "$_SCRIPT_CONFIGURED" "$1" || rc=$?
  ((rc >= 2)) && exit 2
  return "$rc"
>>>>>>> template
}
