"""
Build modified EBGaramond fonts from upstream originals.

Applies two modifications to EBGaramond08-Regular and EBGaramond12-Regular:
1. Bracket/brace harmonization: affine-maps Y coordinates of bracketleft,
   bracketright, braceleft, braceright so their yMin/yMax match parenleft.
2. GPOS kerning: adds a PairPos Format 1 lookup to the kern feature
   for f-variant glyphs x punctuation, open-punct x descender letters,
   close-punct x comma/semicolon (tightened to undo a wide left sidebearing),
   and quote x bracket (loosened so a curly quote's ink clears an adjacent
   bracket, both open-quote+"[" and "]"+close-quote).

Usage:
    python scripts/build_fonts.py           # Build and verify
    python scripts/build_fonts.py --install # Build, verify, and overwrite
"""

from __future__ import annotations

import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any, Final

from fontTools.otlLib.builder import (
    PairPosBuilder,
    buildValue,
)
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otTables

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

# Minimum clearance an f-glyph gets before each following punctuation mark. It
# only binds when a glyph's own ink overhang asks for less (see the formula in
# _add_overhang_kern_pairs); an f/ff whose hook overhangs far past its advance
# still gets the larger overhang-derived value. The close-bracket floors stay
# low so a non-overhanging ligature (fi, fl) sits at natural spacing before ")"
# rather than floating away from it.
_BASE_KERN: Final[dict[str, int]] = {
    "quotedbl": 250,
    "quotesingle": 250,
    "parenleft": 250,
    "parenright": 150,
    "bracketright": 150,
    "braceright": 150,
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

_CLOSE_PUNCT_GLYPHS: Final[tuple[str, ...]] = (
    "parenright",
    "bracketright",
    "braceright",
)

_DESCENDER_GLYPHS: Final[tuple[str, ...]] = (
    "g",
    "j",
    "p",
    "q",
    "y",
)

_CAP_OVERHANG_GLYPHS: Final[tuple[str, ...]] = (
    "T",
    "V",
    "Y",
)

_OPEN_DESCENDER_KERN: Final[int] = 120

# Capital "J" hooks below the baseline and its ink overhangs far to the left
# (xMin well left of the origin), so after an open bracket its tail swings into
# the bracket's descender exactly as a lowercase descender's does. It isn't in
# _DESCENDER_GLYPHS because its right side is ordinary, so it needs clearance
# only after open punctuation, not before closing punctuation. The value gives
# "(J" the same visual left gap that "(j" already clears to.
_CAP_DESCENDER_GLYPHS: Final[tuple[str, ...]] = ("J",)
_OPEN_CAP_DESCENDER_KERN: Final[int] = 190

_CLOSE_DESCENDER_KERN: Final[dict[str, int]] = {
    "g": 20,
    "j": 80,
    "p": 40,
    "q": 80,
    "y": 40,
}
_CAP_CLOSE_KERN: Final[int] = 80

# A curly quote's ink hangs at the top and its tail swings toward an adjacent
# bracket, so an open quote before "[" and a close quote after "]" both read
# cramped even though the advance gap is wide. A small symmetric kern clears
# both. The 12 master's gaps are already roomy, so the space is imperceptible
# there.
_OPEN_QUOTE_GLYPHS: Final[tuple[str, ...]] = (
    "quotedblleft",
    "quoteleft",
)
_CLOSE_QUOTE_GLYPHS: Final[tuple[str, ...]] = (
    "quotedblright",
    "quoteright",
)
_QUOTE_BRACKET_KERN: Final[int] = 70

# Comma-family punctuation carries a wide left sidebearing in the 08 master,
# so it floats after a closing bracket (e.g. the ");" bigram). Pull it back so
# its left gap matches a lowercase letter's, using "n" as the reference glyph.
# The 12 master already sets these tightly, so the computed value clamps to 0
# there and leaves it untouched.
_TIGHTEN_REFERENCE_GLYPH: Final[str] = "n"
_TIGHTEN_TARGET_GLYPHS: Final[tuple[str, ...]] = (
    "comma",
    "semicolon",
)


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

    # otTables builds Feature/FeatureRecord dynamically, so neither static tool sees them.
    feat = otTables.Feature()  # pylint: disable=no-member # pyright: ignore[reportAttributeAccessIssue]
    feat.LookupListIndex = [lookup_index]
    feat.LookupCount = 1

    feat_rec = otTables.FeatureRecord()  # pylint: disable=no-member # pyright: ignore[reportAttributeAccessIssue]
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


def _add_overhang_kern_pairs(
    builder: PairPosBuilder,
    font: TTFont,
    source_glyphs: tuple[str, ...],
) -> None:
    """Add kern pairs computed from glyph overhang."""
    glyf_table = font["glyf"]
    hmtx_table = font["hmtx"]
    for src in source_glyphs:
        overhang = glyf_table[src].xMax - hmtx_table[src][0]
        for tgt in _TARGET_GLYPHS:
            kern = max(
                overhang - glyf_table[tgt].xMin + _KERN_OFFSET,
                _BASE_KERN[tgt],
            )
            builder.addGlyphPair(
                None,
                src,
                buildValue({"XAdvance": kern}),
                tgt,
                None,
            )


def _add_lsb_tighten_pairs(
    builder: PairPosBuilder,
    font: TTFont,
    sources: tuple[str, ...],
    targets: tuple[str, ...],
) -> None:
    """
    Add negative kern pairs that normalize each target's left sidebearing down
    to the reference glyph's.

    Only tightens (never loosens), so targets already tighter than the reference
    are skipped.
    """
    glyf_table = font["glyf"]
    reference_lsb = glyf_table[_TIGHTEN_REFERENCE_GLYPH].xMin
    for src in sources:
        for tgt in targets:
            kern = min(0, reference_lsb - glyf_table[tgt].xMin)
            if kern == 0:
                continue
            builder.addGlyphPair(
                None,
                src,
                buildValue({"XAdvance": kern}),
                tgt,
                None,
            )


def _add_fixed_kern_pairs(
    builder: PairPosBuilder,
    sources: tuple[str, ...],
    targets: tuple[str, ...],
    kern_values: int | dict[str, int],
) -> None:
    """Add fixed-value kern pairs for each source x target."""
    for src in sources:
        value = (
            kern_values[src] if isinstance(kern_values, dict) else kern_values
        )
        val = buildValue({"XAdvance": value})
        for tgt in targets:
            builder.addGlyphPair(None, src, val, tgt, None)


_FIXED_KERN_SPECS: Final[
    tuple[tuple[tuple[str, ...], tuple[str, ...], int | dict[str, int]], ...]
] = (
    (_OPEN_PUNCT_GLYPHS, _DESCENDER_GLYPHS, _OPEN_DESCENDER_KERN),
    (_OPEN_PUNCT_GLYPHS, _CAP_DESCENDER_GLYPHS, _OPEN_CAP_DESCENDER_KERN),
    (_DESCENDER_GLYPHS, _CLOSE_PUNCT_GLYPHS, _CLOSE_DESCENDER_KERN),
    (_CAP_OVERHANG_GLYPHS, _CLOSE_PUNCT_GLYPHS, _CAP_CLOSE_KERN),
    (_OPEN_QUOTE_GLYPHS, ("bracketleft",), _QUOTE_BRACKET_KERN),
    (("bracketright",), _CLOSE_QUOTE_GLYPHS, _QUOTE_BRACKET_KERN),
)


def _add_kerning(font: TTFont, f_glyphs: tuple[str, ...]) -> None:
    """Add PairPos Format 1 kern lookup for all custom kern pairs."""
    builder = PairPosBuilder(font, None)

    _add_overhang_kern_pairs(builder, font, f_glyphs)
    for sources, targets, values in _FIXED_KERN_SPECS:
        _add_fixed_kern_pairs(builder, sources, targets, values)
    _add_lsb_tighten_pairs(
        builder, font, _CLOSE_PUNCT_GLYPHS, _TIGHTEN_TARGET_GLYPHS
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
    output_dir = Path(tempfile.mkdtemp(prefix="build_fonts_"))
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
    elif not all_match:
        # Verify mode: signal drift so a CI invocation fails instead of
        # silently passing on out-of-date committed fonts.
        sys.exit(1)


if __name__ == "__main__":
    main()
