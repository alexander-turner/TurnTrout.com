set -e # Exit immediately if a command exits with a non-zero status

GIT_ROOT=$(git rev-parse --show-toplevel)
cd "$GIT_ROOT"

cleanup() {
  find "$GIT_ROOT" -type f -name "*_temp.*" -delete
  find "$STATIC_DIR" -name "*.*_original" -delete
}

trap cleanup EXIT

# Check that conversion+uploading tests pass
PY_TEST_DIR="$GIT_ROOT"/scripts/tests
python -m pytest "$PY_TEST_DIR"

STATIC_DIR="$GIT_ROOT"/quartz/static
# If asset_staging isn't empty
if [ -n "$(ls -A "$GIT_ROOT"/content/asset_staging)" ]; then
  sh "$GIT_ROOT"/scripts/remove_unreferenced_assets.sh

  # Update references in the content
  find "$GIT_ROOT"/content/asset_staging -type f -print0 | while IFS= read -r -d '' FILE; do
    NAME=$(basename "$FILE")
    echo "$NAME"
    sed -i ''.bak -E "s|${NAME}|static/images/posts/${NAME}|g" "$GIT_ROOT"/content/**{,/*}.md
  done

  # Ignore errors due to asset_staging being empty
  mv "$GIT_ROOT"/content/asset_staging/* "$STATIC_DIR"/images/posts 2>/dev/null || true
fi

# Convert images to AVIF format, mp4s to webm, and remove metadata
python "$GIT_ROOT"/scripts/convert_assets.py --remove-originals --strip-metadata --asset-directory "$STATIC_DIR" --ignore-files "example_com.png"

# Left over original files
cleanup

# Convert card images in markdown files
python "$GIT_ROOT"/scripts/convert_markdown_yaml.py --markdown-directory "$GIT_ROOT"/content

# Upload assets to R2 bucket
LOCAL_ASSET_DIR="$GIT_ROOT"/../website-media-r2/static
python "$GIT_ROOT"/scripts/r2_upload.py --move-to-dir "$LOCAL_ASSET_DIR" --references-dir "$GIT_ROOT"/content --upload-from-directory "$STATIC_DIR"

# Commit changes to the moved-to local dir
# (NOTE will also commit current changes)
cd "$LOCAL_ASSET_DIR"
if [ "$(git status --porcelain | wc -l)" -gt 0 ]; then
  git add -A
  git commit -m "Added assets which were transferred from the main repo."
fi
cd -
