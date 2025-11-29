#!/bin/bash

# Remove any images in the asset_staging directory that are not referenced in any markdown files.

GIT_ROOT=$(git rev-parse --show-toplevel)

# Use find to properly handle the file listing
find "$GIT_ROOT/website_content/asset_staging" -type f | while read -r image_file; do
    # Get the basename of the file
    basename=$(basename "$image_file")

    # Use find to properly search through markdown files
    if ! find "$GIT_ROOT/website_content" -name "*.md" -type f -exec grep -q "$basename" {} \;; then
        echo "File '$basename' doesn't appear in any markdown files. Removing it."
        trash-put "$image_file"
    fi
done
