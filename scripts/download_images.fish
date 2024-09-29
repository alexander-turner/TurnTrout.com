# We want to host all images locally
function download_image
    set -l url $argv[1]
    set -l filename (basename $url)
    set -l target_dir $argv[2]

    echo "Downloading: $url to $target_dir"

    # Use curl for downloading, -s for silent mode, -f for fail on error
    curl -s -f -o "$target_dir/$filename" $url or begin echo "Error downloading $url" >&2 end
end

# --- Main Logic ---

function main --description 'Download images from Markdown files and replace URLs'
    set -l markdown_files $argv
    set -l images_dir quartz/static/images/posts
    set -l target_dir static/images/posts

    # 1. Find all image URLs in Markdown files
    set -l image_urls (command grep -oE --no-filename 'http[^\)]*?\.(jpe?g|png|webp)' $markdown_files)

    # Add in mp4 files which don't start with https://assets.turntrout
    set -l mp4_regex 'http[^\)]*?\.mp4'
    set -l mp4_urls (command grep -oE $mp4_regex $markdown_files | grep -v '^https://assets\.turntrout')
    echo $mp4_urls
    set -l --append asset_urls $mp4_urls

    # 2. Download each asset
    for url in $asset_urls
        download_asset $url $asset_dir

        set -l escaped_url (echo $url | sed 's|[/\\.^$\[\]]|\\&|g')
        echo "Escaped URL: $escaped_url"
        sed -i ''.bak "s|$escaped_url|/$target_dir/$(basename $url)|g" $markdown_files
    end

    set -l cloud_regex 'https://res\.cloudinary\.com/lesswrong-2-0/image/[^\)]*'
    set -l cloudinary_urls (command grep -oE --no-filename $cloud_regex $markdown_files)

    for url in $cloudinary_urls
        download_asset $url $asset_dir
        # Mv the asset so it has a webp extension
        mv $asset_dir/$(basename $url){,.webp}

        set -l escaped_url (echo $url | sed 's|[/\\.^$\[\]]|\\&|g')
        # These are webp so make the extension explicit
        sed -i ''.bak "s|$escaped_url|/$target_dir/$(basename $url).webp|g" $markdown_files
    end

    echo "Asset download and replacement complete!"
end

main $argv
