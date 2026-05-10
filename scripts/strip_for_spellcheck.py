"""
Strip content from Markdown files to prepare them for spellcheck/vale linting.

Removes regions that produce false-positive lint hits:

- `[!quote]` callout blocks (external authors, foreign quotes)
- LaTeX math (`$...$` inline and `$$...$$` display)

Replaces stripped regions with blank lines / spaces to preserve line and
column numbers, so reported error positions still match the original source.
"""

import argparse
import re
import sys
import tempfile
from pathlib import Path

# Add the project root to sys.path
# pylint: disable=wrong-import-position
sys.path.append(str(Path(__file__).parent.parent))
# skipcq: FLK-E402
from scripts import utils as script_utils  # noqa: E402

_QUOTE_CALLOUT_RE = re.compile(r"^(?:>\s*)+\[!quote\][+-]?")

# Combined display + inline math. Display (`$$...$$`, possibly multi-line)
# is tried first so it captures `$$x$$` as a single match instead of
# splitting into two adjacent `$...$` inline matches. Inline (`$...$`) is
# restricted to a single line so it doesn't eat across paragraph breaks.
_MATH_RE = re.compile(
    r"(?<!\\)\$\$.*?(?<!\\)\$\$|(?<!\\)\$(?:[^$\n\\]|\\.)+?(?<!\\)\$",
    re.DOTALL,
)

# Dropcap span/div pattern: `<span class="dropcap" ...>L</span>` followed
# by the rest of the word. Replacing the whole tag with just the inner
# letter fuses it with the following text so the spellchecker sees the
# full word — `<span class="dropcap">d</span>ropcap` becomes `dropcap`.
# Narrow to `class="...dropcap..."` so we don't strip unrelated HTML
# (which could expose code-block contents to spellcheck false positives).
_DROPCAP_TAG_RE = re.compile(
    r'<(?P<tag>span|div)\b[^>]*\bclass="[^"]*\bdropcap\b[^"]*"[^>]*>'
    r"(?P<inner>[^<]*)</(?P=tag)>"
)


def get_quote_level(line: str) -> int:
    """
    Count the blockquote nesting level of a line.

    Each `>` character at the start (with optional surrounding spaces) adds one
    level. Returns 0 for non-blockquote lines.
    """
    stripped = line.lstrip(" ")
    level = 0
    for char in stripped:
        if char == ">":
            level += 1
        elif char != " ":
            break
    return level


def is_quote_callout_start(line: str) -> bool:
    """Check if a line starts a `[!quote]` callout block."""
    return bool(_QUOTE_CALLOUT_RE.match(line))


def strip_quote_blocks(text: str) -> str:
    """
    Remove `[!quote]` callout blocks from markdown text.

    Replaces quote block lines with empty lines to preserve line numbering. Only
    removes `[!quote]` blocks, not other callout types like `[!note]`,
    `[!warning]`, etc.
    """
    lines = text.split("\n")
    result: list[str] = []
    line_iter = enumerate(lines)

    for _i, line in line_iter:
        if not is_quote_callout_start(line):
            result.append(line)
            continue

        # Strip all lines at this nesting level or deeper
        level = get_quote_level(line)
        result.append("")
        for _j, next_line in line_iter:
            if get_quote_level(next_line) < level:
                result.append(next_line)
                break
            result.append("")

    return "\n".join(result)


def _blank_inner_match(match: re.Match[str]) -> str:
    """
    Blank the interior of a math match, preserving `$`/`$$` delimiters.

    Keeping the dollar signs intact preserves token boundaries for the
    linter: retext sees `$` as punctuation, so adjacent words flanking
    a math span aren't falsely flagged as repeated (`in $...$ in` becomes
    `in $   $ in`, still separated by the dollar tokens). Spaces replace
    inner non-newline characters; newlines are kept to preserve line
    numbers in display math.
    """
    text = match.group(0)
    delim = "$$" if text.startswith("$$") else "$"
    inner = text[len(delim) : -len(delim)]
    blanked = "".join("\n" if ch == "\n" else " " for ch in inner)
    return f"{delim}{blanked}{delim}"


def strip_math(text: str) -> str:
    """
    Blank the contents of LaTeX math regions.

    Handles both display (`$$...$$`) and inline (`$...$`) math in a single pass
    so display delimiters don't get re-matched as inline math (e.g., `$$x$$`
    would otherwise blank to `$$ $$`, whose inner `$ $` re-matches the inline
    pattern). The delimiting `$`/`$$` characters are kept (so they still serve
    as token boundaries to retext), and the inner math content is replaced with
    same-length whitespace. Line and column counts are preserved, so
    spellcheck/vale error coordinates still match the source.
    """
    return _MATH_RE.sub(_blank_inner_match, text)


def strip_dropcap_tags(text: str) -> str:
    """
    Collapse `<span/div class="dropcap" ...>X</span>` to just `X`.

    The dropcap pattern splits a word like `dropcap` across an HTML span: `<span
    class="dropcap">d</span>ropcap`. Removing the span tags lets the inner
    letter fuse with the following text so the spellchecker sees the full word.
    The regex is narrow (matches only `class` values containing `dropcap`) to
    avoid touching unrelated HTML inside code blocks or other markup.
    """
    return _DROPCAP_TAG_RE.sub(lambda m: m.group("inner"), text)


def strip_for_lint(text: str) -> str:
    """Apply all lint-preprocessing strips to markdown text."""
    return strip_dropcap_tags(strip_math(strip_quote_blocks(text)))


def create_stripped_directory(
    source_dir: Path, output_dir: Path | None = None
) -> Path:
    """
    Create a directory with lint-preprocessed copies of Markdown files.

    Args:
        source_dir: Directory containing source Markdown files.
        output_dir: Output directory. If `None`, creates a temporary
            directory.

    Returns:
        Path to the output directory containing stripped files.
    """
    if output_dir is None:
        output_dir = Path(tempfile.mkdtemp(prefix="stripped_for_spellcheck_"))

    for md_file in source_dir.rglob("*.md"):
        relative = md_file.relative_to(source_dir)
        output_file = output_dir / relative
        output_file.parent.mkdir(parents=True, exist_ok=True)

        text = md_file.read_text(encoding="utf-8")
        stripped = strip_for_lint(text)
        output_file.write_text(stripped, encoding="utf-8")

    return output_dir


def main() -> None:
    """Strip quote blocks and math from Markdown files."""
    parser = argparse.ArgumentParser(
        description=(
            "Strip [!quote] blocks and LaTeX math from Markdown files."
        )
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=None,
        help="Source directory (default: website_content/)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output directory (default: creates temp dir)",
    )
    args = parser.parse_args()

    source_dir = args.source_dir
    if source_dir is None:
        git_root = script_utils.get_git_root()
        source_dir = git_root / "website_content"

    output_dir = create_stripped_directory(source_dir, args.output_dir)
    print(output_dir)


if __name__ == "__main__":
    main()
