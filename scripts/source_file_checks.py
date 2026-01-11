"""Check source files for issues, like invalid links, missing required fields,
etc."""

import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Literal, Set, TypedDict

import requests  # type: ignore[import]

# Add the project root to sys.path
# pylint: disable=wrong-import-position
sys.path.append(str(Path(__file__).parent.parent))
# skipcq: FLK-E402
from scripts import utils as script_utils  # noqa: E402

MetadataIssues = Dict[str, List[str]]
PathMap = Dict[str, Path]  # Maps URLs to their source files


class ForbiddenPatternConfig(TypedDict):
    """Configuration for a forbidden pattern check."""

    pattern: str
    ignore_math: bool
    ignore_code: bool


def check_required_fields(metadata: dict) -> List[str]:
    """Check for empty required metadata fields."""
    errors = []
    required_fields = ("title", "description", "tags", "permalink")

    if not metadata:
        errors.append("No valid frontmatter found")
        return errors

    for field in required_fields:
        if field not in metadata:
            errors.append(f"Missing {field} field")
        elif metadata[field] in (None, "", [], {}):
            errors.append(f"Empty {field} field")

    return errors


def check_cover_image_alt(metadata: dict) -> List[str]:
    """If a card_image is specified, card_image_alt must also be provided."""
    errors: List[str] = []
    card_url = metadata.get("card_image")
    if not metadata or not metadata.get("card_image"):
        return errors

    # Check if there's a custom card_image
    card_image_alt = metadata.get("card_image_alt", "")
    if not card_image_alt.strip():
        errors.append(f"Custom card_image ({card_url}) requires card_image_alt")

    return errors


def get_max_card_image_size_kb() -> int:
    """Get the max card image size from config."""
    constants = script_utils.load_shared_constants()
    return constants["maxCardImageSizeKb"]


def _check_card_image_domain(card_url: str) -> List[str]:
    """Check if card_image is from assets.turntrout.com."""
    if not card_url.startswith("https://assets.turntrout.com/"):
        return [
            f"card_image must be from assets.turntrout.com, "
            f"but found: {card_url}"
        ]
    return []


def _check_card_image_format(card_url: str) -> List[str]:
    """Check if card_image has valid format (JPEG or PNG)."""
    allowed_extensions = {".jpg", ".jpeg", ".png"}
    if not any(card_url.endswith(ext) for ext in allowed_extensions):
        return [
            f"card_image should use JPEG (.jpg or .jpeg) or PNG (.png) format, "
            f"but found: {card_url}"
        ]
    return []


def _check_card_image_accessibility(card_url: str) -> List[str]:
    """
    Check if card_image URL is accessible and under size limit.

    This check is best-effort: network/SSL issues should not crash long-running
    asset pipelines.
    """
    errors: List[str] = []
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/58.0.3029.110 Safari/537.36"
            )
        }
        response = requests.head(
            card_url, timeout=10, allow_redirects=True, headers=headers
        )

        if not response.ok:
            errors.append(
                f"Card image URL '{card_url}' returned "
                f"status {response.status_code}"
            )
        else:
            # Check size if request was successful
            content_length = response.headers.get("Content-Length")
            if content_length:
                size_kb = int(content_length) / 1024
                max_size_kb = get_max_card_image_size_kb()
                if size_kb > max_size_kb:
                    errors.append(
                        f"card_image is {size_kb:.1f}KB, should be under {max_size_kb}KB: {card_url}"
                    )
    except KeyboardInterrupt:
        # Allow Ctrl-C to stop the pipeline without printing a scary traceback.
        raise
    except requests.RequestException as e:
        errors.append(f"Failed to load card image URL '{card_url}': {str(e)}")

    return errors


def check_card_image(metadata: dict) -> List[str]:
    """
    Check card_image format, size, and existence.

    Records errors if:
    - Not from turntrout assets
    - Doesn't have PNG or JPEG extension
    - Over 300KB
    - URL is not accessible
    """
    card_url = metadata.get("card_image")
    if not card_url:
        return []

    errors: List[str] = []
    errors.extend(_check_card_image_domain(card_url))
    errors.extend(_check_card_image_format(card_url))
    errors.extend(_check_card_image_accessibility(card_url))
    return errors


def validate_video_tags(text: str) -> List[str]:
    """
    Validate that the video tag is valid.

    Returns:
        List of error messages for invalid video tags
    """
    issues = []
    for match in re.finditer(r"<video[^>]*\s(src|type)\s*=", text):
        issues.append(
            f"Video tag contains forbidden 'src' or 'type' attribute:"
            f" {match.group()}"
        )
    return issues


def check_url_uniqueness(
    urls: Set[str], existing_urls: PathMap, source_path: Path
) -> List[str]:
    """
    Check if any URLs (permalinks/aliases) have already been used.

    Args:
        urls: Set of URLs to check
        existing_urls: Map of known URLs to their file paths
        source_path: Path to file being checked

    Returns:
        List of error messages for duplicate URLs
    """
    errors = []
    for url in urls:
        if url in existing_urls:
            errors.append(f"URL '{url}' already used in: {existing_urls[url]}")
        else:
            existing_urls[url] = source_path
    return errors


def get_all_urls(metadata: dict) -> Set[str]:
    """
    Extract all URLs (permalinks and aliases) from metadata.

    Args:
        metadata: The file's frontmatter metadata

    Returns:
        Set of all URLs defined in the metadata
    """
    urls = set()

    # Add permalink if it exists
    if permalink := metadata.get("permalink"):
        urls.add(permalink)

    # Add all aliases if they exist
    if aliases := metadata.get("aliases", []):
        # Handle both string and list aliases
        if isinstance(aliases, str):
            urls.add(aliases)
        else:
            urls.update(aliases)

    return urls


def check_invalid_md_links(text: str, file_path: Path) -> List[str]:
    """
    Check for invalid markdown links that don't start with '/'.

    Args:
        text: The text to check
        file_path: Path to the markdown file to check

    Returns:
        List of error messages for invalid links found
    """
    invalid_md_link_pattern = r"\]\([-A-Za-z_0-9:]+(\.md)?\)"
    errors = []

    matches = re.finditer(invalid_md_link_pattern, text)

    for match in matches:
        if (
            "shard-theory" in match.group() and "design.md" in file_path.name
        ):  # pragma: no cover
            continue  # I mention this checker, not a real broken link
        line_num = text[: match.start()].count("\n") + 1
        errors.append(
            f"Invalid markdown link at line {line_num}: {match.group()}"
        )

    return errors


def check_latex_tags(text: str, file_path: Path) -> List[str]:
    r"""
    Check for \tag{ in markdown files, which should be avoided.

    Args:
        text: The text to check
        file_path: Path to the markdown file to check

    Returns:
        List of error messages for found LaTeX tags
    """
    # There's an innocuous use of LaTeX tags in design.md, so we'll ignore it
    if "design.md" in file_path.name:  # pragma: no cover
        return []

    tag_pattern = r"(?<!\\)\\tag\{"
    errors = []

    matches = re.finditer(tag_pattern, text)

    for match in matches:
        line_num = text[: match.start()].count("\n") + 1
        errors.append(f"LaTeX \\tag{{}} found at line {line_num}")

    return errors


def _slug_in_metadata(slug: str, target_metadata: dict) -> bool:
    is_alias = (
        target_metadata.get("aliases") and slug in target_metadata["aliases"]
    )
    return slug == target_metadata["permalink"] or bool(is_alias)


SequenceDirection = Literal["next", "prev"]


def check_post_titles(
    current_mapping: dict,
    target_mapping: dict,
    target_slug: str,
    direction: SequenceDirection,
) -> List[str]:
    """
    Check if post titles match between linked posts.

    Args:
        current_mapping: Metadata of the current post
        target_mapping: Metadata of the linked post (next/prev)
        target_slug: Permalink of the linked post
        direction: Direction of the link ('next' or 'prev')

    Returns:
        List of error messages for title mismatches
    """
    errors = []

    def _simplify_title(title: str) -> str:
        """Simplify a title by removing non-alphanumeric characters and
        converting to lowercase."""
        return re.sub(r"[^a-zA-Z0-9]+", "", title).lower()

    title_field = f"{direction}-post-title"
    if title_field in current_mapping:
        expected_title = current_mapping[title_field]
        actual_title = target_mapping.get("title", "")
        if _simplify_title(expected_title) != _simplify_title(actual_title):
            errors.append(
                f"{title_field} mismatch: expected '{expected_title}', "
                f"but {target_slug} has title '{actual_title}'"
            )

    return errors


def check_sequence_relationships(
    permalink: str, sequence_data: Dict[str, dict]
) -> List[str]:
    """
    Check if next-post-slug and prev-post-slug relationships are bidirectional,
    and that {next,prev}-post-title fields match the actual titles.

    For example:
    - If post A has next-post-slug=B, then post B must have prev-post-slug=A
    - If post A has next-post-slug=B and next-post-title=X, then
        post B's title must be X
    """
    if not permalink or permalink not in sequence_data:
        raise ValueError(f"Invalid permalink {permalink}")

    errors: List[str] = []
    current_mapping = sequence_data[permalink]
    # Compute all valid identifiers (permalink and aliases) for the current post
    valid_ids = {
        key for key, value in sequence_data.items() if value is current_mapping
    }

    for key, target_field_prefix in (("next", "prev"), ("prev", "next")):
        slug_field = f"{key}-post-slug"
        if slug_field not in current_mapping:
            continue

        target_slug: str = current_mapping[slug_field]
        if target_slug not in sequence_data:
            errors.append(f"Could not find post with permalink {target_slug}")
            continue

        target_mapping = sequence_data[target_slug]
        target_slug_field = f"{target_field_prefix}-post-slug"
        target_slug_value = target_mapping.get(target_slug_field, "")

        if target_slug_value not in valid_ids:
            errors.append(
                f"Post {target_slug} should have "
                f"{target_slug_field}={permalink}; "
                f"currently has {target_slug_value}"
            )

        # Check titles match
        errors.extend(
            check_post_titles(
                current_mapping,
                target_mapping,
                target_slug,
                key,  # type: ignore[arg-type]
            )
        )

    return errors


def check_spaces_in_path(file_path: Path) -> List[str]:
    """Check if the file path contains spaces."""
    return ["File path contains spaces"] if " " in str(file_path) else []


def check_table_alignments(text: str) -> List[str]:
    """
    Check if all markdown tables have explicit column alignments.

    By specifying alignment, table appearance is robust to CSS changes.

    Valid alignments: :---:, :---, ---:, :---:
    Invalid: ---, ----
    """
    errors = []

    column_pattern = r"\|\s*-+\s*\|"
    for line_num, line in enumerate(text.split("\n"), 1):
        if re.search(column_pattern, line):
            errors.append(
                f"Table column at line {line_num} missing alignment "
                f"(should be :---, ---:, or :---:)"
            )

    return errors


_REPLACEMENT_CHAR = "\uffff"  # Private use area character


def remove_code(text: str, mark_boundaries: bool = False) -> str:
    """
    Strip all code blocks and inline code from text.

    Args:
        text: The text to process
        mark_boundaries: Whether to mark the boundaries of where code elements
            were removed
    """
    replacement_char = _REPLACEMENT_CHAR if mark_boundaries else ""

    # Preserve newlines in code blocks to maintain line structure
    def replace_preserving_newlines(match: re.Match) -> str:
        content = match.group(0)
        newline_count = content.count("\n")
        return "\n" * newline_count if newline_count > 0 else replacement_char

    no_code_block_text = re.sub(
        r"```.*?```", replace_preserving_newlines, text, flags=re.DOTALL
    )
    # Match inline code but don't cross newlines
    return re.sub(
        r"(?<!\\)`[^`\n]*(?<!\\)`", replacement_char, no_code_block_text
    )


def remove_math(text: str, mark_boundaries: bool = False) -> str:
    """
    Strip all math elements from text.

    Args:
        text: The text to process
        mark_boundaries: Whether to mark the boundaries of where math elements
            were removed
    """
    replacement_char = _REPLACEMENT_CHAR if mark_boundaries else ""

    # Preserve newlines in math blocks to maintain line structure
    def replace_preserving_newlines(match: re.Match) -> str:
        content = match.group(0)
        newline_count = content.count("\n")
        return "\n" * newline_count if newline_count > 0 else replacement_char

    no_math_block_text = re.sub(
        r"\$\$.*?\$\$", replace_preserving_newlines, text, flags=re.DOTALL
    )
    # Match inline math but don't cross newlines
    return re.sub(
        r"(?<!\\)\$[^$\n]*?(?<!\\)\$", replacement_char, no_math_block_text
    )


# Either preceded by two backslashes or none, and then a brace.
_BRACE_REGEX = r"(^|(?<=\\\\)|(?<=[^\\]))[{}]"
# Ignore matching open/close braces at end of line.
_END_OF_LINE_BRACES_REGEX = r"{[^$`\\]*}\s*$"


def check_unescaped_braces(text: str) -> List[str]:
    """
    Check for unescaped braces in markdown files that aren't at beginning/end of
    line or inside of katex element.

    Args:
        file_path: Path to the markdown file to check

    Returns:
        List of error messages for unescaped braces found
    """
    content_no_eol_braces = re.sub(
        _END_OF_LINE_BRACES_REGEX,
        "",
        text,
        flags=re.MULTILINE,
    )
    no_code_content = remove_code(content_no_eol_braces)
    stripped_content = remove_math(no_code_content)

    errors = []
    for match in re.finditer(_BRACE_REGEX, stripped_content, re.MULTILINE):
        # Get the line containing the match
        line_start = stripped_content.rfind("\n", 0, match.start()) + 1
        line_end = stripped_content.find("\n", match.start())
        if line_end == -1:  # Handle last line
            line_end = len(stripped_content)
        line = stripped_content[line_start:line_end]

        errors.append(f"Unescaped brace found in: {line.strip()}")

    return errors


_FORBIDDEN_PATTERNS: tuple[ForbiddenPatternConfig, ...] = (
    {
        "pattern": r'["")\]]\s+\.',
        "ignore_math": True,
        "ignore_code": True,
    },
    {
        "pattern": r"(?<=[A-Za-z\.,;:!?\$\}…])\s+\)",
        "ignore_math": False,
        "ignore_code": True,
    },
)


def check_no_forbidden_patterns(text: str) -> List[str]:
    """Check for forbidden patterns in text."""
    errors = []
    for config in _FORBIDDEN_PATTERNS:
        processed_text = text
        if config["ignore_code"]:
            processed_text = remove_code(processed_text, mark_boundaries=True)
        if config["ignore_math"]:
            processed_text = remove_math(processed_text, mark_boundaries=True)

        for match in re.finditer(config["pattern"], processed_text):
            line_num = text[: match.start()].count("\n") + 1
            errors.append(
                f"Forbidden pattern found: {match.group()} on line {line_num}"
            )
    return errors


def check_stray_katex(text: str) -> List[str]:
    """Check for stray LaTeX commands outside of math/code blocks."""
    stripped_text = remove_math(remove_code(text))
    errors = []
    # This pattern finds a space followed by a backslash and a word.
    # e.g. " \command"
    pattern = r" (\\[a-zA-Z]+)"
    for match in re.finditer(pattern, stripped_text):
        errors.append(f"Stray LaTeX command found: {match.group().strip()}")
    return errors


def check_html_with_braces(text: str) -> List[str]:
    """Check for HTML elements followed by {style="..."}, which won't work as
    intended."""
    errors = []
    stripped_text = remove_math(remove_code(text))

    # Pattern to match HTML closing tag followed by {[^}]*="..."}
    # e.g. </video>{style="width:50%;"}
    pattern = r"</[a-zA-Z][^>]*>\s*\{[^}]+\}"

    for match in re.finditer(pattern, stripped_text):
        line_num = stripped_text[: match.start()].count("\n") + 1
        errors.append(
            f"HTML element with style braces at line {line_num}: "
            f"{match.group().strip()}"
        )

    return errors


def check_heading_links(text: str) -> List[str]:
    """
    Headings should not contain markdown links like [text](url).

    Instead, links should be moved to a "Subtitle:" line below the heading.
    """
    errors = []
    stripped_text = remove_code(text)
    pattern = r"^#{1,6}\s+.*\[.*?\]\(.*$"

    for match in re.finditer(pattern, stripped_text, re.MULTILINE):
        line_num = stripped_text[: match.start()].count("\n") + 1
        heading_text = match.group().strip()
        errors.append(
            f"Heading contains markdown link at line {line_num}: {heading_text}"
        )

    return errors


def extract_footnote_line_numbers(text: str) -> Dict[str, int]:
    """
    Extract all footnote definitions from text.

    Returns:
        Dictionary mapping footnote names to their line numbers.
        If a footnote is defined multiple times, only the first occurrence
        is recorded.
    """
    # Extract from original text since definitions can contain code
    definition_pattern = r"\[\^([^\]]+)\]:"
    definitions: Dict[str, int] = {}
    for match in re.finditer(definition_pattern, text):
        footnote_name = match.group(1)
        # Only record the first occurrence of each footnote definition
        if footnote_name not in definitions:
            definitions[footnote_name] = text[: match.start()].count("\n") + 1
    return definitions


def extract_footnote_references(text: str) -> Dict[str, int]:
    """
    Extract all footnote references from text, excluding definitions and content
    in code/math blocks.

    Returns:
        Dictionary mapping footnote names to their reference counts
    """
    # Remove code and math blocks to avoid false positives
    stripped_text = remove_math(remove_code(text))

    reference_pattern = r"\[\^([^\]]+)\]"
    references: Dict[str, int] = {}
    for match in re.finditer(reference_pattern, stripped_text):
        footnote_name = match.group(1)
        # Skip if this is a definition (has colon after it)
        match_end = match.end()
        if match_end < len(stripped_text) and stripped_text[match_end] == ":":
            continue
        references[footnote_name] = references.get(footnote_name, 0) + 1
    return references


def check_footnote_references(text: str) -> List[str]:
    """Check that each footnote is referenced exactly once."""
    errors = []
    definitions = extract_footnote_line_numbers(text)
    references = extract_footnote_references(text)

    # Check each definition is referenced exactly once
    for footnote_name, line_num in definitions.items():
        ref_count = references.get(footnote_name, 0)
        if ref_count == 0:
            errors.append(
                f"Footnote '{footnote_name}' is defined but never referenced "
                f"(line {line_num})"
            )
        elif ref_count > 1:
            errors.append(
                f"Footnote '{footnote_name}' is referenced {ref_count} times "
                f"(should be exactly once, defined at line {line_num})"
            )

    # Check for references to undefined footnotes
    for footnote_name in references:
        if footnote_name not in definitions:
            errors.append(
                f"Footnote '{footnote_name}' is referenced but never defined"
            )

    return errors


def check_file_data(
    metadata: dict,
    existing_urls: PathMap,
    file_path: Path,
    all_posts_metadata: Dict[str, dict],
) -> MetadataIssues:
    """
    Check a single file's metadata and content for various issues.

    Args:
        metadata: The file's frontmatter metadata
        existing_urls: Map of known URLs to their file paths
        file_path: Path to the file being checked
        all_posts_metadata: Map of file paths to their metadata for all posts

    Returns:
        Dictionary mapping check names to lists of error messages
    """
    text = file_path.read_text()
    issues: MetadataIssues = {
        "required_fields": check_required_fields(metadata),
        "cover_image_alt": check_cover_image_alt(metadata),
        "invalid_links": check_invalid_md_links(text, file_path),
        "latex_tags": check_latex_tags(text, file_path),
        "table_alignments": check_table_alignments(text),
        "unescaped_braces": check_unescaped_braces(text),
        "video_tags": validate_video_tags(text),
        "forbidden_patterns": check_no_forbidden_patterns(text),
        "stray_katex": check_stray_katex(text),
        "html_braces": check_html_with_braces(text),
        "heading_links": check_heading_links(text),
        "footnote_references": check_footnote_references(text),
        "invalid_filename": check_spaces_in_path(file_path),
    }

    if metadata:
        urls = get_all_urls(metadata)
        if urls:
            issues["duplicate_urls"] = check_url_uniqueness(
                urls, existing_urls, file_path
            )
        issues["post_slug_relationships"] = check_sequence_relationships(
            metadata.get("permalink", ""), all_posts_metadata
        )
        issues["card_image"] = check_card_image(metadata)

    return issues


def print_issues(file_path: Path, issues: MetadataIssues) -> None:
    """Print issues found in a file."""
    if any(lst for lst in issues.values()):
        print(f"\nIssues found in {file_path}:")
        for check_name, errors in issues.items():
            if errors:  # Only print sections that have errors
                print(f"  {check_name}:")
                for error in errors:
                    print(f"    - {error}")


def compile_scss(scss_file_path: Path) -> str:
    """Compile SCSS file to CSS string."""
    if not scss_file_path.exists():
        return ""

    styles_dir = scss_file_path.parent
    sass_path = Path(str(shutil.which("sass")))

    result = subprocess.run(
        [sass_path, f"--load-path={styles_dir}", str(scss_file_path)],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def check_font_files(css_content: str, base_dir: Path) -> List[str]:
    """
    Check if font files referenced in CSS exist.

    Args:
        css_content: Compiled CSS content
        base_dir: Base directory for resolving font paths

    Returns:
        List of missing font file paths
    """
    missing_fonts = []
    font_pattern = re.compile(
        r"""@font-face\s*\{[^}]*?
        src:\s*url\(\s*["']?(.*?)["']?\)\s*
        (?:format\([^\)]*\)\s*)?
        [^;]*;""",
        re.VERBOSE | re.DOTALL,
    )

    for match in font_pattern.finditer(css_content):
        font_path = match.group(1)
        if font_path.startswith(("http:", "https:", "data:")):
            continue

        if font_path.startswith("/static/"):
            font_path = f"/quartz{font_path}"

        full_path = (base_dir / font_path.lstrip("/")).resolve()
        if not full_path.is_file():
            missing_fonts.append(font_path)

    return missing_fonts


def check_font_families(css_content: str) -> List[str]:
    """
    Check if all referenced font families are properly declared.

    Args:
        css_content: Compiled CSS content

    Returns:
        List of undeclared font family names
    """
    # Common system and fallback fonts to ignore
    system_fonts = {
        "serif",
        "sans-serif",
        "monospace",
        "cursive",
        "fantasy",
        "system-ui",
        "ui-serif",
        "ui-sans-serif",
        "ui-monospace",
        "garamond",
        "times new roman",
        "courier new",
        "jetbrains mono",
    }

    def clean_font_name(name: str) -> str:
        """Clean font name by removing quotes and OpenType feature tags."""
        name = name.strip().strip("\"'").lower()
        # Remove OpenType feature tags (e.g., :+swsh, :smcp)
        return name.split(":")[0]

    # Find all @font-face declarations and their font families
    font_face_pattern = re.compile(
        r"""@font-face\s*\{[^}]*?
        font-family:\s*["']?(.*?)["']?[;,]""",
        re.VERBOSE | re.DOTALL,
    )
    declared_fonts = {
        clean_font_name(match.group(1))
        for match in font_face_pattern.finditer(css_content)
    }

    # Find all font-family references in CSS custom properties
    missing_fonts = []
    font_ref_pattern = re.compile(r'--[^:]*?:\s*["\'](.*?)["\']\s*(?:,|;)')

    for match in font_ref_pattern.finditer(css_content):
        fonts = match.group(1).split(",")
        for font in fonts:
            font = clean_font_name(font)
            if font not in system_fonts and font not in declared_fonts:
                missing_fonts.append(f"Undeclared font family: {font}")

    return missing_fonts


def check_scss_font_files(scss_file_path: Path, base_dir: Path) -> List[str]:
    """
    Check SCSS file for font-related issues.

    Args:
        scss_file_path: Path to the SCSS file
        base_dir: Base directory for resolving font paths

    Returns:
        List of issues found (missing files and undeclared families)
    """
    try:
        css_content = compile_scss(scss_file_path)
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        error_msg = getattr(e, "stderr", str(e))
        print(f"Error compiling SCSS: {error_msg}")
        return [f"SCSS compilation error: {error_msg}"]

    missing_files = check_font_files(css_content, base_dir)
    undeclared_families = check_font_families(css_content)

    return missing_files + undeclared_families


def build_sequence_data(markdown_files: List[Path]) -> Dict[str, dict]:
    """Build a mapping of post slugs to their forward and previous post
    slugs."""
    all_sequence_data: Dict[str, dict] = {}
    for file_path in markdown_files:
        metadata, _ = script_utils.split_yaml(file_path)
        if metadata:
            # Build a mapping with only the forward and previous post slugs
            slug_mapping: Dict[str, str] = {}
            for key in (
                "title",
                "next-post-slug",
                "prev-post-slug",
                "next-post-title",
                "prev-post-title",
            ):
                if key in metadata:
                    slug_mapping[key] = metadata[key]
            if permalink := metadata.get("permalink", ""):
                all_sequence_data[permalink] = slug_mapping
            if aliases := metadata.get("aliases", []):
                for alias in aliases:
                    if not alias:
                        continue
                    all_sequence_data[alias] = slug_mapping

    return all_sequence_data


def main() -> None:
    """Check source files for issues."""
    git_root = script_utils.get_git_root()
    content_dir = git_root / "website_content"
    existing_urls: PathMap = {}
    has_errors = False

    # Check markdown files
    markdown_files = script_utils.get_files(
        dir_to_search=content_dir,
        filetypes_to_match=(".md",),
        use_git_ignore=True,
        ignore_dirs=["templates", "drafts"],
    )

    # mapping from permalink or alias to its forward and prev post slugs
    all_sequence_data: Dict[str, dict] = build_sequence_data(
        list(markdown_files)
    )

    for file_path in markdown_files:
        metadata, _ = script_utils.split_yaml(file_path)
        if metadata:
            rel_path = file_path.relative_to(git_root)
            issues = check_file_data(
                metadata, existing_urls, file_path, all_sequence_data
            )
            if any(lst for lst in issues.values()):
                has_errors = True
                print_issues(rel_path, issues)

    # Check font files
    fonts_scss_path = git_root / "quartz" / "styles" / "fonts.scss"
    if missing_fonts := check_scss_font_files(fonts_scss_path, git_root):
        has_errors = True
        print("\nMissing font files:")
        for font in missing_fonts:
            print(f"  - {font}")

    if has_errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
