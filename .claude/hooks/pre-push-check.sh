#!/bin/bash
# Pre-push/PR hook: Runs unique pre-push checks not covered by CI.
# These auto-fix code (ESLint --fix, docformatter --in-place, stylelint --fix)
# and handle local-only tasks (asset compression/upload, alt-text scanning).

set -uo pipefail

GIT_ROOT=$(git rev-parse --show-toplevel)
uv run python "$GIT_ROOT/scripts/run_push_checks.py"
