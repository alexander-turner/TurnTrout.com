#!/bin/bash
# Validates Claude Code skills have required YAML frontmatter with description
# Usage: lint-skills.sh [files...]

set -euo pipefail

errors=0

for file in "$@"; do
  # Skip if not a skills file
  [[ "$file" != *".claude/skills/"* ]] && continue

  # Check for YAML frontmatter
  if ! head -1 "$file" | grep -q '^---$'; then
    echo "ERROR: $file missing YAML frontmatter (must start with ---)" >&2
    errors=$((errors + 1))
    continue
  fi

  # Check frontmatter has description field
  # Extract content between first --- and second ---
  frontmatter=$(sed -n '1,/^---$/{ /^---$/d; p; }' "$file" | sed '1d')

  if ! echo "$frontmatter" | grep -q '^description:'; then
    echo "ERROR: $file missing 'description:' in frontmatter" >&2
    errors=$((errors + 1))
  fi
done

exit $errors
