#!/usr/bin/env bash
# Non-interactive spellcheck for CI/hooks
# Pass any additional arguments to spellchecker (e.g., --generate-dictionary)
set -e

SLUG_REGEX='(?=.{10,})[\da-zA-Z]+(\-[\da-zA-Z]+)+'
CONTENT_DIR="${STRIP_QUOTES_CONTENT_DIR:-website_content}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Expand the canonical wordlist with auto-generated possessive variants
# so adding e.g. "KaTeX" also accepts "KaTeX's" / "KaTeX’s".
AUGMENTED_DICT="$(mktemp -t wordlist-augmented.XXXXXX)"
trap 'rm -f "$AUGMENTED_DICT"' EXIT
"$SCRIPT_DIR/augment_spellcheck_wordlist.sh" \
  config/spellcheck/.wordlist.txt >"$AUGMENTED_DICT"

pnpm exec spellchecker \
  --no-suggestions \
  --quiet \
  --dictionaries "$AUGMENTED_DICT" \
  --files "$CONTENT_DIR/**/*.md" \
  --ignore "$SLUG_REGEX" \
  --plugins spell indefinite-article repeated-words syntax-urls frontmatter \
  "$@"
