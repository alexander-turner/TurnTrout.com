"""
Convert assets to optimized formats.
"""

import argparse
import re
import subprocess
from pathlib import Path

try:
    from . import compress
    from . import utils as script_utils
except ImportError:
    import compress  # type: ignore
    import utils as script_utils  # type: ignore


asset_staging_pattern: str = r"(?:\.?/asset_staging/)?"


def _video_patterns(input_file: Path) -> tuple[str, str]:
    """
    Returns the original and replacement patterns for video files.
    """

    # create named capture groups for different link patterns
    def link_pattern_fn(tag: str) -> str:
        return rf"(?P<link_{tag}>[^\)]*)"

    input_file_pattern: str = rf"{input_file.stem}\{input_file.suffix}"

    # Pattern for markdown image syntax: ![](link)
    parens_pattern: str = (
        rf"\!?\[\]\({asset_staging_pattern}"
        rf"{link_pattern_fn('parens')}{input_file_pattern}\)"
    )

    # Pattern for wiki-link syntax: [[link]]
    brackets_pattern: str = (
        rf"\!?\[\[{asset_staging_pattern}"
        rf"{link_pattern_fn('brackets')}{input_file_pattern}\]\]"
    )

    # Link pattern for HTML tags
    tag_link_pattern: str = (
        rf"{asset_staging_pattern}{link_pattern_fn('tag')}{input_file_pattern}"
    )

    if input_file.suffix == ".gif":
        # Pattern for <img> tags (used for GIFs)
        tag_pattern: str = (
            r"<img (?P<earlyTagInfo>[^>]*)"
            rf"src=\"{tag_link_pattern}\""
            r"(?P<tagInfo>[^>]*(?<!/))"
            # Ensure group exists; self-closing optional
            r"(?P<endVideoTagInfo>)/?>"
        )
    else:
        # Pattern for <video> tags (used for other video formats)
        tag_pattern = (
            r"<video (?P<earlyTagInfo>[^>]*)"
            rf"src=\"{tag_link_pattern}\""
            rf"(?P<tagInfo>[^>]*)(?:type=\"video/{input_file.suffix[1:]}\")?"
            # will ignore existing </video> tags
            r"(?P<endVideoTagInfo>[^>]*(?<!/))(?:/>|></video>)"
        )

    # Combine all patterns into one, separated by '|' (OR)
    original_pattern: str = (
        rf"{parens_pattern}|{brackets_pattern}|{tag_pattern}"
    )

    # Combine all possible link capture groups
    all_links = r"\g<link_parens>\g<link_brackets>\g<link_tag>"

    # Define replacement based on input type
    replacement_pattern: str  # Declare variable before assignment
    if input_file.suffix == ".gif":
        # For GIFs, replace <img> with <video> using specific attributes
        replacement_pattern = (
            # Add specific attributes for GIF autoplay
            r"<video autoplay loop muted playsinline >"
            # Add WebM source first
            rf'<source src="{all_links}'
            rf'{input_file.stem}.webm" type="video/webm">'
            # Fallback MP4 source
            rf'<source src="{all_links}'
            rf'{input_file.stem}.mp4" type="video/mp4">'
            r"</video>"
        )
    else:
        # For other videos, replace <video> preserving captured attributes
        replacement_pattern = (
            # Preserve attributes captured from the original video tag
            r"<video \g<earlyTagInfo>\g<tagInfo>"
            r"\g<endVideoTagInfo>>"
            # Add WebM source first
            rf'<source src="{all_links}'
            rf'{input_file.stem}.webm" type="video/webm">'
            # Fallback MP4 source
            rf'<source src="{all_links}'
            rf'{input_file.stem}.mp4" type="video/mp4">'
            r"</video>"
        )

    return original_pattern, replacement_pattern


def _image_patterns(input_file: Path) -> tuple[str, str]:
    """
    Returns the original and replacement patterns for image files.
    """
    relative_path = script_utils.path_relative_to_quartz_parent(input_file)
    pattern_file = relative_path.relative_to("quartz")
    output_file: Path = pattern_file.with_suffix(".avif")

    # Handle paths that can start with ./, /, or /asset_staging/
    return (
        rf"(?:\./|/)?(?:asset_staging/)?{re.escape(str(pattern_file))}",
        str(output_file),
    )


def _strip_metadata(file_path: Path) -> None:
    subprocess.run(
        ["exiftool", "-all=", str(file_path), "--verbose"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )


def convert_asset(
    input_file: Path,
    remove_originals: bool = False,
    strip_metadata: bool = False,
    md_references_dir: Path | None = Path("content/"),
) -> None:
    """
    Converts an image or video to a more efficient format. Replaces references
    in markdown files.

    Args:
        input_file: The path to the file to convert.
        remove_originals: Whether to remove the original file.
        strip_metadata: Whether to strip metadata from the converted
            file.
        md_references_dir: The directory to search for markdown files
    Side-effects:
        - Converts the input file to a more efficient format.
        - Replaces references to the input file in markdown files,
          assuming they start with static/.
        - Optionally removes the original file.
        - Optionally strips metadata from the converted file.
    Errors:
        - `FileNotFoundError`: If the input file does not exist.
        - `NotADirectoryError`: If the replacement directory does not exist.
        - `ValueError`: If the input file is not an image or video.
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
        if strip_metadata:
            _strip_metadata(input_file.with_suffix(".avif"))
    elif input_file.suffix in compress.ALLOWED_VIDEO_EXTENSIONS:
        original_pattern, replacement_pattern = _video_patterns(input_file)
        compress.video(input_file)
        if strip_metadata:
            for suffix in [".mp4", ".webm"]:
                _strip_metadata(input_file.with_suffix(suffix))
    else:
        raise ValueError(
            f"Error: Unsupported file type '{input_file.suffix}'."
        )

    for md_file in script_utils.get_files(
        dir_to_search=md_references_dir, filetypes_to_match=(".md",)
    ):
        with open(md_file, encoding="utf-8") as file:
            content = file.read()
        content = re.sub(original_pattern, replacement_pattern, content)

        # Add a second pass to handle the </video><br/>Figure: pattern
        content = re.sub(
            r"</video>\s*(<br/?>)?\s*Figure:", "</video>\n\nFigure:", content
        )

        with open(md_file, "w", encoding="utf-8") as file:
            file.write(content)

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
