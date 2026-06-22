#!/bin/bash
# Strip quote callouts from website_content, run spellchecker and vale on
# the stripped copy in parallel, and clean up. Mirrors the steps in
# .github/workflows/lint-and-validate.yaml so pre-push catches typos and
# prose issues that would otherwise only fail in CI.

set -uo pipefail

GIT_ROOT=$(git rev-parse --show-toplevel)
cd "$GIT_ROOT" || exit 1

# Fail loudly when vale is missing: this gate must never silently skip prose
# checks. session-setup.sh installs vale; if it's absent, install it before
# pushing.
if ! command -v vale >/dev/null 2>&1; then
	echo "vale is not installed; the spellcheck/prose gate cannot run." >&2
	echo "Install it via 'webi vale@3' or rerun .claude/hooks/session-setup.sh." >&2
	exit 1
fi

# `mktemp -t TEMPLATE` is non-portable: macOS treats the arg as a literal
# prefix and appends random chars, so the directory name ends up containing
# the literal "XXXXXX". Pass a full template path instead — both macOS and
# Linux mktemp substitute the X's with random characters.
STRIPPED=$(mktemp -d "${TMPDIR:-/tmp}/turntrout-stripped-XXXXXX")
trap 'rm -rf "$STRIPPED"' EXIT

uv run python scripts/strip_for_spellcheck.py \
	--source-dir website_content \
	--output-dir "$STRIPPED" || exit 1

STRIP_QUOTES_CONTENT_DIR="$STRIPPED" scripts/spellcheck.sh &
SPELL_PID=$!

vale --config config/vale/.vale.ini "$STRIPPED" &
VALE_PID=$!

SPELL_RC=0
VALE_RC=0
wait "$SPELL_PID" || SPELL_RC=$?
wait "$VALE_PID" || VALE_RC=$?

if [ "$SPELL_RC" -ne 0 ] || [ "$VALE_RC" -ne 0 ]; then
	[ "$SPELL_RC" -ne 0 ] && echo "spellchecker failed (exit $SPELL_RC)" >&2
	[ "$VALE_RC" -ne 0 ] && echo "vale failed (exit $VALE_RC)" >&2
	exit 1
fi
