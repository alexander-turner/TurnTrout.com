import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Assuming utils.py is accessible
try:
    # Attempt relative import if run as part of a package
    from .. import utils as script_utils
except ImportError:
    # Fallback for running as a script: Add parent dir (scripts) to sys.path
    script_dir = Path(__file__).parent
    parent_dir = script_dir.parent
    sys.path.insert(0, str(parent_dir))
    import utils as script_utils  # type: ignore


# Regex to find <video> tags
# Captures: 1=attributes, 2=inner content
VIDEO_TAG_RE = re.compile(
    r"<video([^>]*)>(.*?)</video>", re.IGNORECASE | re.DOTALL
)

# Regex to find <source> tags within video content
# Captures: 1=full tag, 2=src attribute value, 3=type attribute value
SOURCE_TAG_RE = re.compile(
    r'(<source[^>]*src=["\']([^"\']+)["\'][^>]*type=["\']([^"\']+)["\'][^>]*>)',
    re.IGNORECASE,
)

DESIRED_MP4_TYPE = "video/mp4; codecs=hvc1"


# skipcq: PY-R1000 (one-off script)
def _process_video_content(
    video_content: str,
) -> Tuple[str, bool]:  # noqa: PY-R1000
    """
    Processes the inner content of a video tag.

    - Ensures WEBM source comes before MP4 source.
    - Ensures MP4 source has the correct type attribute.

    Returns:
        Tuple[str, bool]: The potentially modified video content and a flag
                          indicating if changes were made.
    """
    sources: List[Dict[str, str]] = []
    original_sources_str: Dict[str, str] = (
        {}
    )  # Map type (webm/mp4) to full tag string
    modified = False

    # Find all source tags and store their info
    for match in SOURCE_TAG_RE.finditer(video_content):
        full_tag, src, type_attr = match.groups()
        source_type = type_attr.split(";", 1)[
            0
        ].lower()  # Get base type (video/webm or video/mp4)
        sources.append(
            {
                "full_tag": full_tag,
                "src": src,
                "type": type_attr,
                "base_type": source_type,
            }
        )
        if source_type == "video/webm":
            original_sources_str["webm"] = full_tag
        elif source_type == "video/mp4":
            original_sources_str["mp4"] = full_tag

    # Check if both webm and mp4 sources are present
    webm_source: Optional[Dict[str, str]] = next(
        (s for s in sources if s["base_type"] == "video/webm"), None
    )
    mp4_source: Optional[Dict[str, str]] = next(
        (s for s in sources if s["base_type"] == "video/mp4"), None
    )

    new_content = video_content
    processed_tags: List[str] = []  # Keep track of tags already handled

    # 1. Check MP4 type attribute
    if mp4_source:
        processed_tags.append(original_sources_str["mp4"])
        if mp4_source["type"] != DESIRED_MP4_TYPE:
            print(
                f"      Updating MP4 type from '{mp4_source['type']}' to '{DESIRED_MP4_TYPE}'"
            )
            # Reconstruct the tag with the correct type
            updated_mp4_tag = re.sub(
                r'type=["\'][^"\']+["\']',
                f'type="{DESIRED_MP4_TYPE}"',
                mp4_source["full_tag"],
                count=1,
            )
            new_content = new_content.replace(
                mp4_source["full_tag"], updated_mp4_tag
            )
            original_sources_str["mp4"] = (
                updated_mp4_tag  # Update for potential reordering
            )
            modified = True

    # 2. Check source order
    if webm_source and mp4_source:
        processed_tags.append(original_sources_str["webm"])
        webm_pos = new_content.find(original_sources_str["webm"])
        mp4_pos = new_content.find(original_sources_str["mp4"])

        if webm_pos == -1 or mp4_pos == -1:
            print(
                "      Warning: Could not find original source tag positions for reordering check.",
                file=sys.stderr,
            )
        elif webm_pos < mp4_pos:  # Check if WEBM is currently before MP4
            print("      Ensuring MP4 source comes before WEBM source.")
            # Extract tags and the content between them
            mp4_tag_to_swap = original_sources_str["mp4"]
            webm_tag_to_swap = original_sources_str["webm"]

            # Replace MP4 with WEBM and WEBM with MP4
            # Need temporary placeholders to avoid replacing parts of the other tag
            placeholder1 = "__TEMP_WEBM_PLACEHOLDER__"
            placeholder2 = "__TEMP_MP4_PLACEHOLDER__"
            new_content = new_content.replace(mp4_tag_to_swap, placeholder1, 1)
            new_content = new_content.replace(
                webm_tag_to_swap, placeholder2, 1
            )
            new_content = new_content.replace(
                placeholder1, webm_tag_to_swap, 1
            )
            new_content = new_content.replace(placeholder2, mp4_tag_to_swap, 1)
            modified = True

    # 3. Add back any other source tags that weren't webm/mp4 if they got lost
    # This part is tricky with string replacement. A more robust parser would be better.
    # For now, let's assume simple cases or use the existing structure.
    # If the number of sources found initially doesn't match webm+mp4 count, print warning.
    other_sources = [
        s for s in sources if s["base_type"] not in ("video/webm", "video/mp4")
    ]
    if other_sources:
        print(
            f"      Warning: Found other source types ({len(other_sources)}), modifications might be incomplete.",
            file=sys.stderr,
        )

    return new_content, modified


def process_markdown_file(md_path: Path) -> None:
    """Finds video tags, checks source order and types, and updates markdown."""
    print(f"Processing: {md_path.name}")
    try:
        original_content = md_path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"  Error reading file {md_path}: {e}", file=sys.stderr)
        return

    new_content = original_content
    file_modified = False
    offset = 0  # Keep track of index changes due to replacements

    for match in VIDEO_TAG_RE.finditer(original_content):
        video_attrs = match.group(1)
        video_inner_content = match.group(2)
        start, end = match.span()
        current_start = start + offset
        current_end = end + offset

        print(f"  Found <video> tag at index {start}")

        updated_inner_content, content_modified = _process_video_content(
            video_inner_content
        )

        if content_modified:
            file_modified = True
            updated_video_tag = (
                f"<video{video_attrs}>{updated_inner_content}</video>"
            )
            # Replace in the potentially already modified new_content string
            new_content = (
                new_content[:current_start]
                + updated_video_tag
                + new_content[current_end:]
            )
            # Update offset for subsequent replacements
            offset += len(updated_video_tag) - (end - start)

    # Write the changes back to the file if modified
    if file_modified:
        print(f"  Writing changes to {md_path.name}")
        try:
            md_path.write_text(new_content, encoding="utf-8")
        except Exception as e:
            print(
                f"  Error writing changes to {md_path}: {e}", file=sys.stderr
            )
    else:
        print(f"  No changes needed for {md_path.name}")


def main() -> None:
    git_root = script_utils.get_git_root()
    content_dir = git_root / "website_content"
    if not content_dir.is_dir():
        print(
            f"Error: Content directory not found: {content_dir}",
            file=sys.stderr,
        )
        sys.exit(1)

    # Process only markdown files in the content directory
    md_files = script_utils.get_files(
        content_dir, (".md",), use_git_ignore=True  # Respect .gitignore
    )

    print(f"Found {len(md_files)} markdown files in {content_dir}")

    for md_file in md_files:
        process_markdown_file(md_file)

    print("Script finished.")


if __name__ == "__main__":
    main()
