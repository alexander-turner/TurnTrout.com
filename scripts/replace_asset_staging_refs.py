"""
Replace `asset_staging` references in markdown files with their final static
paths.

The script scans the ``asset_staging`` directory for staged assets and updates all
markdown files under ``markdown_dir`` so that references like
``asset_staging/example.png`` or a bare ``example.png`` become
``static/images/posts/example.png``.  The implementation is split into small,
typed helper functions to keep the logic flat and easy to test.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

# Import utility to locate the repository root.
try:
    from . import utils as script_utils
except ImportError:  # pragma: no cover
    import utils as script_utils  # type: ignore


def _get_asset_files(asset_staging_dir: Path) -> list[Path]:
    """Return a list of regular files directly inside ``asset_staging_dir``."""
    return [p for p in asset_staging_dir.iterdir() if p.is_file()]


def _get_markdown_files(markdown_dir: Path) -> list[Path]:
    """Recursively collect all ``*.md`` files under ``markdown_dir``."""
    return list(markdown_dir.rglob("*.md"))


def _replace_content(content: str, filename: str) -> str:
    """
    Replace references to ``filename`` in *content*.

    Two passes are performed:
    1. ``asset_staging/<filename>`` → ``static/images/posts/<filename>``
    2. Stand‑alone ``<filename>`` that is **not** part of a URL
       (i.e. not preceded by ``/`` or ``:``) → the same static path.
    """
    # Pass 1 – explicit ``asset_staging`` prefix.
    content = content.replace(
        f"asset_staging/{filename}",
        f"static/images/posts/{filename}",
    )

    # Pass 2 – bare filename, guarded against URLs.
    # ``(?<![/:])`` ensures the filename is not preceded by a slash or colon.
    # ``(?<!\\w)`` / ``(?!\\w)`` enforce word boundaries so we only match the
    # complete filename (e.g. ``example.png`` does not match ``example.png123``).
    pattern = rf"(?<![/:])(?<!\w){re.escape(filename)}(?!\w)"
    return re.sub(pattern, f"static/images/posts/{filename}", content)


def _process_markdown_file(
    md_path: Path, filename: str, markdown_root: Path
) -> None:
    """
    Read *md_path*, replace references to *filename*, and write back if changed.

    ``markdown_root`` is used only for pretty printing the relative path.
    """
    original = md_path.read_text(encoding="utf-8")
    updated = _replace_content(original, filename)

    if updated != original:
        md_path.write_text(updated, encoding="utf-8")
        print(f"  Updated: {md_path.relative_to(markdown_root)}")


def replace_asset_staging_refs(
    asset_staging_dir: Path, markdown_dir: Path
) -> None:
    """
    Scan ``asset_staging_dir`` and replace all references in markdown files.

    Args:
        asset_staging_dir: Directory containing staged assets.
        markdown_dir:      Root directory that holds markdown files to update.
    """
    staged_files = _get_asset_files(asset_staging_dir)
    if not staged_files:
        print("No files in asset_staging to process.")
        return

    markdown_files = _get_markdown_files(markdown_dir)
    if not markdown_files:
        print("No markdown files found.")
        return

    for staged_file in staged_files:
        filename = staged_file.name
        print(f"Processing: {filename}")

        for md_file in markdown_files:
            _process_markdown_file(md_file, filename, markdown_dir)


def main() -> None:
    """Entry point used by the ``handle_assets.sh`` pipeline."""
    git_root = script_utils.get_git_root()
    asset_staging_dir = git_root / "website_content" / "asset_staging"
    markdown_dir = git_root / "website_content"

    if not asset_staging_dir.exists():
        print(f"Asset staging directory not found: {asset_staging_dir}")
        sys.exit(1)

    replace_asset_staging_refs(asset_staging_dir, markdown_dir)


if __name__ == "__main__":
    main()
