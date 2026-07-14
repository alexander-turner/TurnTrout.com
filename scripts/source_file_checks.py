# pylint: disable=C0302
"""Check source files for issues, like invalid links, missing required fields,
etc."""

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Literal, TypedDict

import requests

# Add the project root to sys.path
# pylint: disable=wrong-import-position
sys.path.append(str(Path(__file__).parent.parent))
# skipcq: FLK-E402
from scripts import utils as script_utils  # noqa: E402

MetadataIssues = dict[str, list[str]]
PathMap = dict[str, Path]  # Maps URLs to their source files

_http_session = script_utils.http_session()


class ForbiddenPatternConfig(TypedDict):
    """Configuration for a forbidden pattern check."""

    pattern: str
    ignore_math: bool
    ignore_code: bool


def check_required_fields(metadata: dict) -> list[str]:
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


def check_publication_date(metadata: dict) -> list[str]:
    """Check that date_published exists (skips pages with hide_metadata)."""
    if not metadata or metadata.get("hide_metadata"):
        return []
    if not metadata.get("date_published"):
        return ["Missing or empty date_published field"]
    return []


# Keys that have a canonical casing and must not appear in any other form.
# Maps the wrong variant → the correct canonical key name.
_FORBIDDEN_KEY_VARIANTS: dict[str, str] = {
    "date-published": "date_published",
    "date-updated": "date_updated",
}


def check_frontmatter_key_casing(metadata: dict) -> list[str]:
    """Check that frontmatter keys use the canonical casing convention."""
    errors = []
    for bad_key, canonical in _FORBIDDEN_KEY_VARIANTS.items():
        if bad_key in metadata:
            errors.append(
                f"Frontmatter key '{bad_key}' should be '{canonical}'"
            )
    return errors


def check_cover_image_alt(metadata: dict) -> list[str]:
    """If a card_image is specified, card_image_alt must also be provided."""
    errors: list[str] = []
    card_url = metadata.get("card_image")
    if not metadata or not metadata.get("card_image"):
        return errors

    # Check if there's a custom card_image
    card_image_alt = metadata.get("card_image_alt") or ""
    if not str(card_image_alt).strip():
        errors.append(f"Custom card_image ({card_url}) requires card_image_alt")

    return errors


def get_max_card_image_size_kb() -> int:
    """Get the max card image size from config."""
    constants = script_utils.load_shared_constants()
    return constants["maxCardImageSizeKb"]


def _check_card_image_domain(card_url: str) -> list[str]:
    """Check if card_image is from assets.turntrout.com."""
    if not card_url.startswith("https://assets.turntrout.com/"):
        return [
            f"card_image must be from assets.turntrout.com, but found: {card_url}"
        ]
    return []


def _check_card_image_format(card_url: str) -> list[str]:
    """Check if card_image has valid format (JPEG or PNG)."""
    allowed_extensions = {".jpg", ".jpeg", ".png"}
    if not any(card_url.endswith(ext) for ext in allowed_extensions):
        return [
            f"card_image should use JPEG (.jpg or .jpeg) or PNG (.png) format, "
            f"but found: {card_url}"
        ]
    return []


def _check_card_image_accessibility(card_url: str) -> list[str]:
    """
    Check if card_image URL is accessible and under size limit.

    This check is best-effort: network/SSL issues should not crash long-running
    asset pipelines.
    """
    errors: list[str] = []
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/58.0.3029.110 Safari/537.36"
            )
        }
        response = _http_session.head(
            card_url, timeout=30, allow_redirects=True, headers=headers
        )

        if not response.ok:
            errors.append(
                f"Card image URL '{card_url}' returned status {response.status_code}"
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
    except requests.RequestException as e:  # skipcq: PYL-W0706
        errors.append(f"Failed to load card image URL '{card_url}': {str(e)}")

    return errors


def check_card_image(metadata: dict) -> list[str]:
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

    errors: list[str] = []
    errors.extend(_check_card_image_domain(card_url))
    errors.extend(_check_card_image_format(card_url))
    errors.extend(_check_card_image_accessibility(card_url))
    return errors


def validate_video_tags(text: str) -> list[str]:
    """
    Validate that the video tag is valid.

    Returns:
        List of error messages for invalid video tags
    """
    issues = []
    for match in re.finditer(r"<video[^>]*\s(src|type)\s*=", text):
        issues.append(
            f"Video tag contains forbidden 'src' or 'type' attribute: {match.group()}"
        )
    return issues


def check_url_uniqueness(
    urls: set[str], existing_urls: PathMap, source_path: Path
) -> list[str]:
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


def get_all_urls(metadata: dict) -> set[str]:
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


def check_invalid_md_links(text: str, file_path: Path) -> list[str]:
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


def check_spaces_in_md_link_urls(text: str) -> list[str]:
    """
    Flag markdown link/image URLs that contain raw spaces.

    A space inside `](...)` makes the parser read the URL as ending at the
    space and try to treat the remainder as a link title. Since titles must be
    quoted, an unquoted URL with spaces is invalid and the whole construct
    renders as literal text. Spaces must be percent-encoded (`%20`).

    Valid forms are not flagged:
    - A quoted title after the URL: `[t](/url "the title")`
    - An angle-bracketed URL: `[t](</url with spaces>)`
    """
    stripped_text = remove_math(remove_code(text))
    errors = []
    # Capture the contents of the `(...)` in a `](...)` link target.
    for match in re.finditer(r"\]\(([^()\n]*)\)", stripped_text):
        target = match.group(1)
        url_part, _, rest = target.partition(" ")
        if " " not in target:
            continue
        # Angle-bracketed URLs may legally contain spaces.
        if url_part.startswith("<"):
            continue
        # A quoted title after the URL is legal; only the URL itself is checked.
        if re.fullmatch(r"\"[^\"]*\"|'[^']*'|\([^)]*\)", rest.strip()):
            continue
        line_num = stripped_text[: match.start()].count("\n") + 1
        errors.append(
            f"Markdown link URL contains spaces at line {line_num} "
            f"(percent-encode them as %20): {match.group()}"
        )
    return errors


def check_latex_tags(text: str, file_path: Path) -> list[str]:
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
) -> list[str]:
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
    permalink: str, sequence_data: dict[str, dict]
) -> list[str]:
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

    errors: list[str] = []
    current_mapping = sequence_data[permalink]
    # Compute all valid identifiers (permalink and aliases) for the current post
    valid_ids = {
        key for key, value in sequence_data.items() if value is current_mapping
    }

    direction_pairs: tuple[
        tuple[SequenceDirection, str], tuple[SequenceDirection, str]
    ] = (("next", "prev"), ("prev", "next"))
    for key, target_field_prefix in direction_pairs:
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
                key,
            )
        )

    return errors


def check_spaces_in_path(file_path: Path) -> list[str]:
    """Check if the file path contains spaces."""
    return ["File path contains spaces"] if " " in str(file_path) else []


def check_filename_lowercase(file_path: Path) -> list[str]:
    """
    Reject markdown filenames with uppercase letters.

    Uppercase characters in a content filename produce a per-filename HTML alias
    (`<Filename>.html`) alongside the canonical `<permalink>.html`. On case-
    insensitive filesystems (macOS APFS, default Windows NTFS), the two
    artifacts collapse into one when the build is extracted, and the alias
    redirect can clobber the canonical content non-deterministically.
    """
    if file_path.stem != file_path.stem.lower():
        return [f"Filename '{file_path.name}' must be lowercase."]
    return []


def check_table_alignments(text: str) -> list[str]:
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


def check_unescaped_braces(text: str) -> list[str]:
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


def check_no_forbidden_patterns(text: str) -> list[str]:
    """Check for forbidden patterns in text."""
    errors = []
    for config in _FORBIDDEN_PATTERNS:
        processed_text = text
        # `line_num` is derived from `processed_text`, so stripping below must
        # preserve newline counts for line numbers to match the original file.
        if config["ignore_code"]:
            processed_text = remove_code(processed_text, mark_boundaries=True)
        if config["ignore_math"]:
            processed_text = remove_math(processed_text, mark_boundaries=True)

        for match in re.finditer(config["pattern"], processed_text):
            line_num = processed_text[: match.start()].count("\n") + 1
            errors.append(
                f"Forbidden pattern found: {match.group()} on line {line_num}"
            )
    return errors


def check_stray_katex(text: str) -> list[str]:
    """Check for stray LaTeX commands outside of math/code blocks."""
    stripped_text = remove_math(remove_code(text))
    errors = []
    # This pattern finds a space followed by a backslash and a word.
    # e.g. " \command"
    pattern = r" (\\[a-zA-Z]+)"
    for match in re.finditer(pattern, stripped_text):
        errors.append(f"Stray LaTeX command found: {match.group().strip()}")
    return errors


def check_description_list_continuations(text: str) -> list[str]:
    """
    Check for improperly formatted description list continuations.

    In Markdown description lists, after a definition line (starting with `: `),
    if there's a blank line followed by another line starting with `: `, this is
    likely an error. Continuation paragraphs should be indented (typically 2 spaces)
    without the `:` prefix.

    Pattern that triggers error:
        : Definition text
        <blank line>
        : Another line starting with colon  <- Should be indented continuation

    Correct format:
        : Definition text
        <blank line>
          Indented continuation (no colon)

    Code and math blocks are ignored during checking.
    """
    # Remove code and math blocks while preserving line structure
    processed_text = remove_math(
        remove_code(text, mark_boundaries=True), mark_boundaries=True
    )

    errors = []
    lines = processed_text.split("\n")

    i = 0
    while i < len(lines) - 2:
        current = lines[i]
        next_line = lines[i + 1]
        line_after_next = lines[i + 2]

        # Check pattern: definition line -> blank line -> another `: ` line
        if (
            current.startswith(": ")
            and not next_line.strip()
            and line_after_next.startswith(": ")
        ):
            errors.append(
                f"Line {i + 3}: Description list continuation should be indented "
                f"(typically 2 spaces), not start with `: `. "
                f"Found: {line_after_next[:60]}..."
            )
            # Skip ahead to avoid duplicate errors
            i += 2
        else:
            i += 1

    return errors


def check_html_with_braces(text: str) -> list[str]:
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


def check_heading_links(text: str) -> list[str]:
    """
    Headings should not contain markdown links like [text](url).

    Instead, links should be moved to a "Subtitle:" line below the heading.
    """
    errors = []
    stripped_text = remove_code(text)
    # `[ \t]` (not `\s`) so the heading prefix can't consume newlines and
    # falsely match a link on a following paragraph when the heading itself
    # is empty after code-span stripping (e.g. `## \`pre-commit\``).
    pattern = r"^#{1,6}[ \t]+.*\[.*?\]\(.*$"

    for match in re.finditer(pattern, stripped_text, re.MULTILINE):
        line_num = stripped_text[: match.start()].count("\n") + 1
        heading_text = match.group().strip()
        errors.append(
            f"Heading contains markdown link at line {line_num}: {heading_text}"
        )

    return errors


# Sentence-case heading guard. See design.md ("Markdown syntax" checklist).
_HEADING_RE = re.compile(r"^#{1,6}[ \t]+(.+?)[ \t]*$", re.MULTILINE)
_HEADING_WORD_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9'’\-≠=]*")
# `N: ...` headings are chapter / narrative titles, which keep title case.
_NUMBERED_CHAPTER_RE = re.compile(r"^\s*\\?\d+\\?:\s")
# Leading list enumerators (`1.`, `(2)`) whose following word starts a sentence.
_ENUMERATOR_RE = re.compile(r"^\s*(?:\(\d+\)|\d+\\?\.)\s+")
# A new sentence begins after each of these, so the next word may be capitalized.
_HEADING_SENTENCE_SPLIT_RE = re.compile(r"[:.!?]")
_POSSESSIVE_RE = re.compile(r"['’][a-z]+$")


def _load_heading_case_config() -> tuple[frozenset[str], frozenset[str]]:
    """Load proper-noun and whole-heading allowlists from
    ``heading_case.json``."""
    config_path = Path(__file__).parent.parent / "config" / "heading_case.json"
    data = json.loads(config_path.read_text())
    return frozenset(data["proper_nouns"]), frozenset(data["allowed_headings"])


_HEADING_PROPER_NOUNS, _HEADING_ALLOWLIST = _load_heading_case_config()


def _heading_word_keeps_caps(word: str, proper_nouns: frozenset[str]) -> bool:
    """Whether a non-initial heading word may legitimately stay capitalized."""
    if any(char.isdigit() for char in word):
        return True  # model / version identifiers, e.g. GPT-2-XL, Llama-2-13B
    bare = _POSSESSIVE_RE.sub("", word.rstrip(".,?!:;"))
    leading_segment = bare.split("-")[0]
    if leading_segment.isalpha() and leading_segment.isupper():
        return True  # ACRONYM-prefixed compound, e.g. POWER-seeking, VNM-incoherence
    core = bare.replace("-", "").rstrip("s")
    if bare.isupper() or (core.isalpha() and core.isupper()):
        return True  # acronym, optionally pluralized: CSS, LLMs, AI's
    if not (word[0].isupper() and any(char.islower() for char in word)):
        return True  # not a Title-Case word in the first place
    return bare in proper_nouns


def _heading_case_offenders(
    heading: str, proper_nouns: frozenset[str]
) -> list[str]:
    """Title-Case words in ``heading`` that should be lowercase."""
    if _NUMBERED_CHAPTER_RE.match(heading):
        return []
    stripped = re.sub(r"\$[^$]*\$", " ", heading)
    stripped = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", stripped)
    stripped = stripped.replace("~~", "").replace("*", "").replace("_", "")
    stripped = _ENUMERATOR_RE.sub("", stripped)
    offenders = []
    for segment in _HEADING_SENTENCE_SPLIT_RE.split(stripped):
        words = _HEADING_WORD_RE.findall(segment)
        for index, word in enumerate(words):
            if index == 0 or not word[0].isalpha():
                continue  # first word of each sentence may be capitalized
            if not _heading_word_keeps_caps(word, proper_nouns):
                offenders.append(word)
    return offenders


def check_heading_case(
    text: str,
    proper_nouns: frozenset[str] = _HEADING_PROPER_NOUNS,
    allowed_headings: frozenset[str] = _HEADING_ALLOWLIST,
) -> list[str]:
    """
    Headings should use sentence case, not Title Case.

    Flags ATX headings with non-initial Title-Case words. The first word of
    each sentence (after ``:`` ``.`` ``?`` ``!`` or a list enumerator),
    acronyms, model/version names, and listed proper nouns stay capitalized.
    ``N: ...`` chapter headings and headings in ``allowed_headings`` (titles
    of cited works, product names, quoted terms) are exempt.
    """
    errors = []
    stripped_text = remove_code(text)
    for match in _HEADING_RE.finditer(stripped_text):
        heading = match.group(1).strip()
        if heading in allowed_headings:
            continue
        offenders = _heading_case_offenders(heading, proper_nouns)
        if offenders:
            line_num = stripped_text[: match.start()].count("\n") + 1
            errors.append(
                f"Heading should be sentence case at line {line_num}: "
                f"{heading!r} (should be lowercase: {', '.join(offenders)})"
            )
    return errors


def extract_footnote_line_numbers(text: str) -> dict[str, int]:
    """
    Extract all footnote definitions from text.

    Returns:
        Dictionary mapping footnote names to their line numbers.
        If a footnote is defined multiple times, only the first occurrence
        is recorded.
    """
    # Detect definitions on the same code/math-stripped text as
    # `extract_footnote_references`, so a `[^name]:` inside a code/math block is
    # not a real definition. Stripping preserves newline counts (line numbers).
    stripped_text = remove_math(remove_code(text))
    definition_pattern = r"\[\^([^\]]+)\]:"
    definitions: dict[str, int] = {}
    for match in re.finditer(definition_pattern, stripped_text):
        # setdefault keeps only the first definition of each footnote
        line = stripped_text[: match.start()].count("\n") + 1
        definitions.setdefault(match.group(1), line)
    return definitions


def extract_footnote_references(text: str) -> dict[str, int]:
    """
    Extract all footnote references from text, excluding definitions and content
    in code/math blocks.

    Returns:
        Dictionary mapping footnote names to their reference counts
    """
    # Remove code and math blocks to avoid false positives
    stripped_text = remove_math(remove_code(text))

    reference_pattern = r"\[\^([^\]]+)\]"
    references: dict[str, int] = {}
    for match in re.finditer(reference_pattern, stripped_text):
        footnote_name = match.group(1)
        # Skip if this is a definition (has colon after it)
        match_end = match.end()
        if match_end < len(stripped_text) and stripped_text[match_end] == ":":
            continue
        references[footnote_name] = references.get(footnote_name, 0) + 1
    return references


def check_footnote_references(text: str) -> list[str]:
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


_NON_VOID_ELEMENTS = frozenset(
    {
        "iframe",
        "div",
        "span",
        "textarea",
        "script",
        "style",
        "canvas",
        "video",
        "audio",
        "table",
        "select",
        "object",
    }
)

_SELF_CLOSING_NON_VOID_RE = re.compile(
    r"<(" + "|".join(_NON_VOID_ELEMENTS) + r")\b[^>]*/\s*>",
    re.IGNORECASE,
)


def check_self_closing_non_void_elements(text: str) -> list[str]:
    """
    Check for self-closing syntax on non-void HTML elements.

    Elements like `<iframe ... />` cause parsing bugs because the browser treats
    them as unclosed tags, swallowing subsequent content.  Only void elements
    (`<img>`, `<br>`, `<hr>`, etc.) may use self-closing syntax.
    """
    errors: list[str] = []
    for match in _SELF_CLOSING_NON_VOID_RE.finditer(text):
        # Skip matches inside code blocks (indented 4+ spaces or fenced)
        line_start = text.rfind("\n", 0, match.start()) + 1
        line_prefix = text[line_start : match.start()]
        if line_prefix.startswith("    ") or line_prefix.startswith("\t"):
            continue

        line_num = text[: match.start()].count("\n") + 1
        tag_name = match.group(1)
        errors.append(
            f"Self-closing <{tag_name} .../> at line {line_num}"
            f" (use <{tag_name} ...></{tag_name}> instead)"
        )
    return errors


_SENTENCE_INITIAL_NUMERAL_IGNORE = "lint-ignore sentence-initial-numeral"

# Quotes and closing brackets permitted between a sentence boundary and the
# leading digit: a closing quotation mark from the prior sentence, or an
# opening quotation mark that begins the new one. Opening "(" and "[" are
# excluded so parenthetical labels ("(1)") and citations ("[2]") are not read
# as prose numerals.
_LEADING_QUOTE_CHARS = "\"'“”‘’)\\]"

_SENTENCE_INITIAL_START_RE = re.compile(
    r"^\s*[" + _LEADING_QUOTE_CHARS + r"]*\d"
)
# A leading "(?<!\.)" keeps an ASCII ellipsis ("...") from registering as a
# sentence boundary; a Unicode ellipsis ("…") is not in "[.!?]" to begin with.
_SENTENCE_INITIAL_MID_RE = re.compile(
    r"(?<!\.)([.!?])[ \t]+[" + _LEADING_QUOTE_CHARS + r"]*\d"
)
_TRAILING_WORD_RE = re.compile(r"([A-Za-z.]+)$")
# A bullet or numbered enumerator, with or without inline body: an item whose
# text wraps to the next line leaves only the marker (``1.``) on this line, and
# that bare enumerator is not sentence-initial prose.
_LIST_MARKER_RE = re.compile(r"^\s*(?:[-*+]|\d+[.)])(?:\s+|$)")
_FOOTNOTE_DEFINITION_RE = re.compile(r"^\[\^[^\]]+\]:\s*")
# Leading markers that introduce authorial prose; each is stripped so the
# numeral check runs on the text the reader actually sees. A definition or
# subtitle line opens with ``:``.
_DEFINITION_PREFIX_RE = re.compile(r"^\s*:\s+")
_PROSE_MARKER_RES = (
    _FOOTNOTE_DEFINITION_RE,
    _LIST_MARKER_RE,
    _DEFINITION_PREFIX_RE,
)
# Lines that carry no authorial sentence-initial prose. Blockquotes (``>``,
# including ``[!quote]`` callouts) are verbatim quotations whose numerals must
# stay as written. Headings have their own style rule, table rows are data
# cells, and a leading ``![`` is a standalone image whose alt text is not body
# prose.
_NON_PROSE_PREFIXES = (">", "#", "|", "![")

# Abbreviations whose trailing period is not a sentence boundary, so a digit
# after them ("eq. 5", "e.g. 2", "Fig. 3") is not sentence-initial. Single
# letters and Roman numerals are excluded: they would suppress real boundaries
# ending in a capital letter ("Option B. 5 remain") more than they help.
_SENTENCE_END_ABBREVIATIONS = frozenset(
    """
    al et seq eq eqs ch chs fig figs no nos vol vols pp p pg pos sec secs
    thm thms def defs prop props lemma cor ref refs ie eg etc cf vs approx ca
    jan feb mar apr jun jul aug sep sept oct nov dec mr mrs ms dr prof
    inc cir
    """.split()
)


def _blank_frontmatter_lines(lines: list[str]) -> None:
    """
    Blank a leading YAML frontmatter block in place.

    Blanking (rather than removing) preserves line numbers for the body.
    """
    if lines[0] != "---":
        return
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            for j in range(i + 1):
                lines[j] = ""
            return


def _prose_content(line: str) -> str | None:
    """
    Return the rendered-prose portion of a line, or ``None`` if it has none.

    Structural markers that introduce authorial prose are stripped so the
    numeral check runs on what the reader actually sees: list bullets, numbered
    enumerators, definition/subtitle colons, and footnote-definition labels.
    Markers nest (a definition line may hold a numbered list, an enumerator a
    sub-list), so they are peeled off repeatedly until prose remains. Lines that
    carry no authorial prose return ``None``: blockquotes (verbatim
    quotations), headings, table rows, and standalone images, including when
    such a marker surfaces only after an outer marker is peeled away.
    """
    stripped = line.strip()
    while True:
        if not stripped or stripped.startswith(_NON_PROSE_PREFIXES):
            return None
        for marker in _PROSE_MARKER_RES:
            match = marker.match(stripped)
            if match:
                stripped = stripped[match.end() :].strip()
                break
        else:
            return stripped


def check_sentence_initial_numerals(text: str) -> list[str]:
    """
    Flag Arabic numerals that begin a sentence in prose.

    English style spells out numbers that open a sentence ("Twenty-six people
    attended", not "26 people attended"). This flags a digit at the start of a
    sentence in any rendered authorial prose: paragraphs, list items, numbered
    list content, definition/subtitle lines, and footnote-definition bodies.

    The leading structural marker of each context is stripped first, so a list
    bullet or numbered enumerator (a Markdown number, kept as written) does not
    itself trip the check. Code and math are blanked before checking, so a
    numeral rendered from a $\\KaTeX$ equation is also fine. Headings (which
    have their own style rule), tables, standalone image alt text, and
    blockquotes (``[!quote]`` callouts and ``>`` quotations, where numerals are
    verbatim) are excluded, as is a digit following an ellipsis (a trailing-off
    continuation, not a new sentence). A line carrying the
    "<!-- lint-ignore sentence-initial-numeral -->" marker is skipped so a
    deliberate leading numeral (e.g. one that refers to a literal figure) can be
    kept with a one-line reason.
    """
    stripped_text = remove_math(
        remove_code(text, mark_boundaries=True), mark_boundaries=True
    )
    lines = stripped_text.split("\n")
    _blank_frontmatter_lines(lines)

    errors: list[str] = []
    for line_num, line in enumerate(lines, 1):
        if _SENTENCE_INITIAL_NUMERAL_IGNORE in line:
            continue
        content = _prose_content(line)
        if content is None:
            continue
        if _SENTENCE_INITIAL_START_RE.match(content):
            errors.append(
                f"Sentence-initial numeral at line {line_num}: {content[:60]}"
            )
            continue
        for match in _SENTENCE_INITIAL_MID_RE.finditer(content):
            trailing = _TRAILING_WORD_RE.search(content[: match.start() + 1])
            word = (
                trailing.group(1).replace(".", "").lower() if trailing else ""
            )
            if word in _SENTENCE_END_ABBREVIATIONS:
                continue
            errors.append(
                f"Sentence-initial numeral at line {line_num}: "
                f"{content[max(0, match.start() - 20) : match.start() + 20]}"
            )
    return errors


_DATE_MONTH_NAMES = (
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Jun",
    "Jul",
    "Aug",
    "Sept",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
)

# Month name (optionally abbreviated with a trailing period), a 1-2 digit day
# with an optional ordinal suffix, and a 4-digit year. The suffix is captured
# so callers can tell "26" from "26th" instead of just matching the date.
_DATE_WITHOUT_ORDINAL_RE = re.compile(
    r"\b(?:" + "|".join(_DATE_MONTH_NAMES) + r")\.?\s+"
    r"\d{1,2}(st|nd|rd|th)?,?\s+\d{4}\b"
)

# Blockquotes, headings, tables, raw HTML, and standalone images either quote
# an external source verbatim or render structured/non-prose data, so their
# dates are left as written.
_DATE_NON_PROSE_PREFIXES = (">", "#", "|", "<", "![")


def check_dates_missing_ordinal_suffix(text: str) -> list[str]:
    """
    Flag written-out dates ("Month Day, Year") whose day lacks an ordinal suffix
    ("st"/"nd"/"rd"/"th").

    The site's date convention spells the day ordinally ("January 26th, 2026"),
    so a bare cardinal day ("January 26, 2026") is a formatting bug.
    """
    stripped_text = remove_math(remove_code(text))
    errors = []
    for line_num, line in enumerate(stripped_text.split("\n"), 1):
        stripped_line = line.strip()
        if not stripped_line or stripped_line.startswith(
            _DATE_NON_PROSE_PREFIXES
        ):
            continue
        for match in _DATE_WITHOUT_ORDINAL_RE.finditer(line):
            if match.group(1) is None:
                errors.append(
                    f"Date missing ordinal suffix at line {line_num}: "
                    f"{match.group().strip()}"
                )
    return errors


def check_file_data(
    metadata: dict,
    existing_urls: PathMap,
    file_path: Path,
    all_posts_metadata: dict[str, dict],
    *,
    check_publication_dates: bool = False,
) -> MetadataIssues:
    """
    Check a single file's metadata and content for various issues.

    Args:
        metadata: The file's frontmatter metadata
        existing_urls: Map of known URLs to their file paths
        file_path: Path to the file being checked
        all_posts_metadata: Map of file paths to their metadata for all posts
        check_publication_dates: If True, also check that date_published exists

    Returns:
        Dictionary mapping check names to lists of error messages
    """
    text = file_path.read_text()
    issues: MetadataIssues = {
        "required_fields": check_required_fields(metadata),
        "frontmatter_key_casing": check_frontmatter_key_casing(metadata),
        "cover_image_alt": check_cover_image_alt(metadata),
        "invalid_links": check_invalid_md_links(text, file_path),
        "spaces_in_link_urls": check_spaces_in_md_link_urls(text),
        "latex_tags": check_latex_tags(text, file_path),
        "table_alignments": check_table_alignments(text),
        "unescaped_braces": check_unescaped_braces(text),
        "video_tags": validate_video_tags(text),
        "forbidden_patterns": check_no_forbidden_patterns(text),
        "stray_katex": check_stray_katex(text),
        "description_list_continuations": check_description_list_continuations(
            text
        ),
        "html_braces": check_html_with_braces(text),
        "heading_links": check_heading_links(text),
        "heading_case": check_heading_case(text),
        "footnote_references": check_footnote_references(text),
        "self_closing_non_void": check_self_closing_non_void_elements(text),
        "sentence_initial_numerals": check_sentence_initial_numerals(text),
        "dates_missing_ordinal_suffix": check_dates_missing_ordinal_suffix(
            text
        ),
        "invalid_filename": (
            check_spaces_in_path(file_path)
            + check_filename_lowercase(file_path)
        ),
    }

    if check_publication_dates:
        issues["publication_date"] = check_publication_date(metadata)

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
    sass_path = shutil.which("sass")
    if sass_path is None:
        raise FileNotFoundError(
            "sass executable not found. Install it via pnpm."
        )

    result = subprocess.run(
        [sass_path, f"--load-path={styles_dir}", str(scss_file_path)],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


_FONT_FACE_FAMILY_PATTERN = re.compile(
    r"""@font-face\s*\{[^}]*?
    font-family:\s*["']?(.*?)["']?[;,]""",
    re.VERBOSE | re.DOTALL,
)

_FONT_FACE_SRC_PATTERN = re.compile(
    r"@font-face\s*\{[^}]*?"
    r"src:\s*url\(\s*[\"']?(.*?)[\"']?\)\s*"
    r"(?:format\([^\)]*\)\s*)?"
    r"[^;]*;",
    re.DOTALL,
)


def check_font_files(css_content: str, base_dir: Path) -> list[str]:
    """
    Check if font files referenced in CSS exist.

    Args:
        css_content: Compiled CSS content
        base_dir: Base directory for resolving font paths

    Returns:
        List of missing font file paths
    """
    missing_fonts = []
    for match in _FONT_FACE_SRC_PATTERN.finditer(css_content):
        font_path = match.group(1)
        if font_path.startswith(("http:", "https:", "data:")):
            continue

        if font_path.startswith("/static/"):
            font_path = f"/quartz{font_path}"

        full_path = (base_dir / font_path.lstrip("/")).resolve()
        if not full_path.is_file():
            missing_fonts.append(font_path)

    return missing_fonts


def check_font_families(css_content: str) -> list[str]:
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
    declared_fonts = {
        clean_font_name(match.group(1))
        for match in _FONT_FACE_FAMILY_PATTERN.finditer(css_content)
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


def check_scss_font_files(scss_file_path: Path, base_dir: Path) -> list[str]:
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


def build_sequence_data(markdown_files: list[Path]) -> dict[str, dict]:
    """Build a mapping of post slugs to their forward and previous post
    slugs."""
    all_sequence_data: dict[str, dict] = {}
    for file_path in markdown_files:
        metadata, _ = script_utils.split_yaml(file_path)
        if metadata:
            # Build a mapping with only the forward and previous post slugs
            slug_mapping: dict[str, str] = {}
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
                # ``aliases`` may be a single scalar string or a list; normalize
                # to a list so a scalar isn't iterated character-by-character.
                if isinstance(aliases, str):
                    aliases = [aliases]
                for alias in aliases:
                    if not alias:
                        continue
                    all_sequence_data[alias] = slug_mapping

    return all_sequence_data


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Check source files for issues."
    )
    parser.add_argument(
        "--check-publication-dates",
        action="store_true",
        help="Check that all posts have a date_published field (used in CI)",
    )
    return parser.parse_args()


def main(check_publication_dates: bool = False) -> None:
    """Check source files for issues."""
    git_root = script_utils.get_git_root()
    content_dir = git_root / script_utils.CONTENT_DIR_NAME
    existing_urls: PathMap = {}
    has_errors = False

    # Check markdown files
    markdown_files = script_utils.get_files(
        dir_to_search=content_dir,
        filetypes_to_match=(".md",),
        use_git_ignore=True,
        ignore_dirs=["templates", "drafts", "partials"],
    )

    # mapping from permalink or alias to its forward and prev post slugs
    all_sequence_data: dict[str, dict] = build_sequence_data(
        list(markdown_files)
    )

    for file_path in markdown_files:
        metadata, _ = script_utils.split_yaml(file_path)
        if metadata:
            rel_path = file_path.relative_to(git_root)
            issues = check_file_data(
                metadata,
                existing_urls,
                file_path,
                all_sequence_data,
                check_publication_dates=check_publication_dates,
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
    args = parse_args()
    main(check_publication_dates=args.check_publication_dates)
