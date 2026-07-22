#!/usr/bin/env python3
"""
Pin the raster/vector CDN images that ``(screenshot)`` tests capture.

Visual-regression baselines render ``website_content/test-page.md`` (and the
per-section fixtures sliced from it). Those pages reference real assets on
``assets.turntrout.com``; ``quartz/components/tests/fixtures.ts`` deliberately
exempts ``(screenshot)`` tests from CDN stubbing so baselines capture real
bytes. That makes the baselines hostage to any upstream CDN re-encode of an
image.

This script mirrors the referenced *raster/vector images* into a committed
fixture directory so Playwright can serve them locally during ``(screenshot)``
tests, making those captures byte-deterministic. Large media (video/audio) is
intentionally left on the live CDN: audio contributes no pixels and a paused
video frame-0 rarely re-encodes, so pinning ~100 MB of media into git isn't
worth it.

Usage::

    uv run python scripts/pin_screenshot_assets.py            # download missing pins
    uv run python scripts/pin_screenshot_assets.py --force    # re-download all
    uv run python scripts/pin_screenshot_assets.py --check     # verify completeness (no network)
"""

from __future__ import annotations

import argparse
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

CDN_HOST = "assets.turntrout.com"

# Extensions whose bytes drive the captured pixels. Video/audio are excluded on
# purpose (see module docstring).
PINNED_EXTENSIONS = frozenset(
    {".avif", ".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg"}
)

REPO_ROOT = Path(__file__).resolve().parent.parent
TEST_PAGE = REPO_ROOT / "website_content" / "test-page.md"
PIN_DIR = (
    REPO_ROOT / "quartz" / "components" / "tests" / "fixtures" / "cdn-assets"
)

_CDN_URL_RE = re.compile(
    r"https?://" + re.escape(CDN_HOST) + r"/[A-Za-z0-9._/%-]+\.[A-Za-z0-9]+"
)


def extract_pinned_urls(markdown: str) -> list[str]:
    """Return the sorted, de-duplicated CDN image URLs referenced in
    ``markdown``."""
    urls = set()
    for match in _CDN_URL_RE.findall(markdown):
        path = urllib.parse.urlparse(match).path
        extension = Path(urllib.parse.unquote(path)).suffix.lower()
        if extension in PINNED_EXTENSIONS:
            urls.add(match)
    return sorted(urls)


def cdn_url_to_local_path(url: str, pin_dir: Path = PIN_DIR) -> Path:
    """Map a CDN URL to its committed fixture path, mirroring the decoded
    pathname."""
    path = urllib.parse.unquote(urllib.parse.urlparse(url).path).lstrip("/")
    return pin_dir / path


def download(url: str, dest: Path) -> None:  # pragma: no cover - network I/O
    """Download ``url`` to ``dest``, creating parent directories."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310 - https CDN
        dest.write_bytes(response.read())


def missing_pins(urls: list[str], pin_dir: Path = PIN_DIR) -> list[str]:
    """Return the URLs from ``urls`` that have no committed fixture file yet."""
    return [
        url for url in urls if not cdn_url_to_local_path(url, pin_dir).exists()
    ]


def main(argv: list[str] | None = None) -> int:
    """Download missing pins, re-download all, or verify completeness."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify every referenced image is pinned; exit non-zero if any is missing.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download every referenced image, not just the missing ones.",
    )
    args = parser.parse_args(argv)

    urls = extract_pinned_urls(TEST_PAGE.read_text(encoding="utf-8"))

    if args.check:
        missing = missing_pins(urls, PIN_DIR)
        if missing:
            joined = "\n  ".join(missing)
            print(
                "Missing pinned screenshot assets (run "
                f"`uv run python {Path(__file__).name}`):\n  {joined}",
                file=sys.stderr,
            )
            return 1
        print(f"All {len(urls)} screenshot assets are pinned.")
        return 0

    to_fetch = urls if args.force else missing_pins(urls, PIN_DIR)
    for url in to_fetch:  # pragma: no cover - network I/O
        dest = cdn_url_to_local_path(url, PIN_DIR)
        print(f"Pinning {url} -> {dest.relative_to(REPO_ROOT)}")
        download(url, dest)
    print(f"Pinned {len(to_fetch)} asset(s); {len(urls)} referenced in total.")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
