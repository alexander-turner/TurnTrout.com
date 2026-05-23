"""
Build modified EBGaramond fonts from upstream originals.

Applies two modifications to EBGaramond08-Regular and EBGaramond12-Regular:
1. Bracket/brace harmonization: affine-maps Y coordinates of bracketleft,
   bracketright, braceleft, braceright so their yMin/yMax match parenleft.
2. F-pair GPOS kerning: adds a PairPos Format 1 lookup to the kern feature
   for f-variant glyphs × punctuation targets.

Usage:
    python scripts/build_fonts.py           # Build and verify
    python scripts/build_fonts.py --install # Build, verify, and overwrite
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path
from typing import Any, Final

from fontTools.misc.roundTools import otRound  # type: ignore[import-untyped]
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

_F_GLYPHS_08: Final[tuple[str, ...]] = (
    "f",
    "f_f",
    "f_f.1",
    "f.DEU",
    "f.long",
    "f_f.long",
    "f.subs",
    "f.ordn",
    "f.sinf",
    "f.sups",
    "f.short",
    "f_f.short",
)

_F_GLYPHS_12: Final[tuple[str, ...]] = (
    "f",
    "f_f",
    "f_f.long",
    "f.long",
    "f.DEU",
    "f.subs",
    "f.sinf",
    "f.ordn",
    "f.sups",
    "f_f.1",
    "f._f",
    "f._i",
    "f._asc",
)

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
    new_span = target_y_max - target_y_min

    if old_span == 0:
        return

    for i, (x, y) in enumerate(glyph.coordinates):
        y_new = otRound(target_y_min + (y - old_y_min) * new_span / old_span)
        glyph.coordinates[i] = (x, y_new)

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

    # No existing kern feature — create one and register it in all
    # scripts/languages.
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

    # F-variant glyphs × closing punctuation
    for f_name in f_glyphs:
        overhang = glyf_table[f_name].xMax - hmtx_table[f_name][0]
        for t_name in _TARGET_GLYPHS:
            raw = max(
                overhang - glyf_table[t_name].xMin + _KERN_OFFSET,
                0,
            )
            kern = max(raw, _BASE_KERN[t_name])
            builder.addGlyphPair(
                None,
                f_name,
                buildValue({"XAdvance": kern}),
                t_name,
                None,
            )

    # Open punctuation × descender letters
    descender_val = buildValue({"XAdvance": _DESCENDER_KERN})
    for open_glyph in _OPEN_PUNCT_GLYPHS:
        for desc_glyph in _DESCENDER_GLYPHS:
            builder.addGlyphPair(
                None, open_glyph, descender_val, desc_glyph, None
            )

    lookup = builder.build()

    gpos = font["GPOS"].table
    lookup_index = len(gpos.LookupList.Lookup)
    gpos.LookupList.Lookup.append(lookup)
    _register_kern_feature(gpos, lookup_index)


def _build_font(
    upstream_path: Path,
    output_path: Path,
    f_glyphs: tuple[str, ...],
) -> None:
    """Build a single modified font from its upstream original."""
    font = TTFont(upstream_path)
    try:
        _harmonize_brackets(font)
        _add_kerning(font, f_glyphs)
        font.save(output_path)
    finally:
        font.close()


def _verify_tables(built_path: Path, committed_path: Path, label: str) -> bool:
    """
    Compare all font tables (except head metadata).

    Returns True if equivalent.
    """
    built = TTFont(built_path)
    committed = TTFont(committed_path)

    skip_tables = {"head", "GlyphOrder"}
    all_match = True

    try:
        for tag in sorted(set(built.keys()) | set(committed.keys())):
            if tag in skip_tables:
                continue
            if tag not in built:
                print(f"  {tag}: missing from built")
                all_match = False
                continue
            if tag not in committed:
                print(f"  {tag}: extra in built")
                all_match = False
                continue

            built_data = built.getTableData(tag)
            committed_data = committed.getTableData(tag)
            if built_data != committed_data:
                if tag == "glyf":
                    _report_glyf_diffs(built, committed, label)
                else:
                    print(
                        f"  {tag}: binary differs"
                        f" ({len(built_data)} vs"
                        f" {len(committed_data)} bytes)"
                    )
                all_match = False
    finally:
        built.close()
        committed.close()

    return all_match


def _report_glyf_diffs(built: TTFont, committed: TTFont, label: str) -> None:
    """Report per-glyph coordinate differences in the glyf table."""
    glyf_b = built["glyf"]
    glyf_c = committed["glyf"]
    total_diffs = 0

    for glyph_name in glyf_b.keys():
        gb = glyf_b[glyph_name]
        gc = glyf_c[glyph_name]
        if not hasattr(gb, "coordinates") or not hasattr(gc, "coordinates"):
            continue
        if gb.coordinates == gc.coordinates:
            continue

        diffs = [
            (i, a, b)
            for i, (a, b) in enumerate(zip(gb.coordinates, gc.coordinates))
            if a != b
        ]
        total_diffs += len(diffs)

        max_delta = max(abs(a[1] - b[1]) for _, a, b in diffs)
        print(
            f"  glyf/{glyph_name} ({label}): {len(diffs)} coords"
            f" differ (max delta: {max_delta} unit)"
        )

    if total_diffs > 0:
        print(
            f"  glyf total: {total_diffs} coordinate differences "
            f"(rounding edge cases in bracket Y-mapping)"
        )


def build_all(output_dir: Path) -> bool:
    """
    Build both modified fonts.

    Returns True if all outputs are table-equivalent.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    configs: tuple[tuple[str, tuple[str, ...]], ...] = (
        ("EBGaramond08-Regular.woff2", _F_GLYPHS_08),
        ("EBGaramond12-Regular.woff2", _F_GLYPHS_12),
    )

    all_equivalent = True
    for filename, f_glyphs in configs:
        upstream = _UPSTREAM_DIR / filename
        output = output_dir / filename
        committed = _FONT_DIR / filename

        if not upstream.exists():
            raise FileNotFoundError(f"Upstream font not found: {upstream}")

        print(f"Building {filename}...")
        _build_font(upstream, output, f_glyphs)

        tables_match = _verify_tables(output, committed, filename)
        if tables_match:
            print("  PASS: table-equivalent to committed font")
        else:
            all_equivalent = False

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
        for filename in (
            "EBGaramond08-Regular.woff2",
            "EBGaramond12-Regular.woff2",
        ):
            src = output_dir / filename
            dst = _FONT_DIR / filename
            shutil.copy2(src, dst)
            print(f"Installed {dst}")


if __name__ == "__main__":
    main()
