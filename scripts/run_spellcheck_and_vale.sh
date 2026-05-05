#!/bin/bash
# Strip quote callouts from website_content, run spellchecker and vale on
# the stripped copy in parallel, and clean up. Mirrors the steps in
# .github/workflows/lint-and-validate.yaml so pre-push catches typos and
# prose issues that would otherwise only fail in CI.

set -uo pipefail

GIT_ROOT=$(git rev-parse --show-toplevel)
cd "$GIT_ROOT" || exit 1

STRIPPED=$(mktemp -d -t turntrout-stripped-XXXXXX)
trap 'rm -rf "$STRIPPED"' EXIT

uv run python scripts/strip_quotes.py \
	--source-dir website_content \
	--output-dir "$STRIPPED" || exit 1

pnpm exec spellchecker \
	--no-suggestions \
	--quiet \
	--dictionaries config/spellcheck/.wordlist.txt \
	--files "$STRIPPED/**/*.md" \
	--ignore '(?=.{10,})[\da-zA-Z]+(\-[\da-zA-Z]+)+' \
	--plugins spell indefinite-article repeated-words syntax-urls frontmatter &
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
