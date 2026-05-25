# pylint: disable=missing-function-docstring
"""
Generate HSL-lightness-inverted variants of assets labeled for dark-mode
inversion.

For each entry in ``.invert_labels.json`` with ``invert: true`` whose URL
resolves to a local file under ``--asset-directory``, write a sibling file
with the ``-inverted`` suffix (e.g. ``image.avif`` → ``image-inverted.avif``).
The client-side ``<picture>`` swap in ``accurateInvert.ts`` then references
the precomputed variant.

Raster images use a per-pixel HSL-lightness transform matching
``invertLightness`` in ``accurateInvert.ts``: for each channel ``x in {r,g,b}``,
``x' = x + 255 - max(r,g,b) - min(r,g,b)``. Alpha is preserved verbatim.

SVGs are XML-parsed and every color-bearing attribute/CSS declaration is
rewritten via ``colorsys.rgb_to_hls`` / ``hls_to_rgb`` (invert lightness).
"""

from __future__ import annotations

import argparse
import colorsys
import json
import logging
import re
from collections.abc import Iterator
from pathlib import Path
from typing import Final
from urllib.parse import unquote, urlparse
from xml.etree import ElementTree as ET

import numpy as np
from PIL import Image

try:
    from . import compress
    from . import utils as script_utils
except ImportError:  # pragma: no cover
    import compress  # type: ignore
    import utils as script_utils  # type: ignore

INVERTED_SUFFIX: Final[str] = "-inverted"
_SVG_EXTENSIONS: Final[frozenset[str]] = frozenset(
    script_utils.INVERT_SVG_EXTENSIONS
)
INVERTIBLE_EXTENSIONS: Final[frozenset[str]] = frozenset(
    script_utils.INVERT_RASTER_EXTENSIONS + script_utils.INVERT_SVG_EXTENSIONS
) - frozenset({".gif"})
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


# --------------- SVG color inversion ---------------

_SVG_COLOR_ATTRS: Final[tuple[str, ...]] = (
    "fill",
    "stroke",
    "stop-color",
    "color",
    "flood-color",
    "lighting-color",
)

_HEX_RE = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
_RGB_RGBA_RE = re.compile(
    r"^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})"
    r"(?:\s*,\s*[\d.]+)?\s*\)$"
)

_CSS_NAMED_COLORS: Final[dict[str, tuple[int, int, int]]] = {
    "black": (0, 0, 0),
    "white": (255, 255, 255),
    "red": (255, 0, 0),
    "green": (0, 128, 0),
    "blue": (0, 0, 255),
    "yellow": (255, 255, 0),
    "cyan": (0, 255, 255),
    "magenta": (255, 0, 255),
    "gray": (128, 128, 128),
    "grey": (128, 128, 128),
    "silver": (192, 192, 192),
    "maroon": (128, 0, 0),
    "olive": (128, 128, 0),
    "lime": (0, 255, 0),
    "aqua": (0, 255, 255),
    "teal": (0, 128, 128),
    "navy": (0, 0, 128),
    "fuchsia": (255, 0, 255),
    "purple": (128, 0, 128),
    "orange": (255, 165, 0),
}

_SKIP_TOKENS: Final[frozenset[str]] = frozenset(
    {"none", "currentcolor", "transparent", "inherit", "initial", "unset"}
)


def _parse_color(token: str) -> tuple[int, int, int] | None:
    token = token.strip()
    low = token.lower()
    if low in _SKIP_TOKENS or low.startswith("url("):
        return None
    if low in _CSS_NAMED_COLORS:
        return _CSS_NAMED_COLORS[low]
    m = _HEX_RE.match(token)
    if m:
        digits = m.group(1)
        if len(digits) == 3:
            return (
                int(digits[0] * 2, 16),
                int(digits[1] * 2, 16),
                int(digits[2] * 2, 16),
            )
        return int(digits[0:2], 16), int(digits[2:4], 16), int(digits[4:6], 16)
    m = _RGB_RGBA_RE.match(token)
    if m:
        return int(m.group(1)), int(m.group(2)), int(m.group(3))
    return None


def _boost_dark_midtones(lightness: float, new_lightness: float) -> float:
    """
    Lift mid-lightness colors that invert too dark for dark backgrounds.

    Pure ``1 − L`` inversion maps colors near L ≈ 0.5–0.8 to the
    hard-to-read L ≈ 0.2–0.5 range.  Remap the [0, 0.5) band to
    [0.5, 0.75) so data-visualization elements stay legible.
    Near-white backgrounds (L ≥ 0.85) and near-black text (L ≤ 0.15)
    are outside the mid-tone window and invert normally.
    """
    if 0.15 < lightness < 0.85 and new_lightness < 0.5:
        return 0.5 + new_lightness * 0.5
    return new_lightness


def invert_color_token(token: str) -> str | None:
    rgb = _parse_color(token)
    if rgb is None:
        return None
    r, g, b = (c / 255.0 for c in rgb)
    hue, lightness, sat = colorsys.rgb_to_hls(r, g, b)
    new_lightness = _boost_dark_midtones(lightness, 1.0 - lightness)
    r2, g2, b2 = colorsys.hls_to_rgb(hue, new_lightness, sat)
    return f"#{round(r2 * 255):02x}{round(g2 * 255):02x}{round(b2 * 255):02x}"


_CSS_COLOR_PROP_RE = re.compile(
    r"(?<![\w-])(?P<prop>"
    + "|".join(re.escape(a) for a in _SVG_COLOR_ATTRS)
    + r")(?P<sep>\s*:\s*)(?P<value>\S[^;}'\"]*)",
    re.IGNORECASE,
)


def invert_css_colors(css: str) -> str:
    def _replace(m: re.Match[str]) -> str:
        inverted = invert_color_token(m.group("value").strip())
        if inverted is None:
            return m.group(0)
        return f"{m.group('prop')}{m.group('sep')}{inverted}"

    return _CSS_COLOR_PROP_RE.sub(_replace, css)


def invert_svg_file(src: Path, dst: Path) -> None:
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
    tree = ET.parse(src)  # noqa: S314
    for el in tree.iter():
        for attr in _SVG_COLOR_ATTRS:
            val = el.get(attr)
            if val is None:
                continue
            inverted = invert_color_token(val.strip())
            if inverted is not None:
                el.set(attr, inverted)
        style = el.get("style")
        if style:
            el.set("style", invert_css_colors(style))
        if el.text and (el.tag.endswith("}style") or el.tag == "style"):
            el.text = invert_css_colors(el.text)
    tree.write(dst, xml_declaration=True, encoding="unicode")


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


def iter_invert_targets(
    labels: dict[str, dict[str, bool]],
    asset_dir: Path,
    base_url: str,
) -> Iterator[Path]:
    for url, meta in labels.items():
        if not meta.get("invert"):
            continue
        local = _url_to_local_path(url, asset_dir, base_url)
        if local is None or not local.is_file():
            continue
        if local.suffix.lower() not in INVERTIBLE_EXTENSIONS:
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
    A failure to read or write any single image is logged and counted as skipped
    — one corrupt asset must not stop the rest of the build.

    Returns ``(generated, skipped)``.
    """
    generated = 0
    skipped = 0
    for src in iter_invert_targets(labels, asset_dir, base_url):
        dst = inverted_path(src)
        if not _needs_regeneration(src, dst, force):
            skipped += 1
            continue
        try:
            if src.suffix.lower() in _SVG_EXTENSIONS:
                invert_svg_file(src, dst)
            else:
                invert_image_file(src, dst)
        except (OSError, ValueError, ET.ParseError) as exc:
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
    generated, skipped = generate_all(
        labels, args.asset_directory, args.base_url, force=args.force
    )
    logger.info(
        "Inverted variants: %d generated, %d skipped (up-to-date or unreadable).",
        generated,
        skipped,
    )


if __name__ == "__main__":  # pragma: no cover
    main()
