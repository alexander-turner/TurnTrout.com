#!/usr/bin/env python3
import argparse
from pathlib import Path
import re
import os
import requests
from urllib import parse
import shutil
import tempfile
import subprocess
from ruamel.yaml import YAML  # type: ignore
import io

yaml_parser = YAML(typ="rt")  # Use Round-Trip to preserve formatting
yaml_parser.preserve_quotes = True  # Preserve existing quotes
yaml_parser.indent(mapping=2, sequence=2, offset=2)  # Set desired indentation

try:
    from . import r2_upload
    from . import utils as script_utils
except ImportError:
    import r2_upload  # type: ignore
    import utils as script_utils  # type: ignore


_CAN_CONVERT_EXTENSIONS: set[str] = {
    ".avif",
    ".webp",
    ".jpg",
    ".jpeg",
}


def process_card_image_in_markdown(md_file: Path) -> None:
    """
    Processes the 'card_image' in the YAML frontmatter of the given markdown file.

    It downloads the image, converts it to PNG using ImageMagick, updates the 'card_image' value,
    and uploads the new image to R2.
    """
    with open(md_file, "r", encoding="utf-8") as file:
        content = file.read()

    # Extract YAML front matter
    match = re.match(r"^---\n(.*?)\n---\n(.*)", content, re.DOTALL)
    if not match:
        return

    yaml_content, md_body = match.groups()
    data = yaml_parser.load(yaml_content)

    card_image_url = data.get("card_image")
    if not card_image_url or not any(
        card_image_url.endswith(ext) for ext in _CAN_CONVERT_EXTENSIONS
    ):
        return

    # Download the card_image
    parsed_url = parse.urlparse(card_image_url)
    card_image_filename = os.path.basename(parsed_url.path)

    # Download to a temporary directory
    temp_dir = Path(tempfile.gettempdir())
    downloaded_path = temp_dir / card_image_filename

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Referer": "https://turntrout.com/",
    }
    response = requests.get(card_image_url, stream=True, timeout=10, headers=headers)
    if response.status_code == 200:
        with open(downloaded_path, "wb") as out_file:
            shutil.copyfileobj(response.raw, out_file)
    else:
        raise ValueError(f"Failed to download image: {card_image_url}")

    # Convert downloaded image to PNG using ImageMagick
    png_filename = downloaded_path.with_suffix(".png").name
    png_path = downloaded_path.with_suffix(".png")

    subprocess.run(
        [
            "magick",
            str(downloaded_path),
            "-strip",
            "-define",
            "png:compression-level=9",
            "-define",
            "png:compression-filter=5",
            "-define",
            "png:compression-strategy=1",
            "-colors",
            "256",
            str(png_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    git_root = script_utils.get_git_root()
    if git_root is None:
        raise RuntimeError("Could not determine git root")

    static_images_dir = git_root / "quartz" / "static" / "images" / "card_images"
    static_images_dir.mkdir(parents=True, exist_ok=True)
    local_png_path = static_images_dir / png_filename
    shutil.move(str(png_path), str(local_png_path))

    # Upload the new PNG to R2
    r2_upload.upload_and_move(
        local_png_path,
        verbose=True,
        replacement_dir=None,  # Not replacing references in markdown files
        move_to_dir=r2_upload.R2_MEDIA_DIR,
    )

    # Update the 'card_image' value in the YAML frontmatter
    r2_base_url = r2_upload.R2_BASE_URL
    r2_key = r2_upload.get_r2_key(script_utils.path_relative_to_quartz(local_png_path))
    new_card_image_url = f"{r2_base_url}/{r2_key}"

    data["card_image"] = new_card_image_url

    # Dump YAML data to a string using StringIO
    stream = io.StringIO()
    yaml_parser.dump(data, stream)
    updated_yaml = stream.getvalue()

    updated_content = f"---\n{updated_yaml}---\n{md_body}"

    with open(md_file, "w", encoding="utf-8") as file:
        file.write(updated_content)

    print(f"Updated 'card_image' in {md_file}")


def main():
    git_root = script_utils.get_git_root()
    if git_root is None:
        raise RuntimeError("Could not determine git root")

    parser = argparse.ArgumentParser(
        description="Convert card images in markdown YAML frontmatter."
    )
    parser.add_argument(
        "-d",
        "--markdown-directory",
        help="Directory containing markdown files to process",
        default=git_root / "content",
    )
    args = parser.parse_args()

    markdown_dir = Path(args.markdown_directory)
    markdown_files = script_utils.get_files(
        dir_to_search=markdown_dir,
        filetypes_to_match=(".md",),
    )

    for md_file in markdown_files:
        process_card_image_in_markdown(md_file)


if __name__ == "__main__":
    main()
