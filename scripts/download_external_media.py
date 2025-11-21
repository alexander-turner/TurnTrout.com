"""
Download external media files to asset_staging directory.

This script scans markdown files for external media URLs (excluding those
already on assets.turntrout.com), downloads them to the asset_staging directory,
and updates the markdown references to point to the local staging directory.
"""

import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Sequence

try:
    from . import utils as script_utils
except ImportError:
    import utils as script_utils  # type: ignore


MEDIA_EXTENSIONS = (
    "jpg",
    "jpeg",
    "png",
    "gif",
    "mov",
    "mp4",
    "ico",
    "webm",
    "avi",
    "mpeg",
    "webp",
    "avif",
    "svg",
    "mp3",
    "m4a",
    "wav",
    "ogg",
)

EXCLUDED_DOMAIN = "assets.turntrout.com"


def download_media(url: str, target_dir: Path) -> bool:
    """
    Download media file from URL to target directory.

    Args:
        url: URL of the media file to download
        target_dir: Directory to save the downloaded file

    Returns:
        True if download succeeded, False otherwise
    """
    filename = os.path.basename(url)
    target_path = target_dir / filename

    print(f"Downloading: {url} to {target_path}")

    curl_command: Sequence[str] = [
        "curl",
        "-L",  # Follow redirects
        "-o",
        str(target_path),  # Output file
        "--retry",
        "5",  # Retry up to 5 times
        "--retry-delay",
        "1",  # Start with a 1 second delay, doubles for each retry
        "--retry-max-time",
        "60",  # Maximum time for retries
        "-s",  # Silent mode
        "-S",  # Show error messages
        url,
    ]

    try:
        subprocess.run(curl_command, check=True, stderr=subprocess.PIPE)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error downloading {url}: {e.stderr.decode()}", file=sys.stderr)
        return False


def replace_url_in_file(file_path: Path, old_url: str, new_url: str) -> None:
    """Replace URL in a markdown file."""
    git_root = script_utils.get_git_root()
    content_dir = git_root / "website_content"
    if not file_path.resolve().is_relative_to(content_dir):
        raise ValueError(
            f"File path {file_path} is not in the website_content directory."
        )

    with open(file_path, encoding="utf-8") as f:
        content = f.read()

    new_content = content.replace(old_url, new_url)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)


def find_external_media_urls(markdown_files: list[Path]) -> set[str]:
    """
    Find all external media URLs in markdown files, excluding CDN URLs.

    Args:
        markdown_files: List of markdown file paths to scan

    Returns:
        Set of external media URLs (excluding assets.turntrout.com)
    """
    asset_urls: set[str] = set()
    # Create pattern that matches URLs ending with any of our media extensions
    # Use word boundary \b to ensure we match complete extensions (e.g., "avif" not "avi")
    extensions_pattern = "|".join(MEDIA_EXTENSIONS)
    url_pattern = rf"https?://[^\s\)\"]+\.(?:{extensions_pattern})\b"

    for file in markdown_files:
        with open(file, encoding="utf-8") as f:
            content = f.read()
            urls = re.findall(url_pattern, content, re.IGNORECASE)
            external_urls = {url for url in urls if EXCLUDED_DOMAIN not in url}
            asset_urls.update(external_urls)

    return asset_urls


def main(markdown_directory: Path | None = None) -> None:
    """
    Download external media files to asset_staging and update references.

    Args:
        markdown_directory: Directory containing markdown files.
                          Defaults to website_content in git root.
    """
    git_root = script_utils.get_git_root()

    if markdown_directory is None:
        markdown_directory = git_root / "website_content"

    # Find all markdown files
    markdown_files = list(markdown_directory.rglob("*.md"))

    if not markdown_files:
        print("No markdown files found.")
        return

    # Find all external media URLs (excluding CDN)
    asset_urls = find_external_media_urls(markdown_files)

    if not asset_urls:
        print("No external media URLs found.")
        return

    print(f"Found {len(asset_urls)} external media URLs to download.")

    # Create asset_staging directory
    asset_staging_dir = git_root / "website_content" / "asset_staging"
    os.makedirs(asset_staging_dir, exist_ok=True)

    # Download each media file and update references
    successful_downloads = 0
    for url in asset_urls:
        if download_media(url, asset_staging_dir):
            filename = os.path.basename(url)
            new_url = f"asset_staging/{filename}"

            # Update references in all markdown files
            for file in markdown_files:
                replace_url_in_file(file, url, new_url)

            successful_downloads += 1

    print(
        f"Successfully downloaded {successful_downloads}/{len(asset_urls)} files to asset_staging."
    )


if __name__ == "__main__":
    if len(sys.argv) > 1:
        markdown_dir = Path(sys.argv[1])
        main(markdown_dir)
    else:
        main()
