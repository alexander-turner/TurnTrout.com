#!/usr/bin/env bash
# Non-interactive spellcheck for CI/hooks
# Pass any additional arguments to spellchecker (e.g., --generate-dictionary)
set -e

SLUG_REGEX='(?=.{10,})[\da-zA-Z]+(\-[\da-zA-Z]+)+'

pnpm exec spellchecker \
  --no-suggestions \
  --quiet \
  --dictionaries config/spellcheck/.wordlist.txt \
  --files 'website_content/**/*.md' \
  --ignore "$SLUG_REGEX" \
  --plugins spell indefinite-article repeated-words syntax-urls frontmatter \
  "$@"
