"""
Convert assets to optimized formats.
"""

import argparse
import re
import subprocess
from pathlib import Path
from typing import Optional

try:
    from . import compress
    from . import utils as script_utils
except ImportError:
    import compress  # type: ignore
    import utils as script_utils  # type: ignore


def _video_patterns(input_file: Path) -> tuple[str, str]:
    """
    Returns the original and replacement patterns for video files.
    """

    # Function to create unique named capture groups for different link patterns
    def link_pattern_fn(tag):
        return rf"(?P<link_{tag}>[^\)]*)"

    # Pattern for markdown image syntax: ![](link)
    parens_pattern: str = (
        rf"\!?\[\]\({link_pattern_fn('parens')}"
        rf"{input_file.stem}\{input_file.suffix}\)"
    )

    # Pattern for wiki-link syntax: [[link]]
    brackets_pattern: str = (
        rf"\!?\[\[{link_pattern_fn('brackets')}"
        rf"{input_file.stem}\{input_file.suffix}\]\]"
    )

    # Link pattern for HTML tags
    tag_link_pattern: str = link_pattern_fn("tag")

    if input_file.suffix == ".gif":
        # Pattern for <img> tags (used for GIFs)
        tag_pattern: str = (
            rf"<img (?P<earlyTagInfo>[^>]*)"
            rf'src="{tag_link_pattern}{input_file.stem}\.gif"'
            rf"(?P<tagInfo>[^>]*)(?P<endVideoTagInfo>)/?>"
        )
    else:
        # Pattern for <video> tags (used for other video formats)
        tag_pattern = (
            rf"<video (?P<earlyTagInfo>[^>]*)"
            rf'src="{tag_link_pattern}{input_file.stem}{input_file.suffix}"'
            rf'(?P<tagInfo>[^>]*)(?:type="video/{input_file.suffix[1:]}")?'
            rf"(?P<endVideoTagInfo>[^>]*(?=/))/?>"
        )

    # Combine all patterns into one, separated by '|' (OR)
    original_pattern: str = (
        rf"{parens_pattern}|{brackets_pattern}|{tag_pattern}"
    )

    # Combine all possible link capture groups
    all_links = r"\g<link_parens>\g<link_brackets>\g<link_tag>"

    # Convert to .mp4 video
    video_tags: str = (
        "autoplay loop muted playsinline "
        if input_file.suffix == ".gif"
        else ""
    )
    replacement_pattern: str = (
        rf'<video {video_tags}src="{all_links}{input_file.stem}.mp4"'
        rf'\g<earlyTagInfo>\g<tagInfo> type="video/mp4"\g<endVideoTagInfo>>'
        rf'<source src="{all_links}{input_file.stem}.mp4" type="video/mp4">'
        rf"</video>"
    )

    return original_pattern, replacement_pattern


def _image_patterns(input_file: Path) -> tuple[str, str]:
    """
    Returns the original and replacement patterns for image files.
    """
    relative_path = script_utils.path_relative_to_quartz_parent(input_file)
    pattern_file = relative_path.relative_to("quartz")
    output_file: Path = pattern_file.with_suffix(".avif")

    return rf"(?:\./|/)?(?:asset_staging/)?{re.escape(str(pattern_file))}", str(
        output_file
    )


def convert_asset(
    input_file: Path,
    remove_originals: bool = False,
    strip_metadata: bool = False,
    md_references_dir: Optional[Path] = Path("content/"),
) -> None:
    """
    Converts an image or video to a more efficient format. Replaces references
    in markdown files.

    Args:
        input_file: The path to the file to convert.
        remove_originals: Whether to remove the original file.
        strip_metadata: Whether to strip metadata from the converted
        file.
        replacement_dir: The directory to search for markdown files
    Side-effects:
        - Converts the input file to a more efficient format.
        - Replaces references to the input file in markdown files,
          assuming they start with static/.
        - Optionally removes the original file.
        - Optionally strips metadata from the converted file.
    Errors:
        - FileNotFoundError: If the input file does not exist.
        - NotADirectoryError: If the replacement directory does not exist.
        - ValueError: If the input file is not an image or video.
    """

    if not input_file.is_file():
        raise FileNotFoundError(f"Error: File '{input_file}' not found.")

    if md_references_dir and not md_references_dir.is_dir():
        raise NotADirectoryError(
            f"Error: Directory '{md_references_dir}' not found."
        )

    if input_file.suffix in compress.ALLOWED_IMAGE_EXTENSIONS:
        # Get patterns first so that we trigger relative path errors if needed
        original_pattern, replacement_pattern = _image_patterns(input_file)
        compress.image(input_file)
        output_file = input_file.with_suffix(".avif")

    elif input_file.suffix in compress.ALLOWED_VIDEO_EXTENSIONS:
        original_pattern, replacement_pattern = _video_patterns(input_file)
        compress.to_hevc_video(input_file)
        output_file = input_file.with_suffix(".mp4")

    else:
        raise ValueError(f"Error: Unsupported file type '{input_file.suffix}'.")

    for md_file in script_utils.get_files(
        dir_to_search=md_references_dir, filetypes_to_match=(".md",)
    ):
        with open(md_file, "r", encoding="utf-8") as file:
            content = file.read()
        content = re.sub(original_pattern, replacement_pattern, content)

        # Add a second pass to handle the </video><br/>Figure: pattern
        content = re.sub(
            r"</video>\s*(<br/?>)?\s*Figure:", "</video>\n\nFigure:", content
        )

        with open(md_file, "w", encoding="utf-8") as file:
            file.write(content)

    if strip_metadata:
        subprocess.run(
            ["exiftool", "-all=", str(output_file), "--verbose"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )

    if remove_originals and input_file.suffix not in (".mp4", ".avif"):
        input_file.unlink()


def main():
    """
    Convert assets to optimized formats.
    """
    parser = argparse.ArgumentParser(
        description="Convert assets to optimized formats."
    )
    parser.add_argument(
        "-r",
        "--remove-originals",
        action="store_true",
        help="Remove original files after conversion",
    )
    parser.add_argument(
        "-s",
        "--strip-metadata",
        action="store_true",
        help="Strip metadata from converted files",
    )
    parser.add_argument(
        "-d",
        "--asset-directory",
        help="Directory containing assets to convert",
    )
    parser.add_argument(
        "--ignore-files",
        nargs="+",
        help="List of files to ignore during conversion",
    )
    args = parser.parse_args()
    args.asset_directory = (
        Path(args.asset_directory) if args.asset_directory else None
    )

    assets = script_utils.get_files(
        dir_to_search=args.asset_directory,
        filetypes_to_match=compress.ALLOWED_EXTENSIONS,
        use_git_ignore=False,  # Git ignores eg favicons but we don't
    )

    for asset in assets:
        if args.ignore_files and asset.name in args.ignore_files:
            print(f"Ignoring file: {asset}")
            continue
        convert_asset(
            asset,
            remove_originals=args.remove_originals,
            strip_metadata=args.strip_metadata,
            md_references_dir=Path("content/"),
        )


if __name__ == "__main__":
    main()
