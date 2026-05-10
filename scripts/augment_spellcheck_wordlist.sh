#!/usr/bin/env bash
# Emit the canonical wordlist plus auto-generated possessive and plural
# variants.
#
# Why this exists: spellchecker-cli's retext-spell plugin does not
# auto-accept possessive or simple plural forms for entries in a custom
# dictionary, so adding "KaTeX" to .wordlist.txt still flags "KaTeX's"
# and adding "API" still flags "APIs". Rather than hand-maintaining
# every variant for every proper noun and acronym, we expand them
# here at runtime.
#
# Usage: augment_spellcheck_wordlist.sh [path-to-wordlist]
#   - Default path: config/spellcheck/.wordlist.txt (relative to CWD)
#   - Output: augmented wordlist on stdout
set -euo pipefail

WORDLIST="${1:-config/spellcheck/.wordlist.txt}"

# For each non-empty, non-comment line:
#   - skip if already ends in 's or ’s (already a possessive)
#   - if it ends in s/S: emit the word plus "word's" / "word’s" possessives
#     (skip the +s plural; doubling a trailing "s" is virtually never right)
#   - else: emit the word plus "word's", "word’s", and "words" variants
# Rendered HTML uses curly apostrophes after the smart-quotes transformer;
# source Markdown may use either. Naive `+s` pluralization is good enough
# for proper nouns and acronyms; irregular forms can be added explicitly.
awk '
  /^[[:space:]]*$/ { print; next }
  /^[[:space:]]*#/ { print; next }
  /'\''s$/         { print; next }
  /’s$/            { print; next }
  /[sS]$/          { print; print $0 "'\''s"; print $0 "’s"; next }
  { print; print $0 "'\''s"; print $0 "’s"; print $0 "s" }
' "$WORDLIST"
