"""
Strip [!quote] callout blocks from Markdown files for linting preprocessing.

Creates temporary copies of Markdown files with quote callout blocks removed, so
that linters (vale, spellcheck) don't flag errors in quoted text from external
sources.
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

_QUOTE_CALLOUT_RE = re.compile(
    r"^(?:>\s*)+\[!quote\][+-]?", re.IGNORECASE
)


def get_quote_level(line: str) -> int:
    """
    Count the blockquote nesting level of a line.

    Each ``>`` character at the start (with optional surrounding
    spaces) adds one level. Returns 0 for non-blockquote lines.
    """
    level = 0
    i = 0
    while i < len(line):
        if line[i] == ">":
            level += 1
            i += 1
            # Skip optional space after >
            if i < len(line) and line[i] == " ":
                i += 1
        elif line[i] == " ":
            i += 1
        else:
            break
    return level


def is_quote_callout_start(line: str) -> bool:
    """Check if a line starts a ``[!quote]`` callout block."""
    return bool(_QUOTE_CALLOUT_RE.match(line))


def strip_quote_blocks(text: str) -> str:
    """
    Remove ``[!quote]`` callout blocks from markdown text.

    Replaces quote block lines with empty lines to preserve line
    numbering. Only removes ``[!quote]`` blocks, not other callout
    types like ``[!note]``, ``[!warning]``, etc.
    """
    lines = text.split("\n")
    result: list[str] = []
    i = 0

    while i < len(lines):
        if is_quote_callout_start(lines[i]):
            level = get_quote_level(lines[i])
            # Strip all lines at this nesting level or deeper
            while i < len(lines) and get_quote_level(lines[i]) >= level:
                result.append("")
                i += 1
        else:
            result.append(lines[i])
            i += 1

    return "\n".join(result)


def create_stripped_directory(
    source_dir: Path, output_dir: Path | None = None
) -> Path:
    """
    Create a directory with quote-stripped copies of Markdown files.

    Args:
        source_dir: Directory containing source Markdown files.
        output_dir: Output directory. If ``None``, creates a temporary
            directory.

    Returns:
        Path to the output directory containing stripped files.
    """
    if output_dir is None:
        output_dir = Path(tempfile.mkdtemp(prefix="stripped_quotes_"))

    for md_file in source_dir.rglob("*.md"):
        relative = md_file.relative_to(source_dir)
        output_file = output_dir / relative
        output_file.parent.mkdir(parents=True, exist_ok=True)

        text = md_file.read_text(encoding="utf-8")
        stripped = strip_quote_blocks(text)
        output_file.write_text(stripped, encoding="utf-8")

    return output_dir


def main() -> int:
    """Strip quote blocks from Markdown files."""
    parser = argparse.ArgumentParser(
        description="Strip [!quote] blocks from Markdown files."
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
    return 0


if __name__ == "__main__":
    sys.exit(main())
