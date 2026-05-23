"""
Build modified EBGaramond fonts from upstream originals.

Applies two modifications to EBGaramond08-Regular and EBGaramond12-Regular:
1. Bracket/brace harmonization: affine-maps Y coordinates of bracketleft,
   bracketright, braceleft, braceright so their yMin/yMax match parenleft.
2. GPOS kerning: adds a PairPos Format 1 lookup to the kern feature
   for f-variant glyphs x punctuation and open-punct x descender letters.

Usage:
    python scripts/build_fonts.py           # Build and verify
    python scripts/build_fonts.py --install # Build, verify, and overwrite
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path
from typing import Any, Final

from fontTools.otlLib.builder import (  # type: ignore[import-untyped]
    PairPosBuilder,
    buildValue,
)
from fontTools.ttLib import TTFont  # type: ignore[import-untyped]
from fontTools.ttLib.tables import otTables  # type: ignore[import-untyped]

_FONT_DIR: Final[Path] = (
    Path(__file__).resolve().parent.parent
    / "quartz"
    / "static"
    / "styles"
    / "fonts"
    / "EBGaramond"
)
_UPSTREAM_DIR: Final[Path] = _FONT_DIR / "upstream"

_BRACE_GLYPHS: Final[tuple[str, ...]] = (
    "braceleft",
    "braceright",
)

_SQUARE_BRACKET_GLYPHS: Final[tuple[str, ...]] = (
    "bracketleft",
    "bracketright",
)

_TARGET_GLYPHS: Final[tuple[str, ...]] = (
    "quotedbl",
    "quotesingle",
    "parenleft",
    "parenright",
    "bracketright",
    "braceright",
    "quoteleft",
    "quoteright",
    "quotedblleft",
    "quotedblright",
)

_BASE_KERN: Final[dict[str, int]] = {
    "quotedbl": 250,
    "quotesingle": 250,
    "parenleft": 250,
    "parenright": 350,
    "bracketright": 350,
    "braceright": 280,
    "quoteleft": 270,
    "quoteright": 300,
    "quotedblleft": 270,
    "quotedblright": 300,
}

_KERN_OFFSET: Final[int] = 80

_OPEN_PUNCT_GLYPHS: Final[tuple[str, ...]] = (
    "parenleft",
    "bracketleft",
    "braceleft",
)

_DESCENDER_GLYPHS: Final[tuple[str, ...]] = (
    "g",
    "j",
    "p",
    "q",
    "y",
)

_DESCENDER_KERN: Final[int] = 120


def _get_f_glyphs(font: TTFont) -> tuple[str, ...]:
    """Find all f-variant glyphs with positive overhang (xMax > advance
    width)."""
    glyf_table = font["glyf"]
    hmtx_table = font["hmtx"]
    glyph_order = font.getGlyphOrder()

    f_glyphs = []
    for name in glyph_order:
        if not (name == "f" or name.startswith(("f_", "f."))):
            continue
        if name not in hmtx_table.metrics:
            continue
        glyph = glyf_table[name]
        if glyph.numberOfContours == 0 and not glyph.isComposite():
            continue
        overhang = glyph.xMax - hmtx_table[name][0]
        if overhang > 0:
            f_glyphs.append(name)

    return tuple(f_glyphs)


def _affine_map_glyph_y(
    font: TTFont,
    glyph_name: str,
    target_y_min: int,
    target_y_max: int,
) -> None:
    """Affine-map all Y coordinates of a glyph to span [target_y_min,
    target_y_max]."""
    glyf_table = font["glyf"]
    glyph = glyf_table[glyph_name]
    if glyph.numberOfContours == 0:
        return
    old_y_min = glyph.yMin
    old_y_max = glyph.yMax
    old_span = old_y_max - old_y_min

    if old_span == 0:
        return

    scale_y = (target_y_max - target_y_min) / old_span
    glyph.coordinates.translate((0, -old_y_min))
    glyph.coordinates.scale((1, scale_y))
    glyph.coordinates.translate((0, target_y_min))
    glyph.coordinates.toInt()
    glyph.recalcBounds(glyf_table)


def _harmonize_brackets(font: TTFont) -> None:
    """
    Scale bracket/brace glyphs to match parenleft vertical extent.

    Braces get full paren bounds. Square brackets keep their original yMin
    (shorter descender) but scale yMax to match parens.
    """
    glyf_table = font["glyf"]
    paren = glyf_table["parenleft"]

    for name in _BRACE_GLYPHS:
        _affine_map_glyph_y(font, name, paren.yMin, paren.yMax)

    for name in _SQUARE_BRACKET_GLYPHS:
        original_y_min = glyf_table[name].yMin
        _affine_map_glyph_y(font, name, original_y_min, paren.yMax)


def _register_kern_feature(gpos: Any, lookup_index: int) -> None:
    """Register a lookup in the kern feature, creating it if needed."""
    for feat_rec in gpos.FeatureList.FeatureRecord:
        if feat_rec.FeatureTag == "kern":
            feat_rec.Feature.LookupListIndex.append(lookup_index)
            return

    feat = otTables.Feature()  # pylint: disable=no-member
    feat.LookupListIndex = [lookup_index]
    feat.LookupCount = 1

    feat_rec = otTables.FeatureRecord()  # pylint: disable=no-member
    feat_rec.FeatureTag = "kern"
    feat_rec.Feature = feat
    gpos.FeatureList.FeatureRecord.append(feat_rec)

    kern_feat_index = len(gpos.FeatureList.FeatureRecord) - 1
    for script_rec in gpos.ScriptList.ScriptRecord:
        if script_rec.Script.DefaultLangSys:
            script_rec.Script.DefaultLangSys.FeatureIndex.append(
                kern_feat_index
            )
        for lang_rec in script_rec.Script.LangSysRecord:
            lang_rec.LangSys.FeatureIndex.append(kern_feat_index)


def _add_kerning(font: TTFont, f_glyphs: tuple[str, ...]) -> None:
    """Add PairPos Format 1 kern lookup for all custom kern pairs."""
    glyf_table = font["glyf"]
    hmtx_table = font["hmtx"]

    builder = PairPosBuilder(font, None)

    for f_name in f_glyphs:
        overhang = glyf_table[f_name].xMax - hmtx_table[f_name][0]
        for t_name in _TARGET_GLYPHS:
            kern = max(
                overhang - glyf_table[t_name].xMin + _KERN_OFFSET,
                _BASE_KERN[t_name],
            )
            builder.addGlyphPair(
                None,
                f_name,
                buildValue({"XAdvance": kern}),
                t_name,
                None,
            )

    descender_val = buildValue({"XAdvance": _DESCENDER_KERN})
    for open_glyph in _OPEN_PUNCT_GLYPHS:
        for desc_glyph in _DESCENDER_GLYPHS:
            builder.addGlyphPair(
                None,
                open_glyph,
                descender_val,
                desc_glyph,
                None,
            )

    lookup = builder.build()

    gpos = font["GPOS"].table
    lookup_index = len(gpos.LookupList.Lookup)
    gpos.LookupList.Lookup.append(lookup)
    _register_kern_feature(gpos, lookup_index)


def _build_font(
    upstream_path: Path,
    output_path: Path,
) -> None:
    """Build a single modified font from its upstream original."""
    font = TTFont(upstream_path)
    try:
        _harmonize_brackets(font)
        _add_kerning(font, _get_f_glyphs(font))
        font.save(output_path)
    finally:
        font.close()


_FONT_FILENAMES: Final[tuple[str, ...]] = (
    "EBGaramond08-Regular.woff2",
    "EBGaramond12-Regular.woff2",
)


def build_all(output_dir: Path) -> bool:
    """
    Build both modified fonts.

    Returns True if all outputs are table-equivalent.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    all_equivalent = True
    for filename in _FONT_FILENAMES:
        upstream = _UPSTREAM_DIR / filename
        if not upstream.exists():
            raise FileNotFoundError(f"Upstream font not found: {upstream}")

        output = output_dir / filename
        committed = _FONT_DIR / filename

        print(f"Building {filename}...")
        _build_font(upstream, output)

        built = TTFont(output)
        committed_font = TTFont(committed)
        try:
            skip = {"head", "GlyphOrder"}
            tags = sorted(
                (set(built.keys()) | set(committed_font.keys())) - skip
            )
            mismatched = [
                tag
                for tag in tags
                if built.getTableData(tag) != committed_font.getTableData(tag)
            ]
        finally:
            built.close()
            committed_font.close()

        if mismatched:
            print(f"  DIFFERS: {', '.join(mismatched)}")
            all_equivalent = False
        else:
            print("  PASS: table-equivalent to committed font")

    return all_equivalent


def main() -> None:
    """Build fonts and optionally install them."""
    output_dir = Path("/tmp/build_fonts_output")
    all_match = build_all(output_dir)

    if all_match:
        print("\nAll fonts are table-equivalent to committed versions.")
    else:
        print("\nSome tables differ (see details above).")

    if "--install" in sys.argv:
        for filename in _FONT_FILENAMES:
            src = output_dir / filename
            dst = _FONT_DIR / filename
            shutil.copy2(src, dst)
            print(f"Installed {dst}")


if __name__ == "__main__":
    main()
