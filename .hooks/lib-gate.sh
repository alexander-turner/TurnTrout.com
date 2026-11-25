#!/bin/bash
# Shared helpers for the git hooks in .hooks/.
#
# A gate that cannot run its tool must FAIL the git operation, not silently
# exit 0 — a silent skip lets unchecked work reach the branch with no signal
# that anything was bypassed. Sourced (not executed), so gate_die_missing_tool
# exits the calling hook.

# gate_die_missing_tool <hook-name> <tool> <install-hint>: loud stderr + exit 1.
gate_die_missing_tool() {
  local hook=$1 tool=$2 hint=$3
  echo "$hook: required tool '$tool' not found — REFUSING to continue rather than skip its checks." >&2
  echo "$hook: $hint" >&2
  exit 1
}

# gate_path_add_venv <git-root>: put the project's .venv/bin first on PATH. Git
# hooks run in a bare shell that never sourced the session's PATH edits, so the
# Python tools uv installed there are otherwise missing.
gate_path_add_venv() {
  if [[ -d "$1/.venv/bin" ]]; then
    export PATH="$1/.venv/bin:$PATH"
  fi
}
