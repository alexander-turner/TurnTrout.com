#!/usr/bin/env bash
# Emit the canonical wordlist plus auto-generated possessive variants.
#
# Why this exists: spellchecker-cli's retext-spell plugin does not
# auto-accept possessive forms for entries in a custom dictionary, so
# adding "KaTeX" to .wordlist.txt still flags "KaTeX's". Rather than
# hand-maintaining a possessive for every proper noun, we expand them
# here at runtime.
#
# Usage: augment_spellcheck_wordlist.sh [path-to-wordlist]
#   - Default path: config/spellcheck/.wordlist.txt (relative to CWD)
#   - Output: augmented wordlist on stdout
set -euo pipefail

WORDLIST="${1:-config/spellcheck/.wordlist.txt}"

# For each non-empty, non-comment line that does NOT already end in 's
# (straight or curly apostrophe), emit the original word plus "word's"
# and "word’s" variants. Rendered HTML uses curly apostrophes after the
# smart-quotes transformer; source Markdown may use either.
awk '
  /^[[:space:]]*$/ { print; next }
  /^[[:space:]]*#/ { print; next }
  /'\''s$/         { print; next }
  /’s$/            { print; next }
  { print; print $0 "'\''s"; print $0 "’s" }
' "$WORDLIST"
