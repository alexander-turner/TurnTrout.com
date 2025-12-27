"""
Convert card images in markdown YAML frontmatter to JPEG format.

This script processes markdown files, looking for card_image entries in their
YAML frontmatter. When found, it downloads the images, converts them to JPEG
format (height of 1200 pixels with preserved aspect ratio, <300KB) using
ImageMagick, and uploads them to R2 storage.
"""

#!/usr/bin/env python3
import argparse
import io
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from urllib import parse

import requests
from ruamel.yaml import YAML  # type: ignore

yaml_parser = YAML(typ="rt")  # Use Round-Trip to preserve formatting
yaml_parser.preserve_quotes = True  # Preserve existing quotes
yaml_parser.indent(mapping=2, sequence=2, offset=2)  # Set desired indentation

try:
    from . import r2_upload, source_file_checks
    from . import utils as script_utils
except ImportError:
    import r2_upload  # type: ignore
    import source_file_checks  # type: ignore
    import utils as script_utils  # type: ignore


_CAN_CONVERT_EXTENSIONS: set[str] = {
    ".avif",
    ".webp",
    ".jpg",
    ".jpeg",
    ".png",
}


def _parse_markdown_frontmatter(content: str) -> tuple[dict, str] | None:
    """
    Extract and parse YAML frontmatter from markdown content.

    Args:
        content: Raw markdown file content

    Returns:
        Tuple of (YAML data dict, markdown body) if frontmatter exists,
        None otherwise
    """
    match = re.match(r"^---\n(.*?)\n---\n(.*)", content, re.DOTALL)
    if not match:
        return None

    yaml_content, md_body = match.groups()
    data = yaml_parser.load(yaml_content)
    return data, md_body


_DOWNLOAD_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/91.0.4472.124 Safari/537.36"
    ),
    "Referer": "https://turntrout.com/",
}


def _download_image(url: str, output_path: Path) -> None:
    """
    Download image from URL to specified path.

    Args:
        url: Image URL to download
        output_path: Path to save the downloaded image

    Raises:
        ValueError: If download fails
    """
    response = requests.get(
        url, stream=True, timeout=10, headers=_DOWNLOAD_HEADERS
    )
    if response.status_code == 200:
        with open(output_path, "wb") as out_file:
            shutil.copyfileobj(response.raw, out_file)
    else:
        raise ValueError(f"Failed to download image: {url}")


def _convert_to_jpeg(
    input_path: Path, output_path: Path, max_size_kb: int | None = None
) -> None:
    """
    Convert image to JPEG using ImageMagick with size constraints.

    Resizes to height of 1200 pixels (preserving aspect ratio) and
    iteratively compresses until file size is under max_size_kb.

    Args:
        input_path: Source image path
        output_path: Destination JPEG path
        max_size_kb: Maximum file size in kilobytes (defaults to MAX_CARD_IMAGE_SIZE_KB)
    """
    if max_size_kb is None:
        max_size_kb = source_file_checks.MAX_CARD_IMAGE_SIZE_KB

    magick_executable = script_utils.find_executable("magick")
    target_size = max_size_kb * 1024  # Convert to bytes

    quality = 85
    min_quality = 60

    while quality >= min_quality:
        subprocess.run(
            [
                magick_executable,
                str(input_path),
                "-strip",  # Remove metadata
                "-resize",
                "x1200",  # Resize to height of 1200 pixels, preserving aspect ratio
                "-quality",
                str(quality),
                "-sampling-factor",
                "4:2:0",  # Chroma subsampling for better compression
                str(output_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )

        # Check file size
        file_size = output_path.stat().st_size
        if file_size <= target_size:
            print(
                f"Created JPEG at quality {quality}: {file_size / 1024:.1f}KB"
            )
            return

        # Reduce quality and try again
        quality -= 5

    # If we still can't get under the limit, warn but keep the file
    final_size = output_path.stat().st_size
    print(
        f"Warning: Could not compress below {max_size_kb}KB. Final size: {final_size / 1024:.1f}KB at quality {min_quality}"
    )


def _get_r2_image_url(local_path: Path) -> str:
    """Generate the R2 URL for an uploaded image."""
    r2_base_url = r2_upload.R2_BASE_URL
    r2_key = r2_upload.get_r2_key(
        script_utils.path_relative_to_quartz_parent(local_path)
    )
    return f"{r2_base_url}/{r2_key}"


def _process_image(card_image_url: str, temp_dir: Path) -> tuple[Path, str]:
    """
    Download and convert image to JPEG.

    Returns:
        Tuple of (converted JPEG path, JPEG filename)
    """
    parsed_url = parse.urlparse(card_image_url)
    card_image_filename = os.path.basename(parsed_url.path)
    downloaded_path = temp_dir / card_image_filename
    jpeg_filename = downloaded_path.with_suffix(".jpg").name
    jpeg_path = downloaded_path.with_suffix(".jpg")

    _download_image(card_image_url, downloaded_path)
    _convert_to_jpeg(downloaded_path, jpeg_path)

    return jpeg_path, jpeg_filename


def _setup_and_store_image(jpeg_path: Path, jpeg_filename: str) -> Path:
    """
    Move JPEG to static directory and upload to R2.

    Returns:
        Path to the local JPEG file
    """
    git_root = script_utils.get_git_root()
    static_images_dir = (
        git_root / "quartz" / "static" / "images" / "card_images"
    )
    static_images_dir.mkdir(parents=True, exist_ok=True)
    local_jpeg_path = static_images_dir / jpeg_filename

    shutil.move(str(jpeg_path), str(local_jpeg_path))
    r2_upload.upload_and_move(
        local_jpeg_path,
        verbose=True,
        references_dir=None,
        move_to_dir=r2_upload.R2_MEDIA_DIR,
    )

    return local_jpeg_path


def process_card_image_in_markdown(md_file: Path) -> None:
    """Process the 'card_image' in the YAML frontmatter of the given md file."""
    content_dir = script_utils.get_git_root() / "website_content"
    if not md_file.resolve().is_relative_to(content_dir):
        raise ValueError(
            f"File path {md_file} is not in the website_content directory."
        )

    with open(md_file, encoding="utf-8") as file:
        content = file.read()

    parsed = _parse_markdown_frontmatter(content)
    if not parsed:
        return

    data, md_body = parsed

    # Check if we need to process this file
    card_image_url = data.get("card_image")
    if not card_image_url:
        return

    # Check if the image can be converted
    if not any(card_image_url.endswith(ext) for ext in _CAN_CONVERT_EXTENSIONS):
        return

    errors = source_file_checks.check_card_image(data)
    if not errors:
        print(f"Skipping card_image (already valid): {card_image_url}")
        return

    print(
        f"Processing card_image (found issues: {', '.join(errors)}): {card_image_url}"
    )

    # Process and store the image
    jpeg_path, jpeg_filename = _process_image(
        card_image_url, Path(tempfile.gettempdir())
    )
    local_jpeg_path = _setup_and_store_image(jpeg_path, jpeg_filename)

    # Update the YAML frontmatter
    data["card_image"] = _get_r2_image_url(local_jpeg_path)

    # Write back to file
    stream = io.StringIO()
    yaml_parser.dump(data, stream)
    updated_yaml = stream.getvalue()
    updated_content = f"---\n{updated_yaml}---\n{md_body}"

    with open(md_file, "w", encoding="utf-8") as file:
        file.write(updated_content)

    print(f"Updated 'card_image' in {md_file}")


def main() -> None:
    """
    Main entry point for the script.

    Processes all markdown files in the specified directory (defaults to
    git_root/content), converting card images to JPEG format (<300KB).
    """
    git_root = script_utils.get_git_root()

    parser = argparse.ArgumentParser(
        description="Convert card images in markdown YAML frontmatter."
    )
    parser.add_argument(
        "-d",
        "--markdown-directory",
        help="Directory containing markdown files to process",
        default=git_root / "website_content",
    )
    args = parser.parse_args()

    markdown_dir = Path(args.markdown_directory)
    markdown_files = script_utils.get_files(
        dir_to_search=markdown_dir,
        filetypes_to_match=(".md",),
        use_git_ignore=True,
    )

    for md_file in markdown_files:
        process_card_image_in_markdown(md_file)


if __name__ == "__main__":
    main()
