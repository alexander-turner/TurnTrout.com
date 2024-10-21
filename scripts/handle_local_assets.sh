set -e # Exit immediately if a command exits with a non-zero status

GIT_ROOT=$(git rev-parse --show-toplevel)
cd "$GIT_ROOT"

# # Check that conversion+uploading tests pass
PY_TEST_DIR="$GIT_ROOT"/scripts/tests
python -m pytest "$PY_TEST_DIR" --ignore="$PY_TEST_DIR"/test_md_processing.py

STATIC_DIR="$GIT_ROOT"/quartz/static
# If asset_staging isn't empty
if [ -n "$(ls -A "$GIT_ROOT"/content/asset_staging)" ]; then
  sh "$GIT_ROOT"/scripts/remove_unreferenced_assets.sh

  # Update references in the content
  FILES_TO_MOVE=$(ls "$GIT_ROOT"/content/asset_staging)
  for FILE in $FILES_TO_MOVE; do
    NAME=$(basename "$FILE")
    sed -i ''.bak -E "s|$NAME|static/images/posts/$NAME|g" "$GIT_ROOT"/content/**.md
  done

  # Ignore errors due to asset_staging being empty
  mv "$GIT_ROOT"/content/asset_staging/* "$STATIC_DIR"/images/posts 2>/dev/null || true
fi

# Convert images to AVIF format, mp4s to webm, and remove metadata
# Ignore example_com.png during conversion
python "$GIT_ROOT"/scripts/convert_assets.py --remove-originals --strip-metadata --asset-directory "$STATIC_DIR" --ignore-files "example_com.png"

# Convert card images in markdown files
python "$GIT_ROOT"/scripts/convert_markdown_yaml.py --markdown-directory "$GIT_ROOT"/content

# Remove any mp4_original files
find "$STATIC_DIR" -name "*.mp4_original" -delete

# Upload assets to R2 bucket
LOCAL_ASSET_DIR="$GIT_ROOT"/../website-media-r2/static
python "$GIT_ROOT"/scripts/r2_upload.py --move-to-dir "$LOCAL_ASSET_DIR" --replacement-dir "$GIT_ROOT"/content --all-asset-dir "$STATIC_DIR"

# Commit changes to the moved-to local dir
# (NOTE will also commit current changes)
cd "$LOCAL_ASSET_DIR"
if [ "$(git status --porcelain | wc -l)" -gt 0 ]; then
  git add -A
  git commit -m "Added assets which were transferred from the main repo."
fi
cd -
