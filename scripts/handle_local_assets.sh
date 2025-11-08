#!/bin/bash

set -e # Exit immediately if a command exits with a non-zero status

GIT_ROOT=$(git rev-parse --show-toplevel)
cd "$GIT_ROOT" || exit

cleanup() {
    find "$GIT_ROOT" -type f -name "*_temp.*" -delete
}

trap cleanup EXIT

STATIC_DIR="$GIT_ROOT"/quartz/static
IGNORE_FILES=(favicon.svg favicon.ico pond.mov pond.webm pond_frame.avif)

bash "$GIT_ROOT"/scripts/remove_unreferenced_assets.sh
# If asset_staging isn't empty
if [ -n "$(ls -A "$GIT_ROOT"/website_content/asset_staging)" ]; then

    # Update references
    find "$GIT_ROOT"/website_content/asset_staging -type f -print0 | while IFS= read -r -d '' FILE; do
        NAME=$(basename "$FILE")
        echo "$NAME"
        sed -i ''.bak -E "s|${NAME}|static/images/posts/${NAME}|g" "$GIT_ROOT"/website_content/**{,/*}.md
    done

    mv "$GIT_ROOT"/website_content/asset_staging/* "$STATIC_DIR"/images/posts 
fi

# Convert images to AVIF format, mp4s to webm/HEVC, and remove metadata
python "$GIT_ROOT"/scripts/convert_assets.py --strip-metadata --asset-directory "$STATIC_DIR" --ignore-files "example_com.png" "${IGNORE_FILES[@]}" --remove-originals

# Left over original files
cleanup

# Convert card images in markdown files
python "$GIT_ROOT"/scripts/convert_markdown_yaml.py --markdown-directory "$GIT_ROOT"/website_content

# Upload assets to R2 bucket (ignore pond files - they're needed locally for tests)
LOCAL_ASSET_DIR="$GIT_ROOT"/../website-media-r2/
python "$GIT_ROOT"/scripts/r2_upload.py --move-to-dir "$LOCAL_ASSET_DIR" --references-dir "$GIT_ROOT"/website_content --upload-from-directory "$STATIC_DIR" --ignore-files "${IGNORE_FILES[@]}" 

# Commit changes to the moved-to local dir
# (NOTE will also commit current changes)
cd "$LOCAL_ASSET_DIR" || exit
if [ "$(git status --porcelain | wc -l)" -gt 0 ]; then
    git add -A
    git commit -m "chore: added assets which were transferred from main repo"
fi
cd - || exit
