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

    # grep -r exits 0 only if the basename appears in at least one markdown
    # file; -F treats it as a literal string so dots aren't regex wildcards.
    if ! grep -rqF --include="*.md" -- "$basename" "$GIT_ROOT/website_content"; then
        echo "File '$basename' doesn't appear in any markdown files. Removing it."
        trash-put "$image_file"
    fi
done
