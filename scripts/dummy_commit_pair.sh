#!/usr/bin/env bash

set -euo pipefail

TARGET_FILE="README.md"
DUMMY_COMMENT="<!-- dummy commit $(date +%s) -->"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Error: Not in a git repository"
    exit 1
fi

if [ ! -f "$TARGET_FILE" ]; then
    echo "Error: $TARGET_FILE does not exist"
    exit 1
fi

# Add a dummy comment
echo "$DUMMY_COMMENT" >> "$TARGET_FILE"
git add "$TARGET_FILE"
git commit -m "chore: trigger GitHub Actions (add dummy comment)"
git push --force

# Revert the previous commit
git revert --no-edit HEAD
git push --force

# Reset the lostpixel-bisect branch to before the dummy commits
git checkout lostpixel-bisect && git reset --hard HEAD~2 && git push --force