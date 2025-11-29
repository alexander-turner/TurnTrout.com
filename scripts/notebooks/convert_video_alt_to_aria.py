import re
import sys
from pathlib import Path
from typing import Tuple

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


# Regex to find <video> tags and capture attributes and inner content
# Captures: 1=attributes string, 2=inner content
VIDEO_TAG_RE = re.compile(
    r"<video([^>]*)>(.*?)</video>", re.IGNORECASE | re.DOTALL
)

# Regex to find the alt attribute within the video attributes string
# Captures: 1=quote char (' or "), 2=attribute value
ALT_ATTR_RE = re.compile(r'\s+alt=(["\'])(.*?)\1', re.IGNORECASE)


def _process_video_attributes(video_attrs: str) -> Tuple[str, bool]:
    """
    Processes the attribute string of a video tag.

    - Replaces `alt="value"` with `aria-label="value"`.

    Returns:
        Tuple[str, bool]: The potentially modified attributes string and a flag
                          indicating if changes were made.
    """
    modified = False
    new_attrs = video_attrs

    match = ALT_ATTR_RE.search(new_attrs)
    if match:
        full_alt_attribute = match.group(
            0
        )  # Full attribute match (e.g., ' alt="value"')
        alt_value = match.group(2)  # Just the value
        # Keep leading space for replacement, construct new attribute
        aria_label_attribute = f' aria-label="{alt_value}"'
        print(
            f"      Replacing `{full_alt_attribute.strip()}` with `{aria_label_attribute.strip()}`"
        )
        new_attrs = new_attrs.replace(
            full_alt_attribute, aria_label_attribute, 1
        )
        modified = True

    return new_attrs, modified


def process_markdown_file(md_path: Path) -> None:
    """Finds video tags, replaces alt with aria-label, and updates markdown."""
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
        original_video_attrs = match.group(1)
        video_inner_content = match.group(2)
        start, end = match.span()
        current_start = start + offset
        current_end = end + offset

        print(f"  Found <video> tag at index {start}")

        updated_video_attrs, attrs_modified = _process_video_attributes(
            original_video_attrs
        )

        if attrs_modified:
            file_modified = True
            updated_video_tag = (
                f"<video{updated_video_attrs}>{video_inner_content}</video>"
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
