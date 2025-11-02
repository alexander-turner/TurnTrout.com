#!/usr/bin/env fish

# Get the git root directory
set -l GIT_ROOT (git rev-parse --show-toplevel)
cd $GIT_ROOT; or exit

# Check if URL arguments are provided
if test (count $argv) -eq 0
    echo "Usage: $0 <favicon_url> [favicon_url ...]"
    echo "   Or: $0 --color <white|black|#hexcolor> <favicon_url> [favicon_url ...]"
    echo "Example: $0 https://assets.turntrout.com/static/images/external-favicons/lesswrong_com.avif"
    echo "Example: $0 --color black https://assets.turntrout.com/static/images/external-favicons/gwern_net.avif"
    echo "Example: $0 --color \"#333333\" https://assets.turntrout.com/static/images/external-favicons/obsidian_md.avif"
    exit 1
end

# Parse color argument if present
set -l BG_COLOR white
set -l URLS $argv

if test "$argv[1]" = "--color"
    if test (count $argv) -lt 3
        echo "Error: --color requires a color argument (white, black, or hex color like #333333)"
        exit 1
    end
    set BG_COLOR $argv[2]
    set URLS $argv[3..]
end

# Process each URL
for FAVICON_URL in $URLS
    # Extract the path from the URL (everything after assets.turntrout.com/)
    # Remove https://assets.turntrout.com/ or http://assets.turntrout.com/
    set -l PATH_FROM_URL (echo $FAVICON_URL | sed -E 's|https?://assets\.turntrout\.com/||')

    # Construct local paths
    set -l LOCAL_INPUT_PATH "$GIT_ROOT/quartz/$PATH_FROM_URL"
    set -l LOCAL_OUTPUT_PATH (echo $LOCAL_INPUT_PATH | sed 's/\.avif$/_transparent.avif/')

    # Check if input file exists locally, if not download it
    if not test -f $LOCAL_INPUT_PATH
        echo "Downloading $FAVICON_URL..."
        mkdir -p (dirname $LOCAL_INPUT_PATH)
        curl -s -o $LOCAL_INPUT_PATH $FAVICON_URL; or begin
            echo "Error: Failed to download $FAVICON_URL"
            exit 1
        end
    end

    # Check if ImageMagick is available
    set -l MAGICK_CMD
    if command -v magick > /dev/null 2>&1
        set MAGICK_CMD magick
    else if command -v convert > /dev/null 2>&1
        set MAGICK_CMD convert
    else
        echo "Error: ImageMagick (magick or convert) not found. Please install ImageMagick."
        exit 1
    end

    # Remove background and make it transparent
    echo "Removing $BG_COLOR background from $LOCAL_INPUT_PATH..."
    $MAGICK_CMD $LOCAL_INPUT_PATH -fuzz 10% -transparent $BG_COLOR $LOCAL_OUTPUT_PATH; or begin
        echo "Error: Failed to process image"
        exit 1
    end

    echo "Created transparent version: $LOCAL_OUTPUT_PATH"

    # Upload using r2_upload.py
    echo "Uploading to R2..."
    python $GIT_ROOT/scripts/r2_upload.py $LOCAL_OUTPUT_PATH --move-to-dir $GIT_ROOT/../website-media-r2 --overwrite-existing; or begin
        echo "Error: Failed to upload to R2"
        exit 1
    end

    set -l OUTPUT_URL (echo $PATH_FROM_URL | sed 's/\.avif$/_transparent.avif/')
    echo "Success! Transparent favicon uploaded to: https://assets.turntrout.com/$OUTPUT_URL"
end

