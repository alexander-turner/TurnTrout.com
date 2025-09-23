"""
Scan markdown files for images without meaningful alt text.

This script produces a JSON work-queue.
"""

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable, Sequence

from markdown_it import MarkdownIt
from markdown_it.token import Token

# pylint: disable=C0413
sys.path.append(str(Path(__file__).parent.parent))

from scripts import utils as script_utils

_JSON_INDENT: int = 2

# ``markdown_it`` represents HTML img tags inside an ``html_inline`` or
# ``html_block`` token. Use a lightweight regex so we do not pull in another
# HTML parser just for <img>.
_IMG_TAG_RE = re.compile(
    r"<img\s+[^>]*src=\"(?P<src>[^\"]+)\"[^>]*>", re.IGNORECASE | re.DOTALL
)


@dataclass(slots=True)
class QueueItem:
    """Represents a single image lacking adequate alt text."""

    markdown_file: str
    image_path: str
    line_number: int  # 1-based
    context_snippet: str

    def to_json(self) -> dict[str, str | int]:  # pragma: no cover
        return asdict(self)


def _create_queue_item(
    md_path: Path,
    image_path: str,
    line_number: int,
    lines: Sequence[str],
) -> QueueItem:
    return QueueItem(
        markdown_file=str(md_path),
        image_path=image_path,
        line_number=line_number,
        context_snippet=_paragraph_context(lines, line_number - 1),
    )


_PLACEHOLDER_ALTS: set[str] = {
    "img",
    "image",
    "photo",
    "placeholder",
    "screenshot",
    "picture",
}


def _is_alt_meaningful(alt: str | None) -> bool:
    if alt is None:
        return False
    alt_stripped = alt.strip().lower()
    return bool(alt_stripped) and alt_stripped not in _PLACEHOLDER_ALTS


def _iter_image_tokens(tokens: Sequence[Token]) -> Iterable[Token]:
    """Yield all tokens (including nested children) that correspond to
    images."""

    stack: list[Token] = list(tokens)
    while stack:
        token = stack.pop()

        # Depth-first traversal of the token tree.
        if token.children:
            stack.extend(token.children)

        if token.type == "image":
            yield token
            continue

        if (
            token.type in {"html_inline", "html_block"}
            and "<img" in token.content.lower()
        ):
            yield token


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


_ALT_RE = re.compile(r"alt=\"(?P<alt>[^\"]*)\"", re.IGNORECASE)


def _extract_html_img_info(token: Token) -> list[tuple[str, str | None]]:
    """Return list of (src, alt) pairs for each <img> within the token."""

    infos: list[tuple[str, str | None]] = []
    for m in _IMG_TAG_RE.finditer(token.content):
        src = m.group("src")
        alt_match = _ALT_RE.search(m.group(0))
        alt: str | None = alt_match.group("alt") if alt_match else None
        infos.append((src, alt))
    return infos


def _paragraph_context(
    lines: Sequence[str], idx: int, num_paragraphs: int = 2
) -> str:
    """
    Return *num_paragraphs* before and after *idx* (inclusive) separated by
    blank lines.

    Each paragraph is returned exactly as it appears in the file.
    """
    # Identify paragraph boundaries based on blank lines.
    paragraphs: list[list[str]] = []
    current: list[str] = []
    for line in lines:
        if line.strip() == "":
            if current:
                paragraphs.append(current)
                current = []
        else:
            current.append(line.rstrip("\n"))
    if current:
        paragraphs.append(current)

    # Map line index -> paragraph index.
    line_to_para: dict[int, int] = {}
    current_idx = 0
    for p_idx, para in enumerate(paragraphs):
        for _ in para:
            line_to_para[current_idx] = p_idx
            current_idx += 1
        # Account for the blank line after paragraph.
        line_to_para[current_idx] = p_idx  # blank line maps to this para idx
        current_idx += 1

    para_idx = line_to_para.get(idx, 0)
    start_idx = max(0, para_idx - num_paragraphs)
    end_idx = min(len(paragraphs), para_idx + num_paragraphs + 1)
    snippet_lines: list[str] = []
    for p in paragraphs[start_idx:end_idx]:
        snippet_lines.extend(p)
        snippet_lines.append("")  # restore blank line separator
    return "\n".join(snippet_lines).strip()


def _handle_md_asset(
    token: Token, md_path: Path, lines: Sequence[str]
) -> list[QueueItem]:
    """
    Process a markdown ``image`` token.

    Args:
        token: The ``markdown_it`` token representing the image.
        md_path: Current markdown file path.
        lines: Contents of *md_path* split by lines.

    Returns:
        Zero or one-element list containing a ``QueueItem`` for images with
        missing or placeholder alt text.
    """

    src_raw = token.attrGet("src")
    src_attr: str | None = str(src_raw) if src_raw is not None else None

    alt_text: str | None = token.content  # alt stored here
    if not src_attr or _is_alt_meaningful(alt_text):
        return []

    if token.map:
        line_no = token.map[0] + 1
    else:
        # Fallback: locate the first line containing the image markdown.
        search_snippet = f"({src_attr})"
        line_no = next(
            (
                idx + 1
                for idx, line in enumerate(lines)
                if search_snippet in line
            ),
            1,
        )

    return [_create_queue_item(md_path, src_attr, line_no, lines)]


def _handle_html_asset(
    token: Token, md_path: Path, lines: Sequence[str]
) -> list[QueueItem]:
    """
    Process an ``html_inline`` or ``html_block`` token containing ``<img>``.

    Args:
        token: Token potentially containing one or more ``<img>`` tags.
        md_path: Current markdown file path.
        lines: Contents of *md_path* split by lines.

    Returns:
        List of ``QueueItem`` instances—one for each offending ``<img>``.
    """

    items: list[QueueItem] = []
    for src_attr, alt_text in _extract_html_img_info(token):
        if _is_alt_meaningful(alt_text):
            continue

        line_no = (token.map[0] + 1) if token.map else 1
        items.append(_create_queue_item(md_path, src_attr, line_no, lines))

    return items


def _process_file(md_path: Path) -> list[QueueItem]:
    md = MarkdownIt("commonmark")
    source_text = md_path.read_text(encoding="utf-8")
    lines = source_text.splitlines()

    items: list[QueueItem] = []
    tokens = md.parse(source_text)
    for token in _iter_image_tokens(tokens):
        if token.type == "image":
            token_items = _handle_md_asset(token, md_path, lines)
        else:
            token_items = _handle_html_asset(token, md_path, lines)
        items.extend(token_items)
    return items


def build_queue(root: Path) -> list[QueueItem]:
    """Return a queue of images lacking alt text beneath *root*."""

    md_files = script_utils.get_files(
        root, filetypes_to_match=(".md",), use_git_ignore=True
    )
    queue: list[QueueItem] = []
    for md_file in md_files:
        queue.extend(_process_file(md_file))

    return queue


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:  # pragma: no cover
    parser = argparse.ArgumentParser(
        description="Generate image alt-text queue."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=script_utils.get_git_root(),
        help="Directory to search (default: repo root)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Path for output JSON file (default: <root>/image_queue.json)",
    )
    args = parser.parse_args()

    output_path = args.output or args.root / "image_queue.json"
    queue_items = build_queue(args.root)

    output_path.write_text(
        json.dumps(
            [item.to_json() for item in queue_items],
            indent=_JSON_INDENT,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"Wrote {len(queue_items)} queue item(s) to {output_path}")


if __name__ == "__main__":
    main()
