"""
Download external media files to asset_staging directory.

This script scans markdown files for external media URLs (excluding those
already on assets.turntrout.com), downloads them to the asset_staging directory,
and updates the markdown references to point to the local staging directory.
"""

import hashlib
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
    import utils as script_utils

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

EXCLUDED_DOMAIN = script_utils.CDN_HOSTNAME


def download_media(
    url: str, target_dir: Path, target_filename: str | None = None
) -> bool:
    """
    Download media file from URL to target directory.

    Args:
        url: URL of the media file to download
        target_dir: Directory to save the downloaded file
        target_filename: Optional override for the on-disk filename. Callers
            that need collision-safe names (see ``disambiguate_filename``) pass
            the already-disambiguated name here; otherwise the trailing path
            component of the URL is used.

    Returns:
        True if download succeeded, False otherwise
    """
    if target_filename is None:
        try:
            target_filename = script_utils.extract_filename_from_url(url)
        except ValueError:
            print(f"Skipping URL with no filename: {url}", file=sys.stderr)
            return False
    target_path = target_dir / target_filename

    print(f"Downloading: {url} to {target_path}")

    try:
        with _http_session.get(
            url, stream=True, timeout=60, allow_redirects=True
        ) as response:
            response.raise_for_status()
            # ``response.raw`` skips requests' automatic decompression; opt in
            # so a ``Content-Encoding: gzip`` response is written decoded, not
            # as still-compressed bytes.
            response.raw.decode_content = True
            with open(target_path, "wb") as out_file:
                shutil.copyfileobj(response.raw, out_file)
        return True
    except requests.RequestException as e:
        print(f"Error downloading {url}: {e}", file=sys.stderr)
        return False


def disambiguate_filename(url: str, base_filename: str, taken: set[str]) -> str:
    """
    Return a filename not already in *taken*.

    When two distinct URLs share a basename (e.g. two ``image.png`` files
    hosted under different paths), the second one gets a URL-derived prefix
    prepended so both downloads land as distinct files and each markdown
    reference rewrites to its own local path.
    """
    if base_filename not in taken:
        return base_filename
    prefix = hashlib.sha1(url.encode("utf-8")).hexdigest()[:8]
    return f"{prefix}-{base_filename}"


def replace_urls_in_file(file_path: Path, url_map: dict[str, str]) -> None:
    """
    Replace every ``old_url`` in *url_map* with its ``new_url`` counterpart.

    Reads and writes the markdown file at most once regardless of ``url_map``
    size, so a corpus-wide rewrite is O(files), not O(urls x files).
    """
    git_root = script_utils.get_git_root()
    content_dir = git_root / script_utils.CONTENT_DIR_NAME
    if not file_path.resolve().is_relative_to(content_dir):
        raise ValueError(
            f"File path {file_path} is not in the "
            f"{script_utils.CONTENT_DIR_NAME} directory."
        )

    def apply(content: str) -> str:
        for old_url, new_url in url_map.items():
            content = content.replace(old_url, new_url)
        return content

    script_utils.update_markdown_file(file_path, apply)


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
    markdown_directory = git_root / script_utils.CONTENT_DIR_NAME

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

    # Download every URL first, disambiguating any basename collisions, then
    # apply all rewrites in a single pass per markdown file.
    url_to_new_url: dict[str, str] = {}
    taken_filenames: set[str] = set()

    for url in sorted(asset_urls):
        try:
            base_filename = script_utils.extract_filename_from_url(url)
        except ValueError:
            print(f"Skipping URL with no filename: {url}", file=sys.stderr)
            continue
        filename = disambiguate_filename(url, base_filename, taken_filenames)
        if not download_media(url, asset_staging_dir, target_filename=filename):
            continue
        taken_filenames.add(filename)
        new_url = f"asset_staging/{filename}"
        url_to_new_url[url] = new_url
        print(f"Downloaded to {new_url}")

    if url_to_new_url:
        for file in markdown_files:
            replace_urls_in_file(file, url_to_new_url)

    print(
        f"Successfully downloaded {len(url_to_new_url)}/{len(asset_urls)} files to asset_staging."
    )

    open_cmd = shutil.which("open")
    if open_cmd:
        subprocess.run([open_cmd, "-g", "-a", "Obsidian"], check=False)


if __name__ == "__main__":
    main()
