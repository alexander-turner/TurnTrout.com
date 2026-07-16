"""Tests for the EBGaramond font build pipeline."""

from pathlib import Path
from typing import Any

import pytest
from fontTools.ttLib import TTFont  # type: ignore[import-untyped]

from .. import build_fonts
from ..build_fonts import (
    _BASE_KERN,
    _BRACE_GLYPHS,
    _CAP_DESCENDER_GLYPHS,
    _CAP_OVERHANG_GLYPHS,
    _CLOSE_DESCENDER_KERN,
    _CLOSE_PUNCT_GLYPHS,
    _CLOSE_QUOTE_GLYPHS,
    _DESCENDER_GLYPHS,
    _FONT_DIR,
    _KERN_OFFSET,
    _OPEN_CAP_DESCENDER_KERN,
    _OPEN_DESCENDER_KERN,
    _OPEN_PUNCT_GLYPHS,
    _OPEN_QUOTE_GLYPHS,
    _QUOTE_BRACKET_KERN,
    _SPACE_CLEARANCE_MIN,
    _SPACE_CLEARANCE_QUANTUM,
    _SQUARE_BRACKET_GLYPHS,
    _TARGET_GLYPHS,
    _TIGHTEN_REFERENCE_GLYPH,
    _TIGHTEN_TARGET_GLYPHS,
    _UPSTREAM_DIR,
    _add_kerning,
    _affine_map_glyph_y,
    _banded_ink_xmax,
    _collect_space_clearance_groups,
    _get_f_glyphs,
    _glyph_overhang,
    _harmonize_brackets,
    _space_glyph_names,
    _spacing_glyph_names,
    build_all,
)


@pytest.fixture()
def upstream_08() -> TTFont:
    return TTFont(_UPSTREAM_DIR / "EBGaramond08-Regular.woff2")


@pytest.fixture()
def upstream_12() -> TTFont:
    return TTFont(_UPSTREAM_DIR / "EBGaramond12-Regular.woff2")


class TestGetFGlyphs:
    def test_finds_all_f_variants_in_08pt(self, upstream_08: TTFont) -> None:
        result = _get_f_glyphs(upstream_08)
        assert "f" in result
        assert "f_f" in result
        assert "f.long" in result
        assert "f.short" in result
        assert len(result) >= 12

    def test_finds_extra_glyphs_in_12pt(self, upstream_12: TTFont) -> None:
        result = _get_f_glyphs(upstream_12)
        assert "f._f" in result
        assert "f._i" in result
        assert "f._asc" in result

    def test_excludes_zero_overhang_glyphs(self, upstream_12: TTFont) -> None:
        result = _get_f_glyphs(upstream_12)
        glyf = upstream_12["glyf"]
        hmtx = upstream_12["hmtx"]
        for name in result:
            overhang = glyf[name].xMax - hmtx[name][0]
            assert overhang > 0, f"{name} has no overhang"


class TestAffineMapGlyphY:
    def test_maps_to_target_bounds(self, upstream_08: TTFont) -> None:
        _affine_map_glyph_y(upstream_08, "bracketleft", -500, 1500)
        glyph = upstream_08["glyf"]["bracketleft"]
        assert glyph.yMin == -500
        assert glyph.yMax == 1500

    def test_preserves_x_coordinates(self, upstream_08: TTFont) -> None:
        glyf = upstream_08["glyf"]
        original_xs = [c[0] for c in glyf["bracketleft"].coordinates]
        _affine_map_glyph_y(upstream_08, "bracketleft", -510, 1481)
        new_xs = [c[0] for c in glyf["bracketleft"].coordinates]
        assert original_xs == new_xs

    def test_identity_when_bounds_match(self, upstream_08: TTFont) -> None:
        glyph = upstream_08["glyf"]["bracketleft"]
        original_coords = list(glyph.coordinates)
        _affine_map_glyph_y(upstream_08, "bracketleft", glyph.yMin, glyph.yMax)
        assert list(glyph.coordinates) == original_coords

    def test_no_contour_glyph_is_noop(self, upstream_08: TTFont) -> None:
        assert upstream_08["glyf"]["space"].numberOfContours == 0
        _affine_map_glyph_y(upstream_08, "space", -100, 100)


class TestHarmonizeBrackets:
    def test_braces_match_full_paren_bounds(self, upstream_08: TTFont) -> None:
        paren = upstream_08["glyf"]["parenleft"]
        _harmonize_brackets(upstream_08)

        for name in _BRACE_GLYPHS:
            glyph = upstream_08["glyf"][name]
            assert glyph.yMin == paren.yMin, f"{name} yMin"
            assert glyph.yMax == paren.yMax, f"{name} yMax"

    def test_square_brackets_match_paren_top_only(
        self, upstream_08: TTFont
    ) -> None:
        glyf = upstream_08["glyf"]
        original_y_mins = {
            name: glyf[name].yMin for name in _SQUARE_BRACKET_GLYPHS
        }
        paren = glyf["parenleft"]
        _harmonize_brackets(upstream_08)

        for name in _SQUARE_BRACKET_GLYPHS:
            glyph = glyf[name]
            assert glyph.yMax == paren.yMax, f"{name} yMax"
            assert glyph.yMin == original_y_mins[name], (
                f"{name} yMin should stay at original"
            )

    @pytest.mark.parametrize(
        "font_fixture,expected_paren_y_max",
        [
            ("upstream_08", 1481),
            ("upstream_12", 1444),
        ],
    )
    def test_all_glyphs_match_paren_y_max(
        self,
        font_fixture: str,
        expected_paren_y_max: int,
        request: pytest.FixtureRequest,
    ) -> None:
        font: TTFont = request.getfixturevalue(font_fixture)
        _harmonize_brackets(font)
        for name in _BRACE_GLYPHS + _SQUARE_BRACKET_GLYPHS:
            glyph = font["glyf"][name]
            assert glyph.yMax == expected_paren_y_max, f"{name} yMax"


class TestKerning:
    def test_creates_kern_feature_when_missing(
        self, upstream_08: TTFont
    ) -> None:
        gpos = upstream_08["GPOS"].table
        kern_tags = [f.FeatureTag for f in gpos.FeatureList.FeatureRecord]
        assert "kern" not in kern_tags

        _add_kerning(upstream_08, _get_f_glyphs(upstream_08))

        kern_tags = [f.FeatureTag for f in gpos.FeatureList.FeatureRecord]
        assert "kern" in kern_tags

    def test_appends_to_existing_kern_feature(
        self, upstream_12: TTFont
    ) -> None:
        gpos = upstream_12["GPOS"].table
        original_kern = None
        for f in gpos.FeatureList.FeatureRecord:
            if f.FeatureTag == "kern":
                original_kern = f
                break
        assert original_kern is not None
        original_count = len(original_kern.Feature.LookupListIndex)
        original_lookup_count = len(gpos.LookupList.Lookup)

        bucket_count = sum(
            len(groups)
            for _targets, groups in _collect_space_clearance_groups(upstream_12)
        )

        _add_kerning(upstream_12, _get_f_glyphs(upstream_12))

        # One PairPos kern lookup plus one contextual chain lookup per
        # clearance bucket, all registered in the existing feature.
        expected_added = 1 + bucket_count
        assert (
            len(original_kern.Feature.LookupListIndex)
            == original_count + expected_added
        )
        # Each chain lookup also appends its inner SinglePos lookup, which is
        # reached through the chain rather than the feature list.
        assert (
            len(gpos.LookupList.Lookup)
            == original_lookup_count + expected_added + bucket_count
        )

    def test_pair_value_records_sorted_by_glyph_id(
        self, upstream_08: TTFont
    ) -> None:
        _add_kerning(upstream_08, _get_f_glyphs(upstream_08))

        gpos = upstream_08["GPOS"].table
        subtable = gpos.LookupList.Lookup[-1].SubTable[0]
        glyph_order = upstream_08.getGlyphOrder()

        for ps in subtable.PairSet:
            gids = [
                glyph_order.index(pvr.SecondGlyph) for pvr in ps.PairValueRecord
            ]
            assert gids == sorted(gids)

    def test_coverage_glyphs_sorted_by_glyph_id(
        self, upstream_08: TTFont
    ) -> None:
        _add_kerning(upstream_08, _get_f_glyphs(upstream_08))

        gpos = upstream_08["GPOS"].table
        subtable = gpos.LookupList.Lookup[-1].SubTable[0]
        glyph_order = upstream_08.getGlyphOrder()

        gids = [glyph_order.index(g) for g in subtable.Coverage.glyphs]
        assert gids == sorted(gids)

    @pytest.mark.parametrize(
        "font_fixture",
        ["upstream_08", "upstream_12"],
        ids=["08pt", "12pt"],
    )
    def test_all_source_glyphs_in_coverage(
        self,
        font_fixture: str,
        request: pytest.FixtureRequest,
    ) -> None:
        font: TTFont = request.getfixturevalue(font_fixture)
        f_glyphs = _get_f_glyphs(font)
        glyf = font["glyf"]
        ref_lsb = glyf[_TIGHTEN_REFERENCE_GLYPH].xMin
        tighten_applies = any(
            glyf[t].xMin > ref_lsb for t in _TIGHTEN_TARGET_GLYPHS
        )
        _add_kerning(font, f_glyphs)
        subtable = font["GPOS"].table.LookupList.Lookup[-1].SubTable[0]
        expected = (
            set(f_glyphs)
            | set(_OPEN_PUNCT_GLYPHS)
            | set(_DESCENDER_GLYPHS)
            | set(_CAP_OVERHANG_GLYPHS)
            | set(_OPEN_QUOTE_GLYPHS)
            | {"bracketright"}
        )
        if tighten_applies:
            expected |= set(_CLOSE_PUNCT_GLYPHS)
        assert set(subtable.Coverage.glyphs) == expected

    def test_f_kern_values_match_formula(self, upstream_08: TTFont) -> None:
        glyf = upstream_08["glyf"]
        hmtx = upstream_08["hmtx"]
        f_glyphs = _get_f_glyphs(upstream_08)
        _add_kerning(upstream_08, f_glyphs)

        subtable = upstream_08["GPOS"].table.LookupList.Lookup[-1].SubTable[0]

        f_set = set(f_glyphs)
        for i, src in enumerate(subtable.Coverage.glyphs):
            if src not in f_set:
                continue
            overhang = glyf[src].xMax - hmtx[src][0]
            for pvr in subtable.PairSet[i].PairValueRecord:
                t_name = pvr.SecondGlyph
                expected = max(
                    overhang - glyf[t_name].xMin + _KERN_OFFSET,
                    _BASE_KERN[t_name],
                )
                assert pvr.Value1.XAdvance == expected, f"{src}->{t_name}"

    def test_open_descender_kern_values(self, upstream_08: TTFont) -> None:
        _add_kerning(upstream_08, _get_f_glyphs(upstream_08))
        subtable = upstream_08["GPOS"].table.LookupList.Lookup[-1].SubTable[0]

        desc_set = set(_DESCENDER_GLYPHS)
        for i, src in enumerate(subtable.Coverage.glyphs):
            if src not in set(_OPEN_PUNCT_GLYPHS):
                continue
            for pvr in subtable.PairSet[i].PairValueRecord:
                if pvr.SecondGlyph in desc_set:
                    assert pvr.Value1.XAdvance == _OPEN_DESCENDER_KERN, (
                        f"{src}->{pvr.SecondGlyph}"
                    )

    def test_open_cap_descender_kern_values(self, upstream_08: TTFont) -> None:
        _add_kerning(upstream_08, _get_f_glyphs(upstream_08))
        subtable = upstream_08["GPOS"].table.LookupList.Lookup[-1].SubTable[0]

        cap_desc_set = set(_CAP_DESCENDER_GLYPHS)
        seen: set[tuple[str, str]] = set()
        for i, src in enumerate(subtable.Coverage.glyphs):
            if src not in set(_OPEN_PUNCT_GLYPHS):
                continue
            for pvr in subtable.PairSet[i].PairValueRecord:
                if pvr.SecondGlyph in cap_desc_set:
                    assert pvr.Value1.XAdvance == _OPEN_CAP_DESCENDER_KERN, (
                        f"{src}->{pvr.SecondGlyph}"
                    )
                    seen.add((src, pvr.SecondGlyph))
        expected = {
            (src, tgt)
            for src in _OPEN_PUNCT_GLYPHS
            for tgt in _CAP_DESCENDER_GLYPHS
        }
        assert seen == expected

    def test_close_descender_kern_values(self, upstream_08: TTFont) -> None:
        _add_kerning(upstream_08, _get_f_glyphs(upstream_08))
        subtable = upstream_08["GPOS"].table.LookupList.Lookup[-1].SubTable[0]

        close_set = set(_CLOSE_PUNCT_GLYPHS)
        for i, src in enumerate(subtable.Coverage.glyphs):
            if src not in set(_DESCENDER_GLYPHS):
                continue
            for pvr in subtable.PairSet[i].PairValueRecord:
                if pvr.SecondGlyph in close_set:
                    assert pvr.Value1.XAdvance == _CLOSE_DESCENDER_KERN[src], (
                        f"{src}->{pvr.SecondGlyph}"
                    )

    @pytest.mark.parametrize(
        "font_fixture",
        ["upstream_08", "upstream_12"],
        ids=["08pt", "12pt"],
    )
    def test_open_quote_bracket_kern_values(
        self,
        font_fixture: str,
        request: pytest.FixtureRequest,
    ) -> None:
        font: TTFont = request.getfixturevalue(font_fixture)
        _add_kerning(font, _get_f_glyphs(font))
        subtable = font["GPOS"].table.LookupList.Lookup[-1].SubTable[0]

        quote_set = set(_OPEN_QUOTE_GLYPHS)
        kerned: set[str] = set()
        for i, src in enumerate(subtable.Coverage.glyphs):
            if src not in quote_set:
                continue
            for pvr in subtable.PairSet[i].PairValueRecord:
                if pvr.SecondGlyph == "bracketleft":
                    assert pvr.Value1.XAdvance == _QUOTE_BRACKET_KERN, (
                        f"{src}->bracketleft"
                    )
                    kerned.add(src)
        assert kerned == quote_set

    @pytest.mark.parametrize(
        "font_fixture",
        ["upstream_08", "upstream_12"],
        ids=["08pt", "12pt"],
    )
    def test_bracket_close_quote_kern_values(
        self,
        font_fixture: str,
        request: pytest.FixtureRequest,
    ) -> None:
        font: TTFont = request.getfixturevalue(font_fixture)
        _add_kerning(font, _get_f_glyphs(font))
        subtable = font["GPOS"].table.LookupList.Lookup[-1].SubTable[0]

        quote_set = set(_CLOSE_QUOTE_GLYPHS)
        kerned: set[str] = set()
        for i, src in enumerate(subtable.Coverage.glyphs):
            if src != "bracketright":
                continue
            for pvr in subtable.PairSet[i].PairValueRecord:
                if pvr.SecondGlyph in quote_set:
                    assert pvr.Value1.XAdvance == _QUOTE_BRACKET_KERN, (
                        f"bracketright->{pvr.SecondGlyph}"
                    )
                    kerned.add(pvr.SecondGlyph)
        assert kerned == quote_set

    def _tighten_pairs(self, font: TTFont) -> dict[tuple[str, str], int]:
        subtable = font["GPOS"].table.LookupList.Lookup[-1].SubTable[0]
        target_set = set(_TIGHTEN_TARGET_GLYPHS)
        close_set = set(_CLOSE_PUNCT_GLYPHS)
        pairs: dict[tuple[str, str], int] = {}
        for i, src in enumerate(subtable.Coverage.glyphs):
            if src not in close_set:
                continue
            for pvr in subtable.PairSet[i].PairValueRecord:
                if pvr.SecondGlyph in target_set:
                    pairs[(src, pvr.SecondGlyph)] = pvr.Value1.XAdvance
        return pairs

    def test_tighten_pairs_match_lsb_formula_08pt(
        self, upstream_08: TTFont
    ) -> None:
        glyf = upstream_08["glyf"]
        ref_lsb = glyf[_TIGHTEN_REFERENCE_GLYPH].xMin
        _add_kerning(upstream_08, _get_f_glyphs(upstream_08))
        pairs = self._tighten_pairs(upstream_08)

        # The 08 master has a wide comma/semicolon sidebearing, so every
        # close-punct x target pair is present and strictly negative.
        assert pairs
        for (src, tgt), value in pairs.items():
            assert value == ref_lsb - glyf[tgt].xMin, f"{src}->{tgt}"
            assert value < 0, f"{src}->{tgt} should tighten"

    def test_tighten_skips_already_tight_targets_12pt(
        self, upstream_12: TTFont
    ) -> None:
        glyf = upstream_12["glyf"]
        ref_lsb = glyf[_TIGHTEN_REFERENCE_GLYPH].xMin
        # The 12 master sets these targets tighter than the reference, so no
        # tighten pairs should be emitted (clamped to 0, then skipped).
        assert all(glyf[t].xMin <= ref_lsb for t in _TIGHTEN_TARGET_GLYPHS)
        _add_kerning(upstream_12, _get_f_glyphs(upstream_12))
        assert self._tighten_pairs(upstream_12) == {}

    def test_kern_feature_in_all_scripts(self, upstream_08: TTFont) -> None:
        _add_kerning(upstream_08, _get_f_glyphs(upstream_08))
        gpos = upstream_08["GPOS"].table

        kern_idx = None
        for i, f in enumerate(gpos.FeatureList.FeatureRecord):
            if f.FeatureTag == "kern":
                kern_idx = i
                break
        assert kern_idx is not None

        for sr in gpos.ScriptList.ScriptRecord:
            if sr.Script.DefaultLangSys:
                assert kern_idx in sr.Script.DefaultLangSys.FeatureIndex
            for lr in sr.Script.LangSysRecord:
                assert kern_idx in lr.LangSys.FeatureIndex


def _space_clearance_lookups(
    font: TTFont, start: int
) -> list[tuple[Any, Any, int]]:
    """(chain subtable, inner SinglePos subtable, XAdvance) for lookups added
    from ``start`` onward — the contextual space-clearance lookups."""
    lookups = font["GPOS"].table.LookupList.Lookup
    out: list[tuple[Any, Any, int]] = []
    for i in range(start, len(lookups)):
        lookup = lookups[i]
        if lookup.LookupType != 8:
            continue
        subtable = lookup.SubTable[0]
        inner_index = subtable.PosLookupRecord[0].LookupListIndex
        inner = lookups[inner_index].SubTable[0]
        out.append((subtable, inner, inner.Value.XAdvance))
    return out


class TestSpaceOverhangClearance:
    def test_glyph_overhang_sign(self, upstream_08: TTFont) -> None:
        # f's hook overhangs its advance; n sits fully inside it.
        assert _glyph_overhang(upstream_08, "f") > 0
        assert _glyph_overhang(upstream_08, _TIGHTEN_REFERENCE_GLYPH) < 0

    def test_space_glyph_names_includes_nbsp(self, upstream_08: TTFont) -> None:
        names = _space_glyph_names(upstream_08)
        assert names[0] == "space"
        assert upstream_08.getBestCmap()[0x00A0] in names

    def test_spacing_glyph_names_excludes_marks(
        self, upstream_08: TTFont
    ) -> None:
        names = _spacing_glyph_names(upstream_08)
        assert "f" in names
        assert "Q" in names
        # Combining marks never precede a word space.
        assert "tildecomb" not in names

    def test_banded_ink_xmax(self, upstream_08: TTFont) -> None:
        glyf = upstream_08["glyf"]
        quote_y_min = glyf["quotedblleft"].yMin
        quote_y_max = glyf["quotedblleft"].yMax
        # The f hook reaches into the quote band, past f's advance.
        f_xmax = _banded_ink_xmax(upstream_08, "f", quote_y_min, quote_y_max)
        assert f_xmax is not None
        assert f_xmax > upstream_08["hmtx"]["f"][0]
        # o has no ink at quote height; space has no ink at all.
        assert (
            _banded_ink_xmax(upstream_08, "o", quote_y_min, quote_y_max) is None
        )
        assert (
            _banded_ink_xmax(upstream_08, "space", quote_y_min, quote_y_max)
            is None
        )

    @pytest.mark.parametrize(
        "font_fixture", ["upstream_08", "upstream_12"], ids=["08pt", "12pt"]
    )
    def test_band_semantics(
        self, font_fixture: str, request: pytest.FixtureRequest
    ) -> None:
        font: TTFont = request.getfixturevalue(font_fixture)
        collected = _collect_space_clearance_groups(font)
        assert len(collected) == 2
        (quote_targets, quote_groups), (bracket_targets, bracket_groups) = (
            collected
        )
        assert "quotedblleft" in quote_targets
        assert "parenleft" in bracket_targets

        quote_sources = {s for g in quote_groups.values() for s in g}
        bracket_sources = {s for g in bracket_groups.values() for s in g}
        # The f hook lives at quote height, so it needs clearance everywhere.
        assert "f" in quote_sources
        assert "f" in bracket_sources
        # Q's tail overhangs at the baseline, below a quote's ink but inside
        # a bracket's, so band filtering keeps "Q “" tight while clearing
        # "Q (".
        assert "Q" not in quote_sources
        assert "Q" in bracket_sources
        # The reference glyph never clears itself.
        assert _TIGHTEN_REFERENCE_GLYPH not in quote_sources | bracket_sources

        for groups in (quote_groups, bracket_groups):
            for clearance in groups:
                assert clearance >= _SPACE_CLEARANCE_MIN
                assert clearance % _SPACE_CLEARANCE_QUANTUM == 0

    @pytest.mark.parametrize(
        "font_fixture", ["upstream_08", "upstream_12"], ids=["08pt", "12pt"]
    )
    def test_chain_lookups_match_collected_groups(
        self, font_fixture: str, request: pytest.FixtureRequest
    ) -> None:
        font: TTFont = request.getfixturevalue(font_fixture)
        expected = _collect_space_clearance_groups(font)
        space_names = set(_space_glyph_names(font))
        start = len(font["GPOS"].table.LookupList.Lookup)
        _add_kerning(font, _get_f_glyphs(font))

        chains = _space_clearance_lookups(font, start)
        assert len(chains) == sum(len(groups) for _t, groups in expected)

        built = {}
        for chain, inner, xadvance in chains:
            assert chain.Format == 3
            assert set(chain.InputCoverage[0].glyphs) == space_names
            assert set(inner.Coverage.glyphs) == space_names
            key = (
                frozenset(chain.LookAheadCoverage[0].glyphs),
                xadvance,
            )
            built[key] = set(chain.BacktrackCoverage[0].glyphs)

        for targets, groups in expected:
            for clearance, sources in groups.items():
                assert built[(frozenset(targets), clearance)] == set(sources)

    def test_coverage_glyphs_sorted(self, upstream_12: TTFont) -> None:
        start = len(upstream_12["GPOS"].table.LookupList.Lookup)
        _add_kerning(upstream_12, _get_f_glyphs(upstream_12))
        order = upstream_12.getGlyphOrder()

        for chain, inner, _xadvance in _space_clearance_lookups(
            upstream_12, start
        ):
            coverages = [
                chain.BacktrackCoverage[0],
                chain.InputCoverage[0],
                chain.LookAheadCoverage[0],
                inner.Coverage,
            ]
            for coverage in coverages:
                gids = [order.index(g) for g in coverage.glyphs]
                assert gids == sorted(gids)


class TestTableEquivalence:
    """Verify built fonts are table-equivalent to committed fonts."""

    _SKIP_TABLES = frozenset({"head", "GlyphOrder"})

    def _table_tags(self, font: TTFont) -> frozenset[str]:
        return frozenset(font.keys()) - self._SKIP_TABLES

    @pytest.mark.parametrize(
        "filename",
        [
            "EBGaramond08-Regular.woff2",
            "EBGaramond12-Regular.woff2",
        ],
        ids=["08pt", "12pt"],
    )
    def test_all_tables_match(self, tmp_path: Path, filename: str) -> None:
        output = tmp_path / filename
        build_fonts._build_font(_UPSTREAM_DIR / filename, output)

        built = TTFont(output)
        committed = TTFont(_FONT_DIR / filename)

        for tag in self._table_tags(built) | self._table_tags(committed):
            assert built.getTableData(tag) == committed.getTableData(tag), (
                f"Table {tag} differs"
            )


class TestBuildAll:
    def test_builds_both_fonts(self, tmp_path: Path) -> None:
        build_all(tmp_path)
        assert (tmp_path / "EBGaramond08-Regular.woff2").exists()
        assert (tmp_path / "EBGaramond12-Regular.woff2").exists()

    def test_missing_upstream_raises(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            build_fonts,
            "_UPSTREAM_DIR",
            tmp_path / "nonexistent",
        )
        with pytest.raises(FileNotFoundError):
            build_all(tmp_path)


class TestIdempotency:
    def test_bracket_harmonization_is_idempotent(
        self, upstream_08: TTFont
    ) -> None:
        _harmonize_brackets(upstream_08)
        coords_after_1 = {
            name: list(upstream_08["glyf"][name].coordinates)
            for name in _BRACE_GLYPHS + _SQUARE_BRACKET_GLYPHS
        }

        _harmonize_brackets(upstream_08)
        coords_after_2 = {
            name: list(upstream_08["glyf"][name].coordinates)
            for name in _BRACE_GLYPHS + _SQUARE_BRACKET_GLYPHS
        }

        assert coords_after_1 == coords_after_2

    @pytest.mark.parametrize(
        "font_fixture",
        ["upstream_08", "upstream_12"],
        ids=["08pt", "12pt"],
    )
    def test_existing_kern_has_zero_for_our_pairs(
        self,
        font_fixture: str,
        request: pytest.FixtureRequest,
    ) -> None:
        """Existing kern lookups must not have non-zero values for our glyph
        pairs, or the values would stack."""
        font: TTFont = request.getfixturevalue(font_fixture)
        gpos = font["GPOS"].table

        f_set = set(_get_f_glyphs(font))
        t_set = set(_TARGET_GLYPHS)

        for feat_rec in gpos.FeatureList.FeatureRecord:
            if feat_rec.FeatureTag != "kern":
                continue
            for li in feat_rec.Feature.LookupListIndex:
                lookup = gpos.LookupList.Lookup[li]
                for st in lookup.SubTable:
                    if not hasattr(st, "Coverage"):
                        continue
                    overlap = f_set & set(st.Coverage.glyphs)
                    if not overlap:
                        continue
                    _assert_no_nonzero_kern(st, overlap, t_set)


def _assert_no_nonzero_kern(
    subtable: Any,
    f_glyphs: set[str],
    targets: set[str],
) -> None:
    if subtable.Format == 1:
        for gi, glyph in enumerate(subtable.Coverage.glyphs):
            if glyph not in f_glyphs:
                continue
            for pvr in subtable.PairSet[gi].PairValueRecord:
                if pvr.SecondGlyph in targets:
                    xadv = pvr.Value1.XAdvance if pvr.Value1 else 0
                    assert xadv == 0, (
                        f"Existing kern {glyph}+{pvr.SecondGlyph} = {xadv}"
                    )
    elif subtable.Format == 2:
        cd1 = subtable.ClassDef1.classDefs
        cd2 = subtable.ClassDef2.classDefs
        for f_name in f_glyphs:
            f_class = cd1.get(f_name, 0)
            for t_name in targets:
                t_class = cd2.get(t_name, 0)
                rec = subtable.Class1Record[f_class].Class2Record[t_class]
                if rec.Value1:
                    xadv = rec.Value1.XAdvance
                    assert xadv == 0, (
                        f"Existing kern {f_name}+{t_name} = {xadv}"
                    )
