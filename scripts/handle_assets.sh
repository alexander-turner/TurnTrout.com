#!/bin/bash

set -e # Exit immediately if a command exits with a non-zero status

GIT_ROOT=$(git rev-parse --show-toplevel)
cd "$GIT_ROOT" || exit

cleanup() {
    find "$GIT_ROOT" -type f -name "*_temp.*" -delete
}

trap cleanup EXIT

bash "$GIT_ROOT"/scripts/remove_unreferenced_assets.sh

# Convert card images in markdown files
uv run python "$GIT_ROOT"/scripts/convert_markdown_yaml.py --markdown-directory "$GIT_ROOT"/website_content

# Download external media files (non-assets.turntrout.com) to asset_staging
uv run python "$GIT_ROOT"/scripts/download_external_media.py

# Normalize any new SVG files added since last push TODO include downloaded? 
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
NEW_SVG_FILES=$(git diff --name-only --diff-filter=A "origin/$CURRENT_BRANCH" 2>/dev/null | grep '\.svg$' || true)

if [ -n "$NEW_SVG_FILES" ]; then
    NEW_SVGS=()
    while IFS= read -r file; do
        NEW_SVGS+=("$GIT_ROOT/$file")
    done <<< "$NEW_SVG_FILES"
    
    uv run python "$GIT_ROOT"/scripts/normalize_svg_viewbox.py "${NEW_SVGS[@]}"
fi

STATIC_DIR="$GIT_ROOT"/quartz/static

ASSET_STAGING_DIR="$GIT_ROOT"/website_content/asset_staging
# Only proceed if asset staging directory is not empty
if [ -n "$(ls -A "$ASSET_STAGING_DIR" 2>/dev/null)" ]; then
    uv run python "$GIT_ROOT"/scripts/replace_asset_staging_refs.py
    mkdir -p "$STATIC_DIR"/images/posts
    mv "$ASSET_STAGING_DIR"/* "$STATIC_DIR"/images/posts
fi

# Convert images to AVIF format, mp4s to webm/HEVC, and remove metadata
IGNORE_FILES=(favicon.svg favicon.ico pond.mov pond.webm pond_frame.avif)
uv run python "$GIT_ROOT"/scripts/convert_assets.py --strip-metadata --asset-directory "$STATIC_DIR" --ignore-files "example_com.png" "${IGNORE_FILES[@]}" --remove-originals

# Left over original files
cleanup

# Upload assets to R2 bucket (ignore pond files - they're needed locally for tests)
LOCAL_ASSET_DIR="$GIT_ROOT"/../website-media-r2/
uv run python "$GIT_ROOT"/scripts/r2_upload.py --move-to-dir "$LOCAL_ASSET_DIR" --references-dir "$GIT_ROOT"/website_content --upload-from-directory "$STATIC_DIR" --ignore-files "${IGNORE_FILES[@]}"
