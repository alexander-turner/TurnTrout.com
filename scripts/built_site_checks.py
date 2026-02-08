# pylint: disable=C0302
"""Script to check the built static site for common issues and errors."""

import argparse
import copy
import html
import os
import re
import subprocess
import sys
import urllib.parse
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, Iterable, Literal, NamedTuple, Set
from urllib.parse import urlparse

import requests  # type: ignore[import]
import tqdm
import validators  # type: ignore[import]
from bs4 import BeautifulSoup, NavigableString, PageElement, Tag

# Add the project root to sys.path
# pylint: disable=C0413
sys.path.append(str(Path(__file__).parent.parent))

# skipcq: FLK-E402
# skipcq: FLK-E402
from scripts import compress, source_file_checks
from scripts import utils as script_utils
from scripts.utils import (
    ELLIPSIS,
    LEFT_DOUBLE_QUOTE,
    LEFT_SINGLE_QUOTE,
    NBSP,
    RIGHT_DOUBLE_QUOTE,
    RIGHT_SINGLE_QUOTE,
    ZERO_WIDTH_NBSP,
    ZERO_WIDTH_SPACE,
)

_GIT_ROOT = script_utils.get_git_root()
_PUBLIC_DIR: Path = _GIT_ROOT / "public"
RSS_XSD_PATH = _GIT_ROOT / "scripts" / ".rss-2.0.xsd"

_IssuesDict = Dict[str, list[str] | list[Tag] | bool]

# Define the parser but don't parse immediately
parser = argparse.ArgumentParser(
    description="Check the built static site for issues."
)
parser.add_argument(
    "--check-fonts",
    action="store_true",
    default=False,
    help="Enable checking for preloaded fonts",
)


def _tags_only(
    seq: Iterable[PageElement | Tag | NavigableString],
) -> list[Tag]:
    return [el for el in seq if isinstance(el, Tag)]


_css_variable_declaration_pattern = re.compile(r"(--[\w-]+)\s*:")
_css_variable_usage_pattern = re.compile(r"var\((--[\w-]+)\)")


def _get_defined_css_variables(css_file_path: Path) -> Set[str]:
    """Extract all defined CSS variable names from a CSS file."""
    defined_vars: Set[str] = set()

    css_content = css_file_path.read_text(encoding="utf-8")
    for match in _css_variable_declaration_pattern.finditer(css_content):
        defined_vars.add(match.group(1))

    return defined_vars


def check_inline_style_variables(
    soup: BeautifulSoup, defined_variables: Set[str] | None = None
) -> list[str]:
    """Check elements for inline styles using undefined CSS variables."""
    issues: list[str] = []

    for element in _tags_only(soup.find_all(style=True)):
        style_attr = element.get("style", "")
        if not isinstance(style_attr, str):  # pragma: no cover
            raise ValueError(f"{style_attr=} was a list for some reason")

        used_vars = set(_css_variable_usage_pattern.findall(style_attr))
        for var in used_vars - (defined_variables or set()):
            _append_to_list(
                issues,
                f"Element <{element.name}> uses undefined CSS variable "
                f"'{var}' in inline style: "
                f"'{style_attr}'",
            )
    return issues


def check_localhost_links(soup: BeautifulSoup) -> list[str]:
    """Check for localhost links in the HTML."""
    localhost_links = []
    links = _tags_only(soup.find_all("a", href=True))
    for link in links:
        href = str(link["href"])
        if href.startswith(
            ("localhost:", "http://localhost", "https://localhost")
        ):
            localhost_links.append(href)
    return localhost_links


def check_favicons_missing(soup: BeautifulSoup) -> bool:
    """Check if favicons are missing."""
    return not soup.select("article p img.favicon, article p svg.favicon")


def check_article_dropcap_first_letter(soup: BeautifulSoup) -> list[str]:
    """Unless `data-use-dropcap="false"`, require `data-first-letter` to contain
    an alphanumeric character."""

    issues: list[str] = []
    for article in soup.find_all("article"):
        if article.get("data-use-dropcap") == "false":
            continue

        p = article.find("p", recursive=False)
        if not isinstance(p, Tag) or not p.get_text(strip=True):
            continue

        first = p.get("data-first-letter", "")
        if not isinstance(first, str) or len(first) != 1:
            issues.append(
                f"invalid data-first-letter length (expected 1): {first!r}"
            )
            continue
        if not first[0].isalnum():
            issues.append(f"non-alphanumeric data-first-letter: {first!r}")

    return issues


VALID_PARAGRAPH_ENDING_CHARACTERS = ".!?:;)]}’”…—"
TRIM_CHARACTERS_FROM_END_OF_PARAGRAPH = "↗✓∎"


def check_top_level_paragraphs_end_with_punctuation(
    soup: BeautifulSoup,
) -> list[str]:
    """Check that every top-level paragraph in an article ends with a
    punctuation mark."""
    issues: list[str] = []

    for article in soup.find_all("article"):
        paragraphs = article.find_all("p", recursive=False)
        for p in paragraphs:
            if not isinstance(p, Tag):
                continue
            classes = script_utils.get_classes(p)
            if (
                "subtitle" in classes
                or "page-listing-title" in classes
                or p.find(class_="transclude")
            ):
                continue

            # Remove footnote reference links
            p_copy = copy.copy(p)
            for link in p_copy.find_all("a", id=True):
                link_id = link.get("id", "")
                if isinstance(link_id, str) and link_id.startswith(
                    "user-content-fnref-"
                ):
                    link.decompose()

            text = p_copy.get_text(strip=True).rstrip(
                TRIM_CHARACTERS_FROM_END_OF_PARAGRAPH
            )
            if not text:
                continue

            # Strip zero-width spaces and other invisible characters
            text = text.replace(ZERO_WIDTH_SPACE, "")
            text = text.replace(ZERO_WIDTH_NBSP, "")
            text = text.strip()
            if not text:
                continue

            if text[-1] not in VALID_PARAGRAPH_ENDING_CHARACTERS:
                _append_to_list(
                    issues,
                    text,
                    prefix=f"Paragraph ends with invalid character '{text[-1]}' ",
                )

    return issues


def check_unrendered_footnotes(soup: BeautifulSoup) -> list[str]:
    """
    Check for unrendered footnotes in the format [^something].

    Returns a list of the footnote references themselves.
    """
    footnote_pattern = r"\[\^[a-zA-Z0-9-_]+\]"
    unrendered_footnotes = []

    for p in soup.find_all("p"):
        matches = re.findall(footnote_pattern, p.text)
        if matches:
            unrendered_footnotes.extend(matches)

    return unrendered_footnotes


def _check_anchor_classes(
    link: Tag, href: str, invalid_anchors: list[str]
) -> None:
    """
    Check if a same-page anchor link has the required classes. Updates
    `invalid_anchors` with errors if the link is missing classes.

    NOTE: Only checks links that literally start with "#".
     Not all same-page links are specified like that.
    """
    classes = set(script_utils.get_classes(link))

    # Skip accessibility skip-to-content link (not a content link)
    if "skip-to-content" in classes:
        return

    required_classes = {"internal", "same-page-link"}
    if not required_classes.issubset(classes):
        missing = required_classes - classes
        sorted_missing = sorted(missing)
        _append_to_list(
            invalid_anchors,
            href,
            prefix=f"Anchor missing classes {sorted_missing}: ",
        )


def check_invalid_internal_links(soup: BeautifulSoup) -> list[Tag]:
    """
    Check for links which do not have an href attribute, or which start with
    "https://".
    """
    invalid_internal_links = []
    links = _tags_only(soup.find_all("a", class_="internal"))
    for link in links:
        if not isinstance(link, Tag):  # pragma: no cover
            continue  # just a typeguard
        if (
            not link.has_attr("href")
            or not isinstance(link["href"], str)
            or link["href"].startswith("https://")
        ):
            invalid_internal_links.append(link)

    return invalid_internal_links


def check_invalid_anchors(soup: BeautifulSoup, base_dir: Path) -> list[str]:
    """Check for invalid internal anchor links in the HTML."""
    invalid_anchors: list[str] = []
    links = _tags_only(soup.find_all("a", href=True))
    for link in links:
        href = link["href"]
        if not isinstance(href, str):  # pragma: no cover
            raise ValueError(f"{href=} should be a str")

        if href.startswith("#"):
            # Check anchor in current page
            anchor_id = href[1:]
            if not soup.find(id=anchor_id):
                _append_to_list(
                    invalid_anchors,
                    href,
                    prefix="Invalid anchor: ",
                )

            _check_anchor_classes(link, href, invalid_anchors)

        elif (href.startswith("/") or href.startswith(".")) and "#" in href:
            # Check anchor validity in other internal pages
            page_path, anchor = href.split("#", 1)

            # Remove leading ".." from page_path
            page_path = page_path.lstrip("./")
            full_path = base_dir / page_path
            if not full_path.suffix == ".html":
                full_path = full_path.with_suffix(".html")

            if full_path.is_file():
                with open(full_path, encoding="utf-8") as f:
                    page_soup = BeautifulSoup(f.read(), "html.parser")
                if not page_soup.find(id=anchor):
                    _append_to_list(
                        invalid_anchors,
                        href,
                        prefix="Invalid anchor: ",
                    )
            else:
                _append_to_list(
                    invalid_anchors,
                    href,
                    prefix="Invalid anchor: ",
                )  # Page doesn't exist
    return invalid_anchors


# Check that no blockquote element ends with ">",
# because it probably needed a newline before it
def check_blockquote_elements(soup: BeautifulSoup) -> list[str]:
    r"""Check for blockquote elements ending with ">" as long as they don't end
    in a "<\w+>" pattern."""
    problematic_blockquotes: list[str] = []
    blockquotes = soup.find_all("blockquote")
    for blockquote in blockquotes:
        contents = list(blockquote.stripped_strings)
        if contents:
            last_part = contents[-1].strip()
            if last_part.endswith(">") and not re.search(r"<\w+>$", last_part):
                _append_to_list(
                    problematic_blockquotes,
                    " ".join(contents),
                    prefix="Problematic blockquote: ",
                )
    return problematic_blockquotes


def check_unrendered_html(soup: BeautifulSoup) -> list[str]:
    """
    Check for unrendered HTML in the page.

    Looks for text content containing HTML-like patterns (<tag>, </tag>, or
    <tag/>) that should have been rendered by the markdown processor.
    """
    problematic_texts: list[str] = []

    # Basic HTML tag pattern
    tag_pattern = r"(</?[a-zA-Z][a-zA-Z0-9]*(?: |/?>))"

    for element in soup.find_all(string=True):
        if isinstance(element, NavigableString) and not should_skip(element):
            text = element.strip()
            if text:
                # Look for HTML-like patterns
                matches = re.findall(tag_pattern, text)
                if matches:
                    _append_to_list(
                        problematic_texts,
                        text,
                        prefix=f"Unrendered HTML {matches}: ",
                    )

    return problematic_texts


def _append_to_list(
    lst: list[str],
    text: str,
    show_end: bool = False,
    preview_chars: int = 100,
    prefix: str = "",
) -> None:
    """Append a text string to a list, truncating if necessary."""
    if preview_chars <= 0:
        raise ValueError("preview_chars must be greater than 0")

    if not text:
        return

    to_append = text
    if len(text) > preview_chars:
        to_append = (
            text[-preview_chars:] + "..." if show_end else text[:preview_chars]
        )

    lst.append(prefix + to_append)


_S = f"[ {NBSP}]"  # Space or non-breaking space
_CANARY_BAD_ANYWHERE = (
    rf">{_S}\[\![a-zA-Z]+\]",  # Callout syntax
    rf"\[{_S}\]",  # Unrendered checkbox
    rf"Table:{_S}",
    rf"Figure:{_S}",
    rf"Code:{_S}",
    rf"Caption:{_S}",
)
_CANARY_BAD_PREFIXES = (
    rf":{_S}",  # Unrendered description
    r"#",  # Unrendered heading
    # image alt declaration, may contain 0width space
    rf"\[(\s|{ZERO_WIDTH_SPACE})*\]",
)


def _append_canary_matches(
    check_text: str, lst: list[str], report_text: str | None = None
) -> None:
    """
    Check if element text contains canary phrases and add to results.

    Args:
        check_text: Text to check for patterns
            (may contain placeholders for code).
            This preserves text positions to avoid false positives when code
            appears before patterns like ": ".
        lst: List to append problematic text to.
        report_text: Optional text to report in error messages
            (without placeholders). If None, check_text is reported.
            Use this to show clean text without code placeholder
            characters in error output.
    """
    stripped_check = check_text.strip()
    if not stripped_check:
        return

    bad_anywhere_matches = any(
        re.search(pattern, stripped_check) for pattern in _CANARY_BAD_ANYWHERE
    )
    # Check if bad_prefix appears at start of ANY loose text fragment
    bad_prefix_matches = any(
        re.search(rf"^{prefix}", stripped_check, re.MULTILINE)
        for prefix in _CANARY_BAD_PREFIXES
    )
    if bad_anywhere_matches or bad_prefix_matches:
        text_to_report = report_text if report_text is not None else check_text
        _append_to_list(
            lst,
            text_to_report.strip(),
            prefix="Problematic paragraph: ",
        )


def paragraphs_contain_canary_phrases(soup: BeautifulSoup) -> list[str]:
    """
    Check for text-containing elements with specific canary phrases.

    Checks complete text content of elements in the document. Ignores text
    within <code> tags and <svg> tags.
    """
    problematic_paragraphs: list[str] = []

    # Check complete text of paragraph-level elements
    for element in _tags_only(
        soup.find_all(["p", "li", "dd", "dt", "figcaption"])
    ):
        if any(parent.name in ("code", "svg") for parent in element.parents):
            continue

        # Check with placeholders, report without code
        check_text = script_utils.get_non_code_text(
            element, replace_with_placeholder=True
        )
        report_text = script_utils.get_non_code_text(
            element, replace_with_placeholder=False
        )
        _append_canary_matches(check_text, problematic_paragraphs, report_text)

    # Check for loose text fragments in containers
    # Example: (article, section, div, blockquote)
    # that aren't inside proper paragraph-level elements
    for container in _tags_only(
        soup.find_all(["article", "section", "div", "blockquote"])
    ):
        for child in container.children:
            if not isinstance(child, NavigableString):
                continue
            text = str(child).strip()
            if not text or any(
                parent.name in ("code", "svg", "script", "style")
                for parent in container.parents
            ):
                continue
            _append_canary_matches(text, problematic_paragraphs)

    return problematic_paragraphs


def check_unrendered_spoilers(soup: BeautifulSoup) -> list[str]:
    """Check for unrendered spoilers."""
    unrendered_spoilers: list[str] = []
    blockquotes = _tags_only(soup.find_all("blockquote"))
    for blockquote in blockquotes:
        # Check each paragraph / text child in the blockquote
        for child in _tags_only(blockquote.children):
            if child.name == "p":
                text = child.get_text().strip()
                if text.startswith("! "):
                    _append_to_list(
                        unrendered_spoilers,
                        text,
                        prefix="Unrendered spoiler: ",
                    )
    return unrendered_spoilers


def check_unrendered_transclusions(soup: BeautifulSoup) -> list[str]:
    """Check for link elements whose text starts with "Transclude of"."""
    unrendered_transclusions: list[str] = []
    links = _tags_only(soup.find_all("a"))
    for link in links:
        text = link.get_text().strip()
        if text.startswith("Transclude of"):
            _append_to_list(
                unrendered_transclusions,
                text,
                prefix="Unrendered transclusion: ",
            )
    return unrendered_transclusions


# ASCII emoticons that should be converted to twemoji by TextFormattingImprovement
# Note: We use capturing groups instead of variable-width lookbehind since Python's
# re module doesn't support `(?<= |^)` (alternation makes lookbehind variable-width)
_UNRENDERED_EMOTICON_PATTERN = re.compile(
    r"(?:^| )(;\)|:\)|:\()(?= |$)", re.MULTILINE
)


def check_unrendered_emoticons(soup: BeautifulSoup) -> list[str]:
    """
    Check for ASCII emoticons that should have been converted to twemoji.

    The TextFormattingImprovement transformer converts :), ;), and :( to their
    corresponding Unicode emoji when surrounded by spaces or at string
    boundaries.
    """
    unrendered_emoticons: list[str] = []

    for element in soup.find_all(string=True):
        if not isinstance(element, NavigableString):  # pragma: no cover
            continue
        if element.strip() and not should_skip(element):
            matches = _UNRENDERED_EMOTICON_PATTERN.findall(str(element))
            if matches:
                _append_to_list(
                    unrendered_emoticons,
                    str(element),
                    prefix=f"Unrendered emoticon {matches}: ",
                )

    return unrendered_emoticons


def check_unrendered_subtitles(soup: BeautifulSoup) -> list[str]:
    """Check for unrendered subtitle lines."""
    unrendered_subtitles: list[str] = []
    paragraphs = _tags_only(soup.find_all("p"))
    for p in paragraphs:
        text = p.get_text().strip()
        classes = script_utils.get_classes(p)
        if text.startswith("Subtitle:") and "subtitle" not in classes:
            _append_to_list(
                unrendered_subtitles, text, prefix="Unrendered subtitle: "
            )
    return unrendered_subtitles


# Check the existence of local files with these extensions
_MEDIA_EXTENSIONS = list(compress.ALLOWED_EXTENSIONS) + [
    ".svg",
    ".avif",
    ".ico",
]


def resolve_media_path(src: str, base_dir: Path) -> Path:
    """
    Resolve a media file path, trying both absolute and relative paths.

    Args:
        src: The source path from the HTML tag
        base_dir: The base directory to resolve paths from

    Returns:
        The resolved Path object
    """
    if src.startswith("/"):
        return (base_dir / src.lstrip("/")).resolve()

    # For relative paths, try both direct and with base_dir
    full_path = (base_dir / src).resolve()
    if not full_path.is_file():
        # Try relative to base_dir
        full_path = (base_dir / src.lstrip("./")).resolve()

    return full_path


ALLOWED_ASSET_DOMAINS = {"assets.turntrout.com"}


def check_media_asset_sources(soup: BeautifulSoup) -> list[str]:
    """
    Check that media assets (images, SVGs, videos) are only hosted from allowed
    sources.

    Returns:
        list of asset URLs that are not from allowed sources
    """
    invalid_sources = []
    media_tags = soup.find_all(["img", "video", "source", "svg"])

    for tag in _tags_only(media_tags):
        src = tag.get("src") or tag.get("href")
        str_src = str(src) if src else ""
        # Skip relative paths
        if not str_src or str_src.startswith(("/", ".", "..")):
            continue

        # Check if source is from allowed domain
        if (
            "//" not in str_src
            or str_src.split("/")[2] not in ALLOWED_ASSET_DOMAINS
        ):
            invalid_sources.append(f"{src} (in {tag.name} tag)")

    return invalid_sources


def check_local_media_files(soup: BeautifulSoup, base_dir: Path) -> list[str]:
    """Verify the existence of local media files (images, videos, SVGs)."""
    missing_files = []
    media_tags = soup.find_all(["img", "video", "source", "svg"])

    for tag in _tags_only(media_tags):
        src = str(tag.get("src") or tag.get("href"))
        if src and not src.startswith(("http://", "https://")):
            # It's a local file
            file_extension = Path(src).suffix.lower()
            if file_extension in _MEDIA_EXTENSIONS:
                full_path = resolve_media_path(src, base_dir)
                if not full_path.is_file():
                    missing_files.append(f"{src} (resolved to {full_path})")

    return missing_files


def check_asset_references(
    soup: BeautifulSoup, file_path: Path, base_dir: Path
) -> list[str]:
    """Check for asset references and verify their existence."""
    missing_assets = []

    def resolve_asset_path(href: str) -> Path:
        if href.startswith("/"):
            # Absolute path within the site
            return (base_dir / href.lstrip("/")).resolve()
        # Relative path
        return (file_path.parent / href).resolve()

    def check_asset(href: str) -> None:
        if href and not href.startswith(("http://", "https://")):
            full_path = resolve_asset_path(href)
            if not full_path.is_file():
                missing_assets.append(f"{href} (resolved to {full_path})")

    # Check link tags for CSS files (including preloaded stylesheets)
    for link in _tags_only(soup.find_all("link")):
        rel = link.get("rel", "") or ""
        if isinstance(rel, list):
            rel = " ".join(rel)
        if "stylesheet" in rel or (
            "preload" in rel and link.get("as") == "style"
        ):
            href_val = link.get("href")
            if href_val:
                check_asset(str(href_val))

    # Check script tags for JS files
    for script in _tags_only(soup.find_all("script", src=True)):
        check_asset(str(script["src"]))

    return missing_assets


def check_images_have_dimensions(soup: BeautifulSoup) -> list[str]:
    """
    Check that all images have explicit width and height attributes.

    This prevents layout shift and catches cases where sizing is missing
    (e.g., inline favicons that render at their natural large size).

    Returns:
        list of image descriptions missing width/height attributes
    """
    issues: list[str] = []

    for img in _tags_only(soup.find_all("img")):
        width = img.get("width")
        height = img.get("height")

        if width and height:
            continue

        missing = []
        if not width:
            missing.append("width")
        if not height:
            missing.append("height")

        src = img.get("src")
        issues.append(f"<img> missing {', '.join(missing)}: {src}")

    return issues


def check_katex_elements_for_errors(soup: BeautifulSoup) -> list[str]:
    """Check for KaTeX elements with color #cc0000."""
    problematic_katex: list[str] = []
    katex_elements = soup.select(".katex-error")
    for element in katex_elements:
        content = element.get_text().strip()
        _append_to_list(problematic_katex, content, prefix="KaTeX error: ")
    return problematic_katex


def katex_element_surrounded_by_blockquote(soup: BeautifulSoup) -> list[str]:
    """
    Check for KaTeX display elements that start with '>>' but aren't inside a
    blockquote.

    These mathematical statements should be inside a blockquote.
    """
    problematic_katex: list[str] = []

    # Find all KaTeX display elements
    katex_displays = soup.find_all(class_="katex-display")
    for katex in katex_displays:
        content = katex.get_text().strip()
        # Check if content starts with '>' and isn't inside a blockquote
        if content.startswith(">"):
            _append_to_list(problematic_katex, content, prefix="KaTeX error: ")

    return problematic_katex


def check_critical_css(soup: BeautifulSoup) -> bool:
    """Check if the page has exactly one critical CSS block in the head."""
    head = soup.find("head")
    if isinstance(head, Tag):
        critical_css_blocks = head.find_all("style", {"id": "critical-css"})
        return len(critical_css_blocks) == 1
    return False


def check_duplicate_ids(soup: BeautifulSoup) -> list[str]:
    r"""
    Check for duplicate anchor IDs in the HTML.

    Returns a list of:
    - IDs that appear multiple times
    - IDs existing with and without -\d suffix (e.g., 'intro' and 'intro-1')
    Excludes IDs within mermaid flowcharts.
    """
    # Get all IDs except those in flowcharts
    elements_with_ids = [
        element["id"]
        for element in _tags_only(soup.find_all(id=True))
        if not element.find_parent(class_="flowchart")
    ]

    # Count occurrences of each ID
    id_counts = Counter(elements_with_ids)
    duplicates = []

    # Check for both duplicates and numbered variants
    for id_, count in id_counts.items():
        # It's ok for multiple fnrefs to reference the same note
        if not isinstance(id_, str) or id_.startswith("user-content-fnref-"):
            continue

        if count > 1:
            duplicates.append(f"{id_} (found {count} times)")

        # Check if this is a base ID with numbered variants
        if not re.search(r".*-\d+$", id_):  # If this is not a numbered ID
            numbered_variants = [
                other_id
                for other_id in id_counts
                if isinstance(other_id, str)
                and other_id.startswith(id_ + "-")
                and re.search(r".*-\d+$", other_id)
            ]
            if numbered_variants:
                total = count + sum(
                    id_counts[variant] for variant in numbered_variants
                )
                duplicates.append(
                    f"{id_} (found {total} times, including numbered variants)"
                )

    return duplicates


EMPHASIS_ELEMENTS_TO_SEARCH = (
    "p",
    "dt",
    "figcaption",
    "dd",
    "li",
    *(f"h{i}" for i in range(1, 7)),
)


def check_unrendered_emphasis(soup: BeautifulSoup) -> list[str]:
    """
    Check for any unrendered emphasis characters (* or _) in text content.
    Excludes code blocks, scripts, styles, and KaTeX elements. Also excludes
    paragraphs inside .authors elements (author name* indicates equal credit).

    Args:
        soup: BeautifulSoup object to check

    Returns:
        list of strings containing problematic text with emphasis characters
    """
    problematic_texts: list[str] = []

    for text_elt in _tags_only(soup.find_all(EMPHASIS_ELEMENTS_TO_SEARCH)):
        # Author name* means shared first authorship
        if text_elt.name == "p" and text_elt.find_parent(class_="authors"):
            continue

        # Get text excluding code and KaTeX elements
        stripped_text = script_utils.get_non_code_text(text_elt)

        if stripped_text and (
            re.search(rf"\*|\_(?!\_*[ {NBSP}]+\%)", stripped_text)
        ):
            _append_to_list(
                problematic_texts,
                stripped_text,
                show_end=True,
                prefix="Unrendered emphasis: ",
            )

    return problematic_texts


def should_skip(element: Tag | NavigableString) -> bool:
    """Check if element should be skipped based on
    formatting_improvement_html.ts rules."""
    skip_tags = {"code", "pre", "script", "style"}
    skip_classes = {
        "no-formatting",
        "elvish",
        "bad-handwriting",
        "katex",
    }

    # Check current element and all parents
    current: Tag | NavigableString | None = element
    while current:
        if isinstance(
            current, Tag
        ):  # Only check Tag elements, not NavigableString
            classes = script_utils.get_classes(current)
            if current.name in skip_tags or any(
                class_ in classes for class_ in skip_classes
            ):
                return True
        current = current.parent if isinstance(current.parent, Tag) else None
    return False


def check_unprocessed_quotes(soup: BeautifulSoup) -> list[str]:
    """
    Check for text nodes containing straight quotes (" or ') that should have
    been processed by formatting_improvement_html.ts.

    Skips nodes that would be skipped by the formatter:
    - Inside code, pre, script, style tags
    - Elements with classes: no-formatting, elvish, bad-handwriting
    """
    problematic_quotes: list[str] = []

    # Check all text nodes
    for element in soup.find_all(string=True):
        if not isinstance(element, NavigableString):  # pragma: no cover
            continue
        if element.strip() and not should_skip(element):
            straight_quotes = re.findall(r'["\']', str(element))
            if straight_quotes:
                _append_to_list(
                    problematic_quotes,
                    str(element),
                    prefix=f"Unprocessed quotes {straight_quotes}: ",
                )

    return problematic_quotes


def check_unprocessed_dashes(soup: BeautifulSoup) -> list[str]:
    """Check for text nodes containing multiple dashes (-- or ---) that should
    have been processed into em dashes by formatting_improvement_html."""
    problematic_dashes: list[str] = []

    for element in soup.find_all(string=True):
        if not isinstance(element, NavigableString):  # pragma: no cover
            continue
        if element.strip() and not should_skip(element):
            # Look for two or more dashes in a row
            if re.search(r"[~\–\—\-\–]{2,}", str(element)):
                _append_to_list(
                    problematic_dashes,
                    str(element),
                    prefix="Unprocessed dashes: ",
                )

    return problematic_dashes


# NOTE that this is in bytes, not characters
MAX_META_HEAD_SIZE = 9 * 1024  # 9 instead of 10 to avoid splitting tags


def meta_tags_early(file_path: Path) -> list[str]:
    """
    Check that meta and title tags are NOT present between MAX_HEAD_SIZE and
    </head>. EG Facebook only checks the first 10KB.

    Args:
        file_path: Path to the HTML file to check

    Returns:
        list of tags found after MAX_HEAD_SIZE but before </head>
    """
    issues: list[str] = []

    # Read entire HTML content first.
    # skipcq: PTC-W6004 - Only used for checks, not user-facing
    with open(file_path, "rb") as f:
        content_bytes = f.read()

    # If file is smaller than MAX_META_HEAD_SIZE, no issues possible
    if len(content_bytes) <= MAX_META_HEAD_SIZE:
        return []

    # Convert the first chunk and remainder to strings
    content = content_bytes.decode("utf-8")

    # Find where the byte boundary falls in terms of characters
    boundary_content = content_bytes[:MAX_META_HEAD_SIZE].decode("utf-8")
    char_boundary = len(boundary_content)

    # Consider everything past the byte boundary
    remainder = content[char_boundary:]

    # If no </head>, our checks don't apply
    if "</head>" not in remainder:
        return []

    # Only look up to the closing </head>
    head_content = remainder.split("</head>")[0]

    # Look for <meta ...> or <title ...> within that region
    for tag in ("meta", "title"):
        # Matches <meta ...> or </meta>, similarly for <title ...> or </title>
        pattern = rf"<{tag}[^>]*>"
        for match in re.finditer(pattern, head_content):
            tag_text = match.group(0)
            issues.append(
                f"<{tag}> tag found after first "
                f"{MAX_META_HEAD_SIZE // 1024}KB: {tag_text}"
            )

    return issues


def check_iframe_sources(soup: BeautifulSoup) -> list[str]:
    """Check that all iframe sources are responding with a successful status
    code."""
    problematic_iframes = []
    iframes = _tags_only(soup.find_all("iframe"))

    for iframe in iframes:
        src = iframe.get("src")
        if not src or not isinstance(src, str):
            continue

        if src.startswith("//"):
            src = "https:" + src
        elif src.startswith("/") or src.startswith("."):
            continue  # Skip relative paths as they're checked by other fns

        title: str = str(iframe.get("title", ""))
        alt: str = str(iframe.get("alt", ""))
        description: str = f"{title=} ({alt=})"
        try:
            response = requests.head(src, timeout=10)
            if not response.ok:
                problematic_iframes.append(
                    f"Iframe source {src} returned status "
                    f"{response.status_code}. "
                    f"Description: {description}"
                )
        except requests.RequestException as e:
            problematic_iframes.append(
                f"Failed to load iframe source {src}: {str(e)}. "
                f"Description: {description}"
            )

    return problematic_iframes


def check_iframe_embeds(soup: BeautifulSoup) -> list[str]:
    """Check that iframe embeds are structurally valid and accessible."""
    problematic_embeds: list[str] = []

    for iframe in _tags_only(soup.find_all("iframe")):
        src_attr = iframe.get("src")
        if not isinstance(src_attr, str) or not src_attr.strip():
            problematic_embeds.append("Iframe missing 'src' attribute")
            continue

        normalized_src = src_attr.strip()
        if normalized_src.startswith("//"):
            normalized_src = "https:" + normalized_src

        # Validate external endpoints when possible
        if validators.url(normalized_src):
            try:
                response = requests.head(normalized_src, timeout=10)
                if not response.ok:
                    problematic_embeds.append(
                        f"Iframe embed returned status {response.status_code}"
                        f": {normalized_src}"
                    )
            except requests.RequestException as exc:
                problematic_embeds.append(
                    f"Failed to load iframe embed {normalized_src}: {exc}"
                )
        # Relative or non-URL embeds are assumed to be internal and skipped

    return problematic_embeds


def check_consecutive_periods(soup: BeautifulSoup) -> list[str]:
    """
    Check for consecutive periods in text content, including cases where they're
    separated by quotation marks.

    Returns:
        list of strings containing problematic text with consecutive periods
    """
    problematic_texts: list[str] = []

    for element in soup.find_all(string=True):
        if not isinstance(element, NavigableString):  # pragma: no cover
            continue
        if element.strip() and not should_skip(element):
            # Look for two periods with optional quote marks between
            if re.search(
                rf'(?!\.\.\?)\.["{LEFT_DOUBLE_QUOTE}{RIGHT_DOUBLE_QUOTE}]*\.',
                str(element),
            ):
                _append_to_list(
                    problematic_texts,
                    str(element),
                    prefix="Consecutive periods found: ",
                )

    return problematic_texts


# Tengwar fonts use Private Use Area U+E000-U+E07F
# Valid Tengwar text can also contain punctuation and whitespace
_TENGWAR_VALID_PATTERN = re.compile(
    r"^[\uE000-\uE07F\s⸱:.!,;?'\"()\[\]<>—–-]*$"
)


def check_tengwar_characters(soup: BeautifulSoup) -> list[str]:
    """
    Check that Quenya (lang="qya") text only contains valid Tengwar characters.

    Tengwar fonts use Private Use Area characters U+E000-U+E07F.
    If other characters appear (like arrows ⤴ or ⇔), it indicates
    text processing corruption.

    Returns:
        list of strings describing invalid Tengwar text
    """
    issues: list[str] = []

    # Find all elements with Quenya language attribute
    for element in _tags_only(soup.find_all(attrs={"lang": "qya"})):
        text = element.get_text()
        if not text.strip() or _TENGWAR_VALID_PATTERN.match(text):
            continue

        # Find the invalid characters for debugging
        invalid_chars = set()
        for char in text:
            if not re.match(r"[\uE000-\uE07F\s⸱:.!,;?'\"()\[\]<>—–-]", char):
                invalid_chars.add(f"{char} (U+{ord(char):04X})")

        # Sort for deterministic output
        sorted_chars = sorted(invalid_chars)
        _append_to_list(
            issues,
            f"Invalid chars {sorted_chars} in Tengwar: {text[:50]}...",
        )

    return issues


def _has_no_favicon_span_ancestor(favicon: Tag) -> bool:
    """Check if favicon has an ancestor with .no-favicon-span class."""
    return any(
        "no-favicon-span" in script_utils.get_classes(parent)
        for parent in favicon.parents
        if isinstance(parent, Tag)
    )


def _get_favicons_to_check(soup: BeautifulSoup) -> list[Tag]:
    """Get all favicons that should be checked (excluding .no-favicon-span)."""
    all_favicons = soup.select("img.favicon, svg.favicon")
    return [
        favicon
        for favicon in all_favicons
        if not _has_no_favicon_span_ancestor(favicon)
    ]


def check_favicon_parent_elements(soup: BeautifulSoup) -> list[str]:
    """
    Check that all img.favicon and svg.favicon elements are direct children of
    span elements.

    Returns:
        list of strings describing favicons that are not direct
         children of span elements.
    """
    problematic_favicons: list[str] = []

    favicons_to_check = _get_favicons_to_check(soup)

    contexts = [
        (
            (favicon.get("src", "unknown source"), "Favicon ({ctx})", favicon)
            if favicon.name == "img"
            else (
                favicon.get("data-domain", "unknown domain"),
                "SVG favicon ({ctx})",
                favicon,
            )
        )
        for favicon in favicons_to_check
    ]

    for context, info_template, favicon in contexts:
        parent = favicon.parent
        if (
            not parent
            or parent.name != "span"
            or "favicon-span" not in script_utils.get_classes(parent)
        ):
            info = (
                info_template.format(ctx=context)
                + " is not a direct child of a span.favicon-span."
            )
            if parent:
                info += " Instead, it's a child of "
                info += f"<{parent.name}>: {parent.get_text()}"
            problematic_favicons.append(info)

    return problematic_favicons


def check_favicons_are_svgs(soup: BeautifulSoup) -> list[str]:
    """
    Check that all favicons are svg.favicon elements with mask-url pointing to
    SVG.

    Validates that:
    1. No img.favicon elements exist (all should be svg.favicon with mask-url)
    2. All svg.favicon elements have style attribute with --mask-url
    3. All --mask-url values point to .svg files

    Returns:
        list of strings describing favicon issues.
    """
    non_svg_favicons: list[str] = []

    # Check for any img.favicon elements (should not exist)
    img_favicons = soup.select("img.favicon")
    for favicon in img_favicons:
        src = favicon.get("src", "")
        non_svg_favicons.append(
            f"img.favicon found (should be svg.favicon with mask-url): {src}"
        )

    # Check svg.favicon elements (mask-based)
    svg_favicons = soup.select("svg.favicon:not(.no-mask)")
    for favicon in svg_favicons:
        style = favicon.get("style")
        # skipcq: PTC-W0048
        if not style or not isinstance(style, str) or not style.strip():
            non_svg_favicons.append(
                f"SVG favicon missing style attribute: {favicon}"
            )
            continue

        # Extract URL from --mask-url: url(...)
        mask_url_match = re.search(r"--mask-url:\s*url\(([^)]+)\)", style)
        if not mask_url_match:
            non_svg_favicons.append(
                f"SVG favicon missing --mask-url in style: {style}"
            )
            continue

        mask_url = mask_url_match.group(1).strip()
        parsed_url = urllib.parse.urlparse(mask_url)
        ext = Path(parsed_url.path).suffix
        if ext.lower() != ".svg":
            non_svg_favicons.append(f"Non-SVG mask favicon found: {mask_url}")

    return non_svg_favicons


def _check_populate_commit_count(
    soup: BeautifulSoup, *, min_commit_count: int
) -> list[str]:
    """Check that the rendered commit count looks reasonable."""
    issues: list[str] = []

    for element in _tags_only(soup.select(".populate-commit-count")):
        raw = element.get_text(strip=True)
        if not raw:
            continue

        try:
            commit_count = int(raw.replace(",", ""))
        except ValueError:
            _append_to_list(
                issues, f"populate-commit-count is not an integer: {raw!r}"
            )
            continue

        if commit_count < min_commit_count:
            _append_to_list(
                issues,
                f"populate-commit-count too small: {commit_count} (< {min_commit_count})",
            )

    return issues


_SELF_CONTAINED_ELEMENTS = frozenset(
    {
        "svg",
        "img",
        "video",
        "audio",
        "iframe",
        "object",
        "embed",
        "canvas",
        "picture",
    }
)


def _has_content(element: Tag) -> bool:
    """
    Check if an element has meaningful content.

    An element is considered to have content if it has:
    - Non-whitespace text content, OR
    - Self-contained media/visual elements (svg, img, video, etc.)
      that don't require text content to be meaningful

    Note: Structural elements like ul, div, span without text or media
    are still considered empty, as they need their own content.
    """
    if element.get_text(strip=True):
        return True
    # Recursively check for self-contained elements (svg, img, video, etc.)
    return element.find(_SELF_CONTAINED_ELEMENTS) is not None


def check_populate_elements_nonempty(soup: BeautifulSoup) -> list[str]:
    """Check for issues with elements whose IDs or classes start with
    `populate-`."""

    issues: list[str] = []

    # Generic: any populate-* element must not be empty
    for element in _tags_only(soup.find_all()):
        element_id = element.get("id")
        if (
            isinstance(element_id, str)
            and element_id.startswith("populate-")
            and not _has_content(element)
        ):
            _append_to_list(
                issues, f"<{element.name}> with id='{element_id}' is empty"
            )

        element_classes = element.get("class")
        if isinstance(element_classes, list):
            for class_name in element_classes:
                if class_name.startswith("populate-") and not _has_content(
                    element
                ):
                    _append_to_list(
                        issues,
                        f"<{element.name}> with class='{class_name}' is empty",
                    )
                    break

    issues.extend(_check_populate_commit_count(soup, min_commit_count=5000))

    return issues


def check_preloaded_fonts(soup: BeautifulSoup) -> bool:
    """
    Check if the page preloads the EBGaramond font via subfont.

    Returns True if at least one preload link for EBGaramond subfont is found,
    False otherwise.
    """
    head = soup.find("head")
    if not isinstance(head, Tag):
        return False

    preload_links = head.find_all("link", {"rel": "preload", "as": "font"})
    for link in _tags_only(preload_links):
        href = str(link.get("href", ""))
        if "subfont/ebgaramond" in href.lower():
            return True

    return False


def check_malformed_hrefs(soup: BeautifulSoup) -> list[str]:
    """Check for syntactically malformed href attributes in `<a>` tags using the
    `validators` library."""
    malformed_links: list[str] = []
    for link in _tags_only(soup.find_all("a", href=True)):
        href = link.get("href")
        if not isinstance(href, str):  # pragma: no cover
            continue  # a simple typeguard
        if href.startswith("mailto:"):
            email = href.split(":")[1]
            if not validators.email(email):
                _append_to_list(
                    malformed_links,
                    href,
                    prefix="Syntactically invalid email: ",
                )
            continue

        # Ignore browser-specific about: URLs
        if href.startswith(("about:", "http://about:", "https://about:")):
            continue

        classes = script_utils.get_classes(link)
        if (
            "external" not in classes
            or not href
            or href.startswith(("/", "#", ".", "tel:"))
        ):
            continue

        # Allow spaces in URLs for readability
        if not validators.url(href) and " " not in href:
            _append_to_list(
                malformed_links, href, prefix="Syntactically invalid href: "
            )

    return malformed_links


def check_katex_span_only_paragraph_child(soup: BeautifulSoup) -> list[str]:
    """Check for <p> elements that only contain a single <span class="katex">
    child."""
    problematic_paragraphs: list[str] = []
    paragraphs = _tags_only(soup.find_all("p"))
    for p_tag in paragraphs:
        significant_children = [
            child
            for child in p_tag.children
            if not (isinstance(child, NavigableString) and not child.strip())
        ]
        if len(significant_children) != 1 or not isinstance(
            significant_children[0], Tag
        ):
            continue

        child = significant_children[0]
        classes: list[str] = script_utils.get_classes(child)

        if child.name == "span" and "katex" in classes:
            _append_to_list(
                problematic_paragraphs,
                str(p_tag),
                prefix="Paragraph with only KaTeX span: ",
            )
    return problematic_paragraphs


def check_html_tags_in_text(soup: BeautifulSoup) -> list[str]:
    """
    Check for HTML closing tags in non-code text elements and KaTeX math
    elements.

    This catches cases where HTML tags were incorrectly inserted into text
    content, such as when text transformers add spans before HTML parsing.
    """
    issues: list[str] = []
    html_tag_pattern = re.compile(r"</[a-z]+>")

    # Check all text elements (paragraphs, list items, etc.)
    text_elements = soup.find_all(
        ["p", "li", "td", "th", "dd", "dt", "h1", "h2", "h3", "h4", "h5", "h6"]
    )
    for element in text_elements:
        text_content = script_utils.get_non_code_text(
            element, replace_with_placeholder=False
        )
        matches = html_tag_pattern.findall(text_content)
        if matches:
            _append_to_list(
                issues,
                f"Found HTML tags in text: {matches} in element: {str(element)[:100]}...",
            )

    katex_elements = soup.find_all(class_="katex")
    for katex in katex_elements:
        text_content = katex.get_text()
        matches = html_tag_pattern.findall(text_content)
        if matches:
            _append_to_list(
                issues,
                f"Found HTML tags in KaTeX: {matches} in: {text_content[:100]}...",
            )

    return issues


def _untransform_text(label: str) -> str:
    lower_label = label.lower()
    quote_chars = f"['{LEFT_SINGLE_QUOTE}{RIGHT_SINGLE_QUOTE}{LEFT_DOUBLE_QUOTE}{RIGHT_DOUBLE_QUOTE}]"
    simple_quotes_label = re.sub(quote_chars, '"', lower_label)
    unescaped_label = html.unescape(simple_quotes_label)
    normalized_spaces = unescaped_label.replace(NBSP, " ")
    return normalized_spaces.strip()


def check_metadata_matches(soup: BeautifulSoup, md_path: Path) -> list[str]:
    """Check that the metadata in the HTML file matches the metadata in the
    markdown file."""
    problematic_metadata: list[str] = []
    md_metadata: dict[str, str] = script_utils.split_yaml(md_path)[0]

    for md_attr, html_attr, html_field in [
        ("title", "title", ""),
        ("description", "description", "name"),
        ("title", "og:title", "property"),
        ("description", "og:description", "property"),
    ]:
        md_value = md_metadata[md_attr]
        md_value = _untransform_text(md_value)

        html_value = None
        if html_attr == "title":
            html_value_tag = soup.find("title")
            if isinstance(html_value_tag, Tag):
                html_value = _untransform_text(html_value_tag.get_text())
        else:
            html_value_tag = soup.find("meta", {html_field: html_attr})
            if isinstance(html_value_tag, Tag):
                html_value = _untransform_text(
                    str(html_value_tag.get("content"))
                )

        if md_value != html_value:
            problematic_metadata.append(
                f"{html_attr} mismatch: {md_value} != {html_value}"
            )

    return problematic_metadata


def check_file_for_issues(
    file_path: Path,
    base_dir: Path,
    md_path: Path | None,
    should_check_fonts: bool,
    defined_css_variables: Set[str] | None = None,
) -> _IssuesDict:
    """
    Check a single HTML file for various issues.

    Args:
        file_path: Path to the HTML file to check
        base_dir: Path to the base directory of the site
        md_path: Path to the markdown file that generated the HTML file
        should_check_fonts: Whether to check for preloaded fonts
        defined_css_variables: Set of defined CSS variables

    Returns:
        Dictionary of issues found in the HTML file
    """
    soup = script_utils.parse_html_file(file_path)
    if script_utils.is_redirect(soup):
        return {}
    initial_soup_str = str(soup)

    issues: _IssuesDict = {
        "localhost_links": check_localhost_links(soup),
        "invalid_internal_links": check_invalid_internal_links(soup),
        "invalid_anchors": check_invalid_anchors(soup, base_dir),
        "malformed_hrefs": check_malformed_hrefs(soup),
        "problematic_paragraphs": paragraphs_contain_canary_phrases(soup),
        "missing_media_files": check_local_media_files(soup, base_dir),
        "trailing_blockquotes": check_blockquote_elements(soup),
        "missing_assets": check_asset_references(soup, file_path, base_dir),
        "problematic_katex": check_katex_elements_for_errors(soup),
        "unrendered_subtitles": check_unrendered_subtitles(soup),
        "unrendered_footnotes": check_unrendered_footnotes(soup),
        "missing_critical_css": not check_critical_css(soup),
        "empty_body": script_utils.body_is_empty(soup),
        "duplicate_ids": check_duplicate_ids(soup),
        "unrendered_spoilers": check_unrendered_spoilers(soup),
        "unrendered_emphasis": check_unrendered_emphasis(soup),
        "katex_outside_blockquote": katex_element_surrounded_by_blockquote(
            soup
        ),
        "unprocessed_quotes": check_unprocessed_quotes(soup),
        "unprocessed_dashes": check_unprocessed_dashes(soup),
        "unrendered_html": check_unrendered_html(soup),
        "emphasis_spacing": check_emphasis_spacing(soup),
        "link_spacing": check_link_spacing(soup),
        "long_description": check_description_length(soup),
        "late_header_tags": meta_tags_early(file_path),
        "problematic_iframes": check_iframe_sources(soup),
        "consecutive_periods": check_consecutive_periods(soup),
        "invalid_favicon_parents": check_favicon_parent_elements(soup),
        "non_svg_favicons": check_favicons_are_svgs(soup),
        "katex_span_only_par_child": check_katex_span_only_paragraph_child(
            soup
        ),
        "html_tags_in_text": check_html_tags_in_text(soup),
        "unrendered_transclusions": check_unrendered_transclusions(soup),
        "unrendered_emoticons": check_unrendered_emoticons(soup),
        "invalid_media_asset_sources": check_media_asset_sources(soup),
        "images_missing_dimensions": check_images_have_dimensions(soup),
        "video_source_order_and_match": check_video_source_order_and_match(
            soup
        ),
        "inline_style_variables": check_inline_style_variables(
            soup, defined_css_variables
        ),
        "problematic_iframe_embeds": check_iframe_embeds(soup),
        "empty_populate_elements": check_populate_elements_nonempty(soup),
        "invalid_dropcap_first_letter": check_article_dropcap_first_letter(
            soup
        ),
        "paragraphs_without_ending_punctuation": check_top_level_paragraphs_end_with_punctuation(
            soup
        ),
        "invalid_tengwar_characters": check_tengwar_characters(soup),
    }

    if should_check_fonts:
        issues["missing_preloaded_font"] = not check_preloaded_fonts(soup)

    if md_path and md_path.is_file():
        issues["missing_markdown_assets"] = check_markdown_assets_in_html(
            soup, md_path
        )
        issues["metadata_mismatch"] = check_metadata_matches(soup, md_path)

    if file_path.name == "about.html":  # Not all pages need to be checked
        issues["missing_favicon"] = check_favicons_missing(soup)

    if str(soup) != initial_soup_str:
        raise RuntimeError(
            "BeautifulSoup object was modified by check_file_for_issues."
        )
    return issues


def check_rss_file_for_issues(
    git_root_path: Path, custom_xsd_path: Path | None = None
) -> None:
    """
    Check an RSS file for various issues.

    Uses xmllint via `brew install libxml2`.
    """
    rss_path = git_root_path / "public" / "rss.xml"
    subprocess.run(
        [
            "/usr/bin/xmllint",
            "--noout",
            "--schema",
            str(custom_xsd_path or RSS_XSD_PATH),
            str(rss_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _print_issues(  # pragma: no cover
    file_path: Path,
    issues: _IssuesDict,
) -> None:
    """Print issues found in a file."""
    if any(lst for lst in issues.values()):
        print(f"Issues found in {file_path}:")
        for issue, lst in issues.items():
            if lst:
                if isinstance(lst, list):
                    print(f"  {issue}:")
                    for item in lst:
                        print(f"    - {item}")
                elif isinstance(lst, bool):
                    print(f"  {issue}: {lst}")

        print()  # Add a blank line between files with issues


def _strip_path(path_str: str) -> str:
    """Strip the git root path from a path string."""
    beginning_stripped = re.sub(
        r"^ *(\.{1,2}((?=\/asset_staging)"
        r"|\/(?!asset_staging)))?(/asset_staging/)?",
        "",
        path_str,
    )
    return re.sub(r" +$", "", beginning_stripped)


_TAGS_TO_CHECK_FOR_MISSING_ASSETS = ("img", "video", "svg", "audio", "source")


def get_md_asset_counts(md_path: Path) -> Counter[str]:
    """Get the counts of all assets referenced in the markdown file."""
    # skipcq: PTC-W6004, it's just serverside open -- not user-facing
    with open(md_path, encoding="utf-8") as f:
        content = f.read()

    no_code_content = source_file_checks.remove_code(content)
    trimmed_content = source_file_checks.remove_math(no_code_content)

    # Match ![alt](src) pattern, capturing the src
    md_pattern_assets = re.findall(r"!\[.*?\]\((.*?)\)", trimmed_content)

    # Match HTML tags with src attributes
    possible_tag_pattern = rf"{'|'.join(_TAGS_TO_CHECK_FOR_MISSING_ASSETS)}"
    tag_pattern = rf"<(?:{possible_tag_pattern}) [^>]*?src=[\"'](.*?)[\"']"
    tag_pattern_assets = re.findall(tag_pattern, trimmed_content)

    return Counter(
        _strip_path(asset) for asset in md_pattern_assets + tag_pattern_assets
    )


def check_markdown_assets_in_html(
    soup: BeautifulSoup, md_path: Path
) -> list[str]:
    """
    Check that all assets referenced in the markdown source appear in the HTML
    at least as many times as they appear in the markdown.

    Args:
        soup: BeautifulSoup object of the HTML content
        md_path: Path to the markdown file that generated the HTML file

    Returns:
        list of asset references that have fewer instances in HTML
    """
    if not md_path.exists():
        raise FileNotFoundError(f"Markdown file {md_path} does not exist")

    md_asset_counts = get_md_asset_counts(md_path)

    # Count asset sources in HTML
    html_asset_counts: Counter[str] = Counter()
    for tag in _TAGS_TO_CHECK_FOR_MISSING_ASSETS:
        for element in _tags_only(soup.find_all(tag)):
            if src := element.get("src"):
                html_asset_counts[_strip_path(str(src))] += 1

    # Check each markdown asset exists in HTML with sufficient count
    missing_assets = []
    for asset, md_count in md_asset_counts.items():
        html_count = html_asset_counts[asset]
        if html_count < md_count:
            missing_assets.append(
                f"Asset {asset} appears {md_count} times in markdown "
                f"but only {html_count} times in HTML"
            )

    return missing_assets


def check_spacing(
    element: Tag,
    allowed_chars: str,
    prefix: Literal["before", "after"],
) -> list[str]:
    """Check spacing between element and a sibling."""
    sibling = (
        element.previous_sibling if prefix == "before" else element.next_sibling
    )
    if not isinstance(sibling, NavigableString) or not sibling.strip():
        return []

    # Properly escape characters for regex pattern
    ok_chars = "".join([re.escape(c) for c in allowed_chars])
    ok_regex_chars = rf"[{ok_chars}]"
    ok_regex_expr = (
        rf"^.*{ok_regex_chars}$"
        if prefix == "before"
        else rf"^{ok_regex_chars}.*$"
    )

    if not re.search(ok_regex_expr, sibling, flags=re.MULTILINE):
        preview = f"<{element.name}>{element.get_text()}</{element.name}>"
        if prefix == "before":
            preview = f"{sibling.get_text()}{preview}"
        else:
            preview = f"{preview}{sibling.get_text()}"

        return [f"Missing space {prefix}: {preview}"]
    return []


ALLOWED_ELT_PRECEDING_CHARS = (
    "[({-—~×" + LEFT_DOUBLE_QUOTE + LEFT_SINGLE_QUOTE + "=+' \n\t\r" + NBSP
)
ALLOWED_ELT_FOLLOWING_CHARS = (
    "])}.,;!?:-—~×+"
    + RIGHT_DOUBLE_QUOTE
    + RIGHT_SINGLE_QUOTE
    + ELLIPSIS
    + "=' \n\t\r"
    + NBSP
)


def _check_element_spacing(
    element: Tag,
    prev_allowed_chars: str,
    next_allowed_chars: str,
) -> list[str]:
    """
    Helper function to check spacing around HTML elements.

    Args:
        element: The HTML element to check
        prev_allowed_chars: Characters allowed before the element without space
        next_allowed_chars: Characters allowed after the element without space

    Returns:
        list of strings describing spacing issues
    """
    return check_spacing(element, prev_allowed_chars, "before") + check_spacing(
        element, next_allowed_chars, "after"
    )


def check_link_spacing(soup: BeautifulSoup) -> list[str]:
    """
    Check for non-footnote links that don't have proper spacing with surrounding
    text.

    Links should have a space before them unless preceded by specific
    characters.
    """
    problematic_links: list[str] = []

    # Find all links that aren't footnotes
    for link in _tags_only(soup.find_all("a")):
        # Skip footnote links
        href = link.get("href", "")
        if not isinstance(href, str) or href.startswith("#user-content-fn"):
            continue

        problematic_links.extend(
            _check_element_spacing(
                link, ALLOWED_ELT_PRECEDING_CHARS, ALLOWED_ELT_FOLLOWING_CHARS
            )
        )

    return problematic_links


# Whitelisted emphasis patterns that should be ignored
# If both prev and next are in the whitelist, then the emphasis is whitelisted
WHITELISTED_EMPHASIS = {
    ("Some", ""),  # For e.g. "Some<i>one</i>"
}


def check_emphasis_spacing(soup: BeautifulSoup) -> list[str]:
    """
    Check for emphasis/strong elements that don't have proper spacing with
    surrounding text.

    Ignores specific whitelisted cases.
    """
    problematic_emphasis: list[str] = []

    # Find all emphasis elements
    for element in _tags_only(soup.find_all(["em", "strong", "i", "b", "del"])):
        # Check if this is a whitelisted case
        prev_sibling = element.previous_sibling
        next_sibling = element.next_sibling

        if isinstance(prev_sibling, NavigableString) and isinstance(
            next_sibling, NavigableString
        ):
            prev_text = prev_sibling.strip()
            current_text = element.get_text(strip=True)

            # Check for exact matches in whitelisted cases
            is_whitelisted = False
            for prev, next_ in WHITELISTED_EMPHASIS:
                if prev_text.endswith(prev) and current_text.startswith(next_):
                    is_whitelisted = True
                    break
            if is_whitelisted:
                continue

        problematic_emphasis.extend(
            _check_element_spacing(
                element,
                ALLOWED_ELT_PRECEDING_CHARS,
                ALLOWED_ELT_FOLLOWING_CHARS,
            )
        )

    return problematic_emphasis


# Facebook recommends descriptions under 155 characters
MAX_DESCRIPTION_LENGTH = 155
MIN_DESCRIPTION_LENGTH = 10


def check_description_length(soup: BeautifulSoup) -> list[str]:
    """
    Check if the page description is within the recommended length for social
    media previews.

    Returns a list with a single string if the description is too long, or an
    empty list otherwise.
    """
    description_element = soup.find("meta", attrs={"name": "description"})
    description = (
        description_element.get("content")
        if description_element and isinstance(description_element, Tag)
        else None
    )

    if description:
        if len(description) > MAX_DESCRIPTION_LENGTH:
            return [
                f"Description too long: {len(description)} characters "
                f"(recommended <= {MAX_DESCRIPTION_LENGTH})"
            ]
        if len(description) < MIN_DESCRIPTION_LENGTH:
            return [
                f"Description too short: {len(description)} characters "
                f"(recommended >= {MIN_DESCRIPTION_LENGTH})"
            ]
        return []
    return ["Description not found"]


def check_css_issues(file_path: Path) -> list[str]:
    """Check for CSS issues in a file."""
    if not file_path.exists():
        return [f"CSS file {file_path} does not exist"]
    with open(file_path, encoding="utf-8") as f:
        content = f.read()
        if not re.search(r"@supports", content):
            return [
                f"CSS file {file_path.name} does not contain @supports,"
                " which is required for dropcaps in Firefox"
            ]
    return []


def _validate_source_type(
    type_attr: str | list[str] | None,
    expected_type: str,
    source_index: int,
    video_preview: str,
) -> list[str]:
    """Validate the type attribute of a <source> tag."""
    issues: list[str] = []
    if (
        not isinstance(type_attr, str)
        or type_attr.lower() != expected_type.lower()
    ):
        issues.append(
            f"Video source {source_index} type != '{expected_type}':"
            f" {video_preview} (got '{type_attr}')"
        )
    return issues


IssuesAndMaybeSrc = NamedTuple(
    "IssuesAndMaybeSrc", [("issues", list[str]), ("valid_src", str | None)]
)


def _validate_source_src(
    src_attr: str | list[str] | None,
    expected_ext: str,
    source_index: int,
    video_preview: str,
) -> IssuesAndMaybeSrc:
    """Validate the src attribute of a <source> tag."""
    issues: list[str] = []
    if not isinstance(src_attr, str):
        _append_to_list(
            issues,
            f"Video source {source_index} 'src' missing or not a string:"
            f" {video_preview}",
        )
        return IssuesAndMaybeSrc(issues, None)

    # Parse URL to ignore query/fragment for extension check
    parsed_src = urlparse(src_attr)
    path_only = parsed_src.path
    _, ext = os.path.splitext(path_only)
    if ext.lower() != expected_ext.lower():
        issues.append(
            f"Video source {source_index} 'src'"
            f" does not end with {expected_ext}: "
            f"'{src_attr}' in {video_preview}"
        )
        validated_src = None
    else:
        validated_src = src_attr  # Store the original src if valid

    return IssuesAndMaybeSrc(issues, validated_src)


def _validate_single_source_tag(
    source_tag: Tag,
    expected_type: str,
    expected_ext: str,
    source_index: int,
    video_preview: str,
) -> IssuesAndMaybeSrc:
    """Validate a single <source> tag using helper functions."""
    type_issues = _validate_source_type(
        source_tag.get("type"), expected_type, source_index, video_preview
    )
    src_issues, valid_src = _validate_source_src(
        source_tag.get("src"), expected_ext, source_index, video_preview
    )

    all_issues = type_issues + src_issues
    src_to_return = valid_src if not all_issues else None
    return IssuesAndMaybeSrc(all_issues, src_to_return)


def _compare_base_paths(src1: str, src2: str, video_preview: str) -> list[str]:
    """Compare the base paths (including query strings) of two source URLs."""
    paths = {}
    for source_idx, src in enumerate([src1, src2]):
        parsed = urlparse(src)
        base_path, _ = os.path.splitext(parsed.path)
        paths[source_idx] = base_path + (
            f"?{parsed.query}" if parsed.query else ""
        )

    if paths[0] != paths[1]:
        return [
            f"Video source base paths mismatch: '{paths[0]}'"
            f" vs '{paths[1]}' in {video_preview}"
        ]
    return []


def _check_single_video(
    video: Tag, expected_sources: list[tuple[str, str]]
) -> list[str]:
    """Checks a single <video> tag for source order, type, and matching base
    paths."""
    issues: list[str] = []
    sources = [
        child
        for child in video.children
        if isinstance(child, Tag) and child.name == "source"
    ]
    open_tag = str(video).split(">", 1)[0] + ">"

    if len(sources) < len(expected_sources):
        _append_to_list(
            issues,
            f"<video> tag has < {len(expected_sources)}"
            f" <source> children: {open_tag}",
        )
        return issues  # Cannot proceed if sources are missing

    all_sources_valid = True
    valid_srcs: list[str | None] = []

    for source_idx, (expected_type, expected_ext) in enumerate(
        expected_sources
    ):
        source_issues, valid_src = _validate_single_source_tag(
            sources[source_idx],
            expected_type,
            expected_ext,
            source_idx + 1,
            open_tag,
        )
        issues.extend(source_issues)
        valid_srcs.append(valid_src)
        if not valid_src:
            all_sources_valid = False

    if all_sources_valid:
        comparison_issues = _compare_base_paths(
            valid_srcs[0] or "",
            valid_srcs[1] or "",
            open_tag,
        )
        issues.extend(comparison_issues)

    return issues


def _should_skip_video(video: Tag) -> bool:
    """Check if a <video> tag should be skipped."""
    return not isinstance(video, Tag) or video.get("id") == "pond-video"


def check_video_source_order_and_match(soup: BeautifulSoup) -> list[str]:
    """Check <video> elements have the MP4 <source> tag first, then the WEBM
    <source> tag, with matching base src."""
    all_issues: list[str] = []
    expected_sources: list[tuple[str, str]] = [
        ("video/mp4; codecs=hvc1", ".mp4"),
        ("video/webm", ".webm"),
    ]

    for video in _tags_only(soup.find_all("video")):
        if _should_skip_video(video):
            continue
        video_issues = _check_single_video(video, expected_sources)
        all_issues.extend(video_issues)

    return all_issues


REQUIRED_ROOT_FILES = ("robots.txt", "favicon.svg", "favicon.ico")

# Pattern to match citation keys in BibTeX entries: @misc{CitationKey,
_CITATION_KEY_PATTERN = re.compile(r"@misc\{([^,]+),")


def extract_citation_keys_from_html(soup: BeautifulSoup) -> list[str]:
    """
    Extract BibTeX citation keys from code blocks in HTML.

    Looks for @misc{CitationKey, patterns in code elements.

    Returns:
        list of citation keys found in the page
    """
    citation_keys: list[str] = []

    # BibTeX blocks are in code elements (after rehype-pretty-code processing)
    for code_element in soup.find_all(["code", "pre"]):
        text = code_element.get_text()
        matches = _CITATION_KEY_PATTERN.findall(text)
        citation_keys.extend(matches)

    return citation_keys


def _find_duplicate_citations(
    citation_to_files: Dict[str, list[str]],
) -> list[str]:
    """Find citation keys that appear in multiple files."""
    issues: list[str] = []
    for key, files_list in sorted(citation_to_files.items()):
        if len(files_list) > 1:
            files_str = ", ".join(files_list)
            issues.append(
                f"Duplicate citation key '{key}' found in {len(files_list)} files: "
                f"{files_str}"
            )
    return issues


def _maybe_collect_citation_keys(
    file_path: Path,
    public_dir: Path,
    citation_to_files: Dict[str, list[str]],
) -> None:
    """Extract citation keys from file and add to collection if not a
    redirect."""
    # skipcq: PTC-W6004 -- file_path comes from iterating over trusted local files
    with open(file_path, encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")
    if script_utils.is_redirect(soup):
        return

    rel_path = str(file_path.relative_to(public_dir))
    for key in set(extract_citation_keys_from_html(soup)):
        citation_to_files[key].append(rel_path)


def check_root_files_location(base_dir: Path) -> list[str]:
    """Check that required files exist in the root directory."""
    issues = []

    for filename in REQUIRED_ROOT_FILES:
        file_path = base_dir / filename
        if not file_path.is_file():
            issues.append(f"{filename} not found in site root")

    return issues


def _process_html_files(  # pylint: disable=too-many-locals
    public_dir: Path,
    content_dir: Path,
    check_fonts: bool,
    defined_css_vars: Set[str] | None = None,
) -> bool:
    """Processes all HTML files in the public directory and returns if issues
    were found."""
    issues_found_in_html = False
    permalink_to_md_path_map = script_utils.build_html_to_md_map(content_dir)
    files_to_skip: Set[str] = script_utils.collect_aliases(content_dir)
    citation_to_files: Dict[str, list[str]] = defaultdict(list)

    for root, _, files in os.walk(public_dir):
        root_path = Path(root)
        if "drafts" in root_path.parts:
            continue
        for file in tqdm.tqdm(files, desc="Webpages checked"):
            is_valid_file = (
                file.endswith(".html") and Path(file).stem not in files_to_skip
            )
            if not is_valid_file:
                continue

            file_path = root_path / file
            md_path = None
            if root_path == public_dir:
                md_path = permalink_to_md_path_map.get(
                    Path(file).stem
                ) or permalink_to_md_path_map.get(Path(file).stem.lower())
                if not md_path and script_utils.should_have_md(file_path):
                    raise FileNotFoundError(
                        f"Markdown file for {Path(file).stem} not found"
                    )

            issues = check_file_for_issues(
                file_path,
                public_dir,
                md_path,
                should_check_fonts=check_fonts,
                defined_css_variables=defined_css_vars,
            )

            if any(lst for lst in issues.values()):
                _print_issues(file_path, issues)
                issues_found_in_html = True

            _maybe_collect_citation_keys(
                file_path, public_dir, citation_to_files
            )

    # Check for duplicate citation keys across all files
    citation_issues = _find_duplicate_citations(citation_to_files)
    if citation_issues:
        _print_issues(public_dir, {"duplicate_citations": citation_issues})
        issues_found_in_html = True

    return issues_found_in_html


def main() -> None:
    """Check all HTML files in the public directory for issues."""
    args = parser.parse_args()
    overall_issues_found: bool = False
    check_rss_file_for_issues(_GIT_ROOT)

    css_file_path: Path = _PUBLIC_DIR / "index.css"
    css_issues = check_css_issues(css_file_path)
    if css_issues:
        _print_issues(css_file_path, {"CSS_issues": css_issues})
        overall_issues_found = True

    root_files_issues = check_root_files_location(_PUBLIC_DIR)
    if root_files_issues:
        _print_issues(_PUBLIC_DIR, {"root_files_issues": root_files_issues})
        overall_issues_found = True

    defined_css_vars: Set[str] = _get_defined_css_variables(css_file_path)
    html_issues_found = _process_html_files(
        _PUBLIC_DIR,
        _GIT_ROOT / "website_content",
        args.check_fonts,
        defined_css_vars,
    )

    if overall_issues_found or html_issues_found:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
