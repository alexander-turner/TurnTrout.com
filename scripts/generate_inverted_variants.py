# pylint: disable=missing-function-docstring
"""
Generate HSL-lightness-inverted variants of raster assets labeled for dark-mode
inversion.

For each entry in ``.invert_labels.json`` with ``invert: true`` whose URL
resolves to a local raster file under ``--asset-directory``, write a
sibling file with the ``-inverted`` suffix (e.g. ``image.avif`` →
``image-inverted.avif``). Also scans ``--content-directory`` for
``class="force-hsl-invert"`` raster images that need inverted variants
regardless of their dark-mode label.

The HSL-lightness transform matches ``invertLightness`` in
``accurateInvert.ts``: for each channel ``x in {r,g,b}``,
``x' = x + 255 - max(r,g,b) - min(r,g,b)``. Alpha is preserved verbatim.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
from collections.abc import Iterator
from pathlib import Path
from typing import Final
from urllib.parse import unquote, urlparse

import numpy as np
from PIL import Image

try:
    from . import compress
    from . import utils as script_utils
except ImportError:  # pragma: no cover
    import compress  # type: ignore
    import utils as script_utils  # type: ignore

INVERTED_SUFFIX: Final[str] = "-inverted"
INVERTIBLE_RASTER_EXTENSIONS: Final[frozenset[str]] = frozenset(
    {".avif", ".jpg", ".jpeg", ".png", ".webp"}
)
# Image modes without an alpha channel — save as RGB rather than RGBA so
# formats like JPEG (no alpha support) don't error on write.
_OPAQUE_MODES: Final[frozenset[str]] = frozenset(
    {"1", "L", "P", "RGB", "I", "F", "CMYK", "YCbCr", "HSV"}
)

_DEFAULT_LABELS_PATH: Final[Path] = (
    Path(__file__).resolve().parent.parent
    / "quartz"
    / "plugins"
    / "transformers"
    / ".invert_labels.json"
)
_DEFAULT_CONTENT_DIR: Final[Path] = (
    Path(__file__).resolve().parent.parent / "website_content"
)

logger = logging.getLogger(__name__)


def inverted_path(path: Path) -> Path:
    return path.with_name(f"{path.stem}{INVERTED_SUFFIX}{path.suffix}")


def is_inverted_path(path: Path) -> bool:
    return path.stem.endswith(INVERTED_SUFFIX)


def invert_image_file(src: Path, dst: Path) -> None:
    """
    Palette / grayscale modes are promoted to RGBA so the arithmetic is uniform.

    The output is then demoted back to RGB if the source was opaque so formats
    without an alpha channel (JPEG) can save.
    """
    with Image.open(src) as im:
        source_mode = im.mode
        rgba = im.convert("RGBA")
    arr = np.array(rgba)
    rgb = arr[..., :3].astype(np.int16)
    delta = (255 - rgb.max(axis=-1) - rgb.min(axis=-1))[..., np.newaxis]
    arr[..., :3] = np.clip(rgb + delta, 0, 255).astype(np.uint8)
    output = Image.fromarray(arr, "RGBA")
    if source_mode in _OPAQUE_MODES:
        output = output.convert("RGB")
    output.save(dst, quality=compress.DEFAULT_IMAGE_QUALITY)


def _url_to_local_path(url: str, asset_dir: Path, base_url: str) -> Path | None:
    """
    ``None`` for URLs not hosted on ``base_url``.

    URL-encoded segments (e.g. ``%20``) are decoded so the resulting path
    matches the on-disk filename.
    """
    if not url.startswith(f"{base_url}/"):
        return None
    relative = unquote(urlparse(url).path.lstrip("/"))
    return asset_dir / relative


_FORCE_HSL_INVERT_RE = re.compile(
    r'class="[^"]*force-hsl-invert[^"]*"[^>]*src="([^"]+)"'
    r"|"
    r'src="([^"]+)"[^>]*class="[^"]*force-hsl-invert[^"]*"',
)


def _scan_force_hsl_invert_urls(content_dir: Path) -> frozenset[str]:
    """Scan markdown files for raster img URLs with ``force-hsl-invert``."""
    urls: set[str] = set()
    for md in content_dir.rglob("*.md"):
        for m in _FORCE_HSL_INVERT_RE.finditer(md.read_text(encoding="utf-8")):
            url = m.group(1) or m.group(2)
            path = url.split("?", 1)[0].split("#", 1)[0]
            if any(
                path.lower().endswith(e) for e in INVERTIBLE_RASTER_EXTENSIONS
            ):
                urls.add(url)
    return frozenset(urls)


def iter_invert_targets(
    labels: dict[str, dict[str, bool]],
    asset_dir: Path,
    base_url: str,
    extra_urls: frozenset[str] = frozenset(),
) -> Iterator[Path]:
    seen: set[Path] = set()
    label_urls = {u for u, m in labels.items() if m.get("invert")}
    for url in label_urls | extra_urls:
        local = _url_to_local_path(url, asset_dir, base_url)
        if local is None or not local.is_file():
            continue
        if local.suffix.lower() not in INVERTIBLE_RASTER_EXTENSIONS:
            continue
        if is_inverted_path(local):
            continue
        if local in seen:
            continue
        seen.add(local)
        yield local


def _needs_regeneration(src: Path, dst: Path, force: bool) -> bool:
    if force or not dst.is_file():
        return True
    return dst.stat().st_mtime < src.stat().st_mtime


def generate_all(
    labels: dict[str, dict[str, bool]],
    asset_dir: Path,
    base_url: str,
    force: bool = False,
    extra_urls: frozenset[str] = frozenset(),
) -> tuple[int, int]:
    """
    A failure to read or write any single image is logged and counted as skipped
    — one corrupt asset must not stop the rest of the build.

    Returns ``(generated, skipped)``.
    """
    generated = 0
    skipped = 0
    for src in iter_invert_targets(labels, asset_dir, base_url, extra_urls):
        dst = inverted_path(src)
        if not _needs_regeneration(src, dst, force):
            skipped += 1
            continue
        try:
            invert_image_file(src, dst)
        except (OSError, ValueError) as exc:
            logger.warning("Failed to invert %s: %s", src, exc)
            skipped += 1
            continue
        generated += 1
    return generated, skipped


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--labels-file",
        type=Path,
        default=_DEFAULT_LABELS_PATH,
        help="Path to .invert_labels.json (default: in-repo location).",
    )
    parser.add_argument(
        "--asset-directory",
        type=Path,
        required=True,
        help=(
            "Local directory whose layout mirrors the CDN bucket "
            "(e.g. ~/Downloads/website-media-r2 or quartz/static)."
        ),
    )
    parser.add_argument(
        "--base-url",
        default=script_utils.CDN_BASE_URL,
        help="CDN base URL that the labels' keys are rooted at.",
    )
    parser.add_argument(
        "--content-directory",
        type=Path,
        default=_DEFAULT_CONTENT_DIR,
        help="Directory of markdown content to scan for force-hsl-invert.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate inverted variants even if newer than the source.",
    )
    return parser


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    args = _build_arg_parser().parse_args(argv)
    if not args.asset_directory.is_dir():
        raise NotADirectoryError(args.asset_directory)
    labels = json.loads(args.labels_file.read_text(encoding="utf-8"))
    extra = (
        _scan_force_hsl_invert_urls(args.content_directory)
        if args.content_directory.is_dir()
        else frozenset()
    )
    generated, skipped = generate_all(
        labels,
        args.asset_directory,
        args.base_url,
        force=args.force,
        extra_urls=extra,
    )
    logger.info(
        "Inverted variants: %d generated, %d skipped (up-to-date or unreadable).",
        generated,
        skipped,
    )


if __name__ == "__main__":  # pragma: no cover
    main()
