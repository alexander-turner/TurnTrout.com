# Remove any images in the asset_staging directory that are not referenced in any markdown files.

GIT_ROOT=$(git rev-parse --show-toplevel)

for image_file in "$GIT_ROOT/content/asset_staging"/*; do
	# Get the basename of the file
	basename=$(basename "$image_file")


	# Check if the pattern exists in the file
	if ! grep -q "$basename" $GIT_ROOT/content/**.md; then
		echo "File '$basename' doesn't appear in any markdown files. Removing it."
		trash-put "$image_file"
	fi
done
