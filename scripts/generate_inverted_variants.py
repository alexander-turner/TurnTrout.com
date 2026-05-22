"""
Generate HSL-lightness-inverted variants of raster assets labeled for dark-mode
inversion.

For each entry in ``.invert_labels.json`` with ``invert: true`` whose URL
resolves to a local raster file under ``--asset-directory``, write a
sibling file with the ``-inverted`` suffix (e.g. ``image.avif`` →
``image-inverted.avif``). The client-side ``<picture>`` swap in
``accurateInvert.ts`` then references the precomputed variant, replacing
the canvas-based runtime inversion that trips Firefox's anti-fingerprinting
prompt on ``canvas.getImageData`` / ``toDataURL``.

The HSL-lightness transform matches ``invertLightness`` in
``accurateInvert.ts``: for each channel ``x in {r,g,b}``,
``x' = x + 255 - max(r,g,b) - min(r,g,b)``. Alpha is preserved verbatim.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from collections.abc import Iterator
from pathlib import Path
from typing import Final
from urllib.parse import unquote, urlparse

import numpy as np
from PIL import Image

try:
    from . import utils as script_utils
except ImportError:  # pragma: no cover
    import utils as script_utils  # type: ignore

INVERTED_SUFFIX: Final[str] = "-inverted"
INVERTIBLE_RASTER_EXTENSIONS: Final[frozenset[str]] = frozenset(
    {".avif", ".jpg", ".jpeg", ".png", ".webp"}
)

_DEFAULT_LABELS_PATH: Final[Path] = (
    Path(__file__).resolve().parent.parent
    / "quartz"
    / "plugins"
    / "transformers"
    / ".invert_labels.json"
)

logger = logging.getLogger(__name__)


def inverted_path(path: Path) -> Path:
    """
    Return the sibling path with the ``-inverted`` suffix inserted before the
    extension.

    ``foo/bar.avif`` → ``foo/bar-inverted.avif``.
    """
    return path.with_name(f"{path.stem}{INVERTED_SUFFIX}{path.suffix}")


def is_inverted_path(path: Path) -> bool:
    """True iff ``path`` is itself an inverted variant (avoid recursion)."""
    return path.stem.endswith(INVERTED_SUFFIX)


def invert_image_file(src: Path, dst: Path) -> None:
    """
    Read ``src``, invert HSL lightness per-pixel, write to ``dst``.

    Output format is inferred from ``dst``'s extension and matches the
    source (callers pass ``inverted_path(src)``). RGBA images keep their
    alpha channel; palette / grayscale modes are promoted to RGBA so the
    arithmetic is uniform.
    """
    with Image.open(src) as im:
        rgba = im.convert("RGBA")
    arr = np.array(rgba)
    rgb = arr[..., :3].astype(np.int16)
    delta = (255 - rgb.max(axis=-1) - rgb.min(axis=-1))[..., np.newaxis]
    arr[..., :3] = np.clip(rgb + delta, 0, 255).astype(np.uint8)
    Image.fromarray(arr, "RGBA").save(dst)


def _url_to_local_path(url: str, asset_dir: Path, base_url: str) -> Path | None:
    """
    Map a CDN URL to the local mirror path under ``asset_dir``.

    Returns ``None`` for URLs not hosted on ``base_url``. URL-encoded
    segments (e.g. ``%20``) are decoded so the resulting path matches the
    on-disk filename.
    """
    if not url.startswith(f"{base_url}/"):
        return None
    relative = unquote(urlparse(url).path.lstrip("/"))
    return asset_dir / relative


def iter_invert_targets(
    labels: dict[str, dict[str, bool]],
    asset_dir: Path,
    base_url: str,
) -> Iterator[Path]:
    """Yield local source paths whose URL is labeled ``invert: true``, that
    exist under ``asset_dir`` with an invertible raster extension, and that
    aren't themselves an inverted variant."""
    for url, meta in labels.items():
        if not meta.get("invert"):
            continue
        local = _url_to_local_path(url, asset_dir, base_url)
        if local is None or not local.is_file():
            continue
        if local.suffix.lower() not in INVERTIBLE_RASTER_EXTENSIONS:
            continue
        if is_inverted_path(local):
            continue
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
) -> tuple[int, int]:
    """
    Write inverted variants for every labeled raster under ``asset_dir``.

    Returns ``(generated, skipped)`` counts. A failure to read or write any
    single image is logged and counted as skipped — one corrupt asset must
    not stop the rest of the build.
    """
    generated = 0
    skipped = 0
    for src in iter_invert_targets(labels, asset_dir, base_url):
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


def _load_labels(labels_file: Path) -> dict[str, dict[str, bool]]:
    return json.loads(labels_file.read_text(encoding="utf-8"))


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
        "--force",
        action="store_true",
        help="Regenerate inverted variants even if newer than the source.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """
    CLI entry point.

    Returns ``0`` on success, ``1`` on missing inputs.
    """
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    args = _build_arg_parser().parse_args(argv)
    if not args.labels_file.is_file():
        logger.error("Labels file not found: %s", args.labels_file)
        return 1
    if not args.asset_directory.is_dir():
        logger.error("Asset directory not found: %s", args.asset_directory)
        return 1
    labels = _load_labels(args.labels_file)
    generated, skipped = generate_all(
        labels, args.asset_directory, args.base_url, force=args.force
    )
    logger.info(
        "Inverted variants: %d generated, %d skipped (up-to-date or unreadable).",
        generated,
        skipped,
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
