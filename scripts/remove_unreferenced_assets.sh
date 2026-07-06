#!/bin/bash

# Remove any images in the asset_staging directory that are not referenced in any markdown files.

set -euo pipefail

GIT_ROOT=$(git rev-parse --show-toplevel)
STAGING_DIR="$GIT_ROOT/website_content/asset_staging"

[ -d "$STAGING_DIR" ] || exit 0

# Use find to properly handle the file listing
find "$STAGING_DIR" -type f | while read -r image_file; do
    # Get the basename of the file
    basename=$(basename "$image_file")

    # grep exit codes: 0 = found, 1 = found in no file, >=2 = error. -F treats
    # the basename as a literal so dots aren't regex wildcards. Only trash on a
    # definitive "not found" (1); a read error (>=2) must not delete the file.
    status=0
    grep -rqF --include="*.md" -- "$basename" "$GIT_ROOT/website_content" ||
        status=$?
    if [ "$status" -eq 1 ]; then
        echo "File '$basename' doesn't appear in any markdown files. Removing it."
        trash-put "$image_file"
    elif [ "$status" -gt 1 ]; then
        echo "grep failed (exit $status) while checking '$basename'; leaving it in place." >&2
    fi
done
