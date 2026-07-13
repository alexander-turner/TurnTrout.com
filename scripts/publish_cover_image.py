"""
Publish a cover image for a single post in one command.

Takes a local image file or an http(s) URL, converts it to a JPEG card image
(height 1200px, under the ``maxCardImageSizeKb`` limit) with ImageMagick,
saves it to ``quartz/static/images/card_images/``, uploads it to R2, and
points the post's ``card_image:`` frontmatter at the resulting CDN URL.

Usage:
    uv run python scripts/publish_cover_image.py <image-path-or-url> <post.md>
"""

import argparse
import tempfile
from pathlib import Path

try:
    from . import compress, convert_markdown_yaml, r2_sync, r2_upload
    from . import utils as script_utils
except ImportError:
    import compress
    import convert_markdown_yaml
    import r2_sync
    import r2_upload
    import utils as script_utils


def ensure_r2_remote() -> None:
    """Make sure rclone's default config defines the ``[r2]`` remote."""
    config_path = Path.home() / ".config" / "rclone" / "rclone.conf"
    if config_path.is_file() and "[r2]" in config_path.read_text(
        encoding="utf-8"
    ):
        return

    config_path.parent.mkdir(parents=True, exist_ok=True)
    if not config_path.is_file():
        r2_sync.write_rclone_config(config_path)
        return

    # The config exists but lacks the remote: append a generated [r2]
    # section, leaving the user's other remotes untouched.
    with tempfile.TemporaryDirectory() as tmp:
        generated = Path(tmp) / "rclone.conf"
        r2_sync.write_rclone_config(generated)
        with config_path.open("a", encoding="utf-8") as config_file:
            config_file.write("\n" + generated.read_text(encoding="utf-8"))


def _load_post_frontmatter(md_file: Path) -> tuple[dict, str]:
    """
    Read *md_file* and return its parsed YAML frontmatter and markdown body.

    Raises:
        ValueError: If the file is outside the content directory or has no
            frontmatter.
    """
    script_utils.require_content_dir_file(md_file)

    content = md_file.read_text(encoding="utf-8")
    parsed = convert_markdown_yaml.parse_markdown_frontmatter(content)
    if parsed is None:
        raise ValueError(f"No YAML frontmatter found in {md_file}")
    return parsed


def _resolve_source_image(image: str, temp_dir: Path) -> Path:
    """
    Return a local path to the source image, downloading it if *image* is a URL.

    Raises:
        FileNotFoundError: If a local *image* path does not exist.
        ValueError: If the image extension cannot be converted to JPEG.
    """
    if image.startswith(("http://", "https://")):
        filename = script_utils.extract_filename_from_url(image)
        source_path = temp_dir / filename
        convert_markdown_yaml.download_image(image, source_path)
    else:
        source_path = Path(image)
        if not source_path.is_file():
            raise FileNotFoundError(f"Image file not found: {source_path}")

    if (
        source_path.suffix.lower()
        not in compress.CONVERTIBLE_CARD_IMAGE_EXTENSIONS
    ):
        raise ValueError(
            f"Cannot convert '{source_path.suffix}' to JPEG; supported "
            f"extensions: "
            f"{', '.join(sorted(compress.CONVERTIBLE_CARD_IMAGE_EXTENSIONS))}"
        )
    return source_path


def publish_cover_image(
    image: str,
    md_file: Path,
    dry_run: bool = False,
    overwrite_existing: bool = False,
) -> None:
    """
    Convert *image* to a card JPEG, upload it to R2, and update *md_file*'s
    ``card_image:`` frontmatter.

    With *dry_run*, the image is converted into
    ``quartz/static/images/card_images/`` but nothing is uploaded and the
    markdown file is left unchanged; the actions that would run are printed
    instead. A dry run needs neither R2 credentials nor (for a local image)
    network access.
    """
    data, md_body = _load_post_frontmatter(md_file)

    if not dry_run:
        script_utils.check_r2_env()
        ensure_r2_remote()

    card_images_dir = (
        script_utils.get_git_root()
        / "quartz"
        / "static"
        / "images"
        / "card_images"
    )
    card_images_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        source_path = _resolve_source_image(image, Path(tmp))
        local_jpeg = card_images_dir / source_path.with_suffix(".jpg").name
        convert_markdown_yaml.convert_to_jpeg(source_path, local_jpeg)

    if dry_run:
        r2_key = r2_upload.get_r2_key(
            script_utils.path_relative_to_quartz_parent(local_jpeg)
        )
        r2_url = f"{r2_upload.R2_BASE_URL}/{r2_key}"
        print(f"Dry run: converted image saved to {local_jpeg}")
        print(f"Dry run: would upload to {r2_url}")
        print(f"Dry run: would set card_image in {md_file} to {r2_url}")
        return

    r2_url = r2_upload.upload_to_r2(
        local_jpeg, verbose=True, overwrite_existing=overwrite_existing
    )
    data["card_image"] = r2_url
    script_utils.write_yaml_frontmatter(
        md_file, data, md_body, parser=convert_markdown_yaml.yaml_parser
    )
    print(f"Set card_image in {md_file} to {r2_url}")


def main() -> None:
    """Parse CLI arguments and publish the cover image."""
    parser = argparse.ArgumentParser(
        description=(
            "Convert an image to a card JPEG, upload it to R2, and set the "
            "post's card_image frontmatter."
        )
    )
    parser.add_argument("image", help="Local image path or http(s) URL")
    parser.add_argument(
        "md_file", type=Path, help="Markdown post whose card_image to set"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Convert only; skip the upload and the frontmatter write",
    )
    parser.add_argument(
        "--overwrite-existing",
        action="store_true",
        help="Overwrite the image in R2 if it already exists",
    )
    args = parser.parse_args()

    publish_cover_image(
        args.image,
        args.md_file,
        dry_run=args.dry_run,
        overwrite_existing=args.overwrite_existing,
    )


if __name__ == "__main__":
    main()
