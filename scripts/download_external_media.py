"""
Download external media files to asset_staging directory.

This script scans markdown files for external media URLs (excluding those
already on assets.turntrout.com), downloads them to the asset_staging directory,
and updates the markdown references to point to the local staging directory.
"""

import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

import requests

try:
    from . import utils as script_utils
except ImportError:
    import utils as script_utils  # type: ignore

_http_session = script_utils.http_session()


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
    try:
        filename = script_utils.extract_filename_from_url(url)
    except ValueError:
        print(f"Skipping URL with no filename: {url}", file=sys.stderr)
        return False
    target_path = target_dir / filename

    print(f"Downloading: {url} to {target_path}")

    try:
        with _http_session.get(
            url, stream=True, timeout=60, allow_redirects=True
        ) as response:
            response.raise_for_status()
            with open(target_path, "wb") as out_file:
                shutil.copyfileobj(response.raw, out_file)
        return True
    except requests.RequestException as e:
        print(f"Error downloading {url}: {e}", file=sys.stderr)
        return False


def replace_url_in_file(file_path: Path, old_url: str, new_url: str) -> None:
    """Replace URL in a markdown file."""
    git_root = script_utils.get_git_root()
    content_dir = git_root / "website_content"
    if not file_path.resolve().is_relative_to(content_dir):
        raise ValueError(
            f"File path {file_path} is not in the website_content directory."
        )

    script_utils.update_markdown_file(
        file_path, lambda content: content.replace(old_url, new_url)
    )


def find_external_media_urls(markdown_files: list[Path]) -> set[str]:
    """
    Find all external media URLs in markdown files, excluding CDN URLs.

    Args:
        markdown_files: List of markdown file paths to scan

    Returns:
        Set of external media URLs (excluding assets.turntrout.com)
    """
    # Create pattern that matches URLs ending with any of our media extensions
    # Use word boundary \b to ensure we match complete extensions (e.g., "avif" not "avi")
    extensions_pattern = "|".join(MEDIA_EXTENSIONS)
    url_pattern = rf"https?://[^\s\)\"]+\.(?:{extensions_pattern})\b"

    asset_urls: set[str] = set()
    for file in markdown_files:
        with open(file, encoding="utf-8") as f:
            content = f.read()
        urls = re.findall(url_pattern, content, re.IGNORECASE)
        external_urls = {url for url in urls if EXCLUDED_DOMAIN not in url}
        asset_urls.update(external_urls)

    return asset_urls


def main() -> None:
    """Download external media files to asset_staging and update references."""
    # Kill Obsidian to prevent it from renaming downloaded files
    pkill = shutil.which("pkill")
    if pkill:
        subprocess.run([pkill, "-x", "Obsidian"], check=False)
        time.sleep(0.5)

    git_root = script_utils.get_git_root()
    markdown_directory = git_root / "website_content"

    markdown_files = list(markdown_directory.rglob("*.md"))
    if not markdown_files:
        raise ValueError("No markdown files found.")

    asset_urls = find_external_media_urls(markdown_files)

    if not asset_urls:
        print("No external media URLs found.")
        return

    print(f"Found {len(asset_urls)} external media URLs to download.")

    asset_staging_dir = markdown_directory / "asset_staging"
    os.makedirs(asset_staging_dir, exist_ok=True)

    # Download each media file and update references
    successful_downloads = 0
    for url in asset_urls:
        if not download_media(url, asset_staging_dir):
            continue

        filename = script_utils.extract_filename_from_url(url)
        new_url = f"asset_staging/{filename}"
        print(f"Downloaded to {new_url}")

        for file in markdown_files:
            replace_url_in_file(file, url, new_url)

        successful_downloads += 1

    print(
        f"Successfully downloaded {successful_downloads}/{len(asset_urls)} files to asset_staging."
    )

    open_cmd = shutil.which("open")
    if open_cmd:
        subprocess.run([open_cmd, "-g", "-a", "Obsidian"], check=False)


if __name__ == "__main__":
    main()
