"""
Build modified EBGaramond fonts from upstream originals.

Applies two modifications to EBGaramond08-Regular and EBGaramond12-Regular:
1. Bracket/brace harmonization: affine-maps Y coordinates of bracketleft,
   bracketright, braceleft, braceright so their yMin/yMax match parenleft.
2. F-pair GPOS kerning: adds a PairPos Format 1 lookup to the kern feature
   for f-variant glyphs × punctuation targets.

Usage:
    python scripts/build_fonts.py           # Build and verify
    python scripts/build_fonts.py --install # Build, verify, and overwrite committed fonts
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path
from typing import Final

from fontTools.misc.roundTools import otRound
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otTables
from fontTools.ttLib.tables.otTables import PairPos, PairSet, PairValueRecord

_FONT_DIR: Final[Path] = (
    Path(__file__).resolve().parent.parent
    / "quartz"
    / "static"
    / "styles"
    / "fonts"
    / "EBGaramond"
)
_UPSTREAM_DIR: Final[Path] = _FONT_DIR / "upstream"

_BRACKET_GLYPHS: Final[tuple[str, ...]] = (
    "bracketleft",
    "bracketright",
    "braceleft",
    "braceright",
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
    """Scale bracket/brace glyphs to match parenleft vertical extent."""
    paren = font["glyf"]["parenleft"]
    for name in _BRACKET_GLYPHS:
        _affine_map_glyph_y(font, name, paren.yMin, paren.yMax)


def _add_f_kerning(font: TTFont, f_glyphs: tuple[str, ...]) -> None:
    """Add PairPos Format 1 kern lookup for f-variant x punctuation pairs."""
    glyph_order = font.getGlyphOrder()

    def glyph_id(name: str) -> int:
        return glyph_order.index(name)

    glyf_table = font["glyf"]
    hmtx_table = font["hmtx"]
    target_x_mins = {t: glyf_table[t].xMin for t in _TARGET_GLYPHS}
    sorted_targets = sorted(_TARGET_GLYPHS, key=glyph_id)

    pair_sets: list[PairSet] = []
    for f_name in f_glyphs:
        overhang = glyf_table[f_name].xMax - hmtx_table[f_name][0]
        records: list[PairValueRecord] = []
        for t_name in sorted_targets:
            raw = max(overhang - target_x_mins[t_name] + _KERN_OFFSET, 0)
            kern = max(raw, _BASE_KERN[t_name])

            pvr = PairValueRecord()
            pvr.SecondGlyph = t_name
            pvr.Value1 = otTables.ValueRecord()
            pvr.Value1.XAdvance = kern
            records.append(pvr)

        ps = PairSet()
        ps.PairValueRecord = records
        pair_sets.append(ps)

    coverage = otTables.Coverage()
    coverage.glyphs = list(f_glyphs)

    subtable = PairPos()
    subtable.Format = 1
    subtable.Coverage = coverage
    subtable.ValueFormat1 = 4
    subtable.ValueFormat2 = 0
    subtable.PairSet = pair_sets

    lookup = otTables.Lookup()
    lookup.LookupType = 2
    lookup.LookupFlag = 0
    lookup.SubTable = [subtable]
    lookup.SubTableCount = 1

    gpos = font["GPOS"].table
    lookup_index = len(gpos.LookupList.Lookup)
    gpos.LookupList.Lookup.append(lookup)

    kern_feature = None
    for feat_rec in gpos.FeatureList.FeatureRecord:
        if feat_rec.FeatureTag == "kern":
            kern_feature = feat_rec
            break

    if kern_feature is not None:
        kern_feature.Feature.LookupListIndex.append(lookup_index)
        kern_feature.Feature.LookupCount = len(
            kern_feature.Feature.LookupListIndex
        )
    else:
        feat = otTables.Feature()
        feat.LookupListIndex = [lookup_index]
        feat.LookupCount = 1

        feat_rec = otTables.FeatureRecord()
        feat_rec.FeatureTag = "kern"
        feat_rec.Feature = feat
        gpos.FeatureList.FeatureRecord.append(feat_rec)

        kern_feat_index = len(gpos.FeatureList.FeatureRecord) - 1
        for script_rec in gpos.ScriptList.ScriptRecord:
            if script_rec.Script.DefaultLangSys:
                script_rec.Script.DefaultLangSys.FeatureIndex.append(
                    kern_feat_index
                )
                script_rec.Script.DefaultLangSys.FeatureCount = len(
                    script_rec.Script.DefaultLangSys.FeatureIndex
                )
            for lang_rec in script_rec.Script.LangSysRecord:
                lang_rec.LangSys.FeatureIndex.append(kern_feat_index)
                lang_rec.LangSys.FeatureCount = len(
                    lang_rec.LangSys.FeatureIndex
                )


def _build_font(
    upstream_path: Path, output_path: Path, f_glyphs: tuple[str, ...]
) -> None:
    font = TTFont(upstream_path)
    _harmonize_brackets(font)
    _add_f_kerning(font, f_glyphs)
    font.save(output_path)
    font.close()


def _verify_tables(built_path: Path, committed_path: Path, name: str) -> bool:
    """
    Compare all font tables (except head metadata).

    Returns True if equivalent.
    """
    built = TTFont(built_path)
    committed = TTFont(committed_path)

    skip_tables = {"head", "GlyphOrder"}
    all_match = True

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
                _report_glyf_diffs(built, committed, name)
            else:
                print(
                    f"  {tag}: binary differs"
                    f" ({len(built_data)} vs"
                    f" {len(committed_data)} bytes)"
                )
            all_match = False

    built.close()
    committed.close()
    return all_match


def _report_glyf_diffs(built: TTFont, committed: TTFont, name: str) -> None:
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

        diffs = []
        for i, (a, b) in enumerate(zip(gb.coordinates, gc.coordinates)):
            if a != b:
                diffs.append((i, a, b))
                total_diffs += 1

        max_delta = max(abs(a[1] - b[1]) for _, a, b in diffs)
        print(
            f"  glyf/{glyph_name}: {len(diffs)} coords differ "
            f"(max delta: {max_delta} unit)"
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
