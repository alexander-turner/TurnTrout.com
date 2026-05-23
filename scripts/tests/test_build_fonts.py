"""Tests for the EBGaramond font build pipeline."""

from pathlib import Path

import pytest
from fontTools.ttLib import TTFont  # type: ignore[import-untyped]

from .. import build_fonts
from ..build_fonts import (
    _BASE_KERN,
    _BRACE_GLYPHS,
    _F_GLYPHS_08,
    _F_GLYPHS_12,
    _FONT_DIR,
    _KERN_OFFSET,
    _SQUARE_BRACKET_GLYPHS,
    _TARGET_GLYPHS,
    _UPSTREAM_DIR,
    _add_f_kerning,
    _affine_map_glyph_y,
    _harmonize_brackets,
    _report_glyf_diffs,
    _verify_tables,
    build_all,
)


@pytest.fixture()
def upstream_08() -> TTFont:
    return TTFont(_UPSTREAM_DIR / "EBGaramond08-Regular.woff2")


@pytest.fixture()
def upstream_12() -> TTFont:
    return TTFont(_UPSTREAM_DIR / "EBGaramond12-Regular.woff2")


class TestAffineMapGlyphY:
    def test_maps_to_target_bounds(self, upstream_08: TTFont) -> None:
        _affine_map_glyph_y(upstream_08, "bracketleft", -500, 1500)
        glyph = upstream_08["glyf"]["bracketleft"]
        assert glyph.yMin == -500
        assert glyph.yMax == 1500

    def test_preserves_x_coordinates(self, upstream_08: TTFont) -> None:
        original_xs = [
            c[0] for c in upstream_08["glyf"]["bracketleft"].coordinates
        ]
        _affine_map_glyph_y(upstream_08, "bracketleft", -510, 1481)
        new_xs = [c[0] for c in upstream_08["glyf"]["bracketleft"].coordinates]
        assert original_xs == new_xs

    def test_identity_when_bounds_match(self, upstream_08: TTFont) -> None:
        glyph = upstream_08["glyf"]["bracketleft"]
        original_coords = list(glyph.coordinates)
        _affine_map_glyph_y(upstream_08, "bracketleft", glyph.yMin, glyph.yMax)
        assert list(glyph.coordinates) == original_coords

    def test_no_contour_glyph_is_noop(self, upstream_08: TTFont) -> None:
        glyph = upstream_08["glyf"]["space"]
        assert glyph.numberOfContours == 0
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
            assert (
                glyph.yMin == original_y_mins[name]
            ), f"{name} yMin should stay at original"

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


class TestAddFKerning:
    def test_creates_kern_feature_when_missing(
        self, upstream_08: TTFont
    ) -> None:
        gpos = upstream_08["GPOS"].table
        kern_tags = [f.FeatureTag for f in gpos.FeatureList.FeatureRecord]
        assert "kern" not in kern_tags

        _add_f_kerning(upstream_08, _F_GLYPHS_08)

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

        _add_f_kerning(upstream_12, _F_GLYPHS_12)
        assert len(original_kern.Feature.LookupListIndex) == original_count + 1

    def test_pair_value_records_sorted_by_glyph_id(
        self, upstream_08: TTFont
    ) -> None:
        _add_f_kerning(upstream_08, _F_GLYPHS_08)

        gpos = upstream_08["GPOS"].table
        lookup = gpos.LookupList.Lookup[-1]
        subtable = lookup.SubTable[0]
        glyph_order = upstream_08.getGlyphOrder()

        for ps in subtable.PairSet:
            gids = [
                glyph_order.index(pvr.SecondGlyph) for pvr in ps.PairValueRecord
            ]
            assert gids == sorted(gids)

    def test_coverage_glyphs_sorted_by_glyph_id(
        self, upstream_08: TTFont
    ) -> None:
        _add_f_kerning(upstream_08, _F_GLYPHS_08)

        gpos = upstream_08["GPOS"].table
        lookup = gpos.LookupList.Lookup[-1]
        subtable = lookup.SubTable[0]
        glyph_order = upstream_08.getGlyphOrder()

        gids = [glyph_order.index(g) for g in subtable.Coverage.glyphs]
        assert gids == sorted(gids)

    @pytest.mark.parametrize(
        "font_fixture,f_glyphs",
        [
            ("upstream_08", _F_GLYPHS_08),
            ("upstream_12", _F_GLYPHS_12),
        ],
        ids=["08pt", "12pt"],
    )
    def test_all_f_glyphs_in_coverage(
        self,
        font_fixture: str,
        f_glyphs: tuple[str, ...],
        request: pytest.FixtureRequest,
    ) -> None:
        font: TTFont = request.getfixturevalue(font_fixture)
        _add_f_kerning(font, f_glyphs)
        gpos = font["GPOS"].table
        lookup = gpos.LookupList.Lookup[-1]
        subtable = lookup.SubTable[0]
        assert set(subtable.Coverage.glyphs) == set(f_glyphs)

    def test_kern_values_match_formula(self, upstream_08: TTFont) -> None:
        glyf = upstream_08["glyf"]
        hmtx = upstream_08["hmtx"]

        _add_f_kerning(upstream_08, _F_GLYPHS_08)

        gpos = upstream_08["GPOS"].table
        lookup = gpos.LookupList.Lookup[-1]
        subtable = lookup.SubTable[0]

        for i, f_name in enumerate(subtable.Coverage.glyphs):
            overhang = glyf[f_name].xMax - hmtx[f_name][0]
            for pvr in subtable.PairSet[i].PairValueRecord:
                t_name = pvr.SecondGlyph
                expected = max(
                    overhang - glyf[t_name].xMin + _KERN_OFFSET,
                    _BASE_KERN[t_name],
                )
                assert pvr.Value1.XAdvance == expected, f"{f_name}->{t_name}"

    def test_kern_feature_in_all_scripts(self, upstream_08: TTFont) -> None:
        _add_f_kerning(upstream_08, _F_GLYPHS_08)
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


class TestTableEquivalence:
    """Verify built fonts are table-equivalent to committed fonts."""

    _SKIP_TABLES = frozenset({"head", "GlyphOrder"})

    def _table_tags(self, font: TTFont) -> frozenset[str]:
        return frozenset(font.keys()) - self._SKIP_TABLES

    @pytest.mark.parametrize(
        "filename,f_glyphs",
        [
            ("EBGaramond08-Regular.woff2", _F_GLYPHS_08),
            ("EBGaramond12-Regular.woff2", _F_GLYPHS_12),
        ],
        ids=["08pt", "12pt"],
    )
    def test_all_tables_match(
        self,
        tmp_path: Path,
        filename: str,
        f_glyphs: tuple[str, ...],
    ) -> None:
        output = tmp_path / filename
        build_fonts._build_font(_UPSTREAM_DIR / filename, output, f_glyphs)

        built = TTFont(output)
        committed = TTFont(_FONT_DIR / filename)

        for tag in self._table_tags(built) | self._table_tags(committed):
            assert built.getTableData(tag) == committed.getTableData(
                tag
            ), f"Table {tag} differs"


class TestVerifyTables:
    @pytest.mark.parametrize(
        "filename,f_glyphs",
        [
            ("EBGaramond08-Regular.woff2", _F_GLYPHS_08),
            ("EBGaramond12-Regular.woff2", _F_GLYPHS_12),
        ],
        ids=["08pt", "12pt"],
    )
    def test_returns_true_for_matching_fonts(
        self, tmp_path: Path, filename: str, f_glyphs: tuple[str, ...]
    ) -> None:
        output = tmp_path / filename
        build_fonts._build_font(_UPSTREAM_DIR / filename, output, f_glyphs)
        assert _verify_tables(output, _FONT_DIR / filename, filename)

    def test_returns_false_for_different_fonts(self, tmp_path: Path) -> None:
        assert not _verify_tables(
            _UPSTREAM_DIR / "EBGaramond08-Regular.woff2",
            _FONT_DIR / "EBGaramond08-Regular.woff2",
            "08pt",
        )


class TestReportGlyfDiffs:
    def test_reports_differing_glyphs(
        self,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        upstream = TTFont(_UPSTREAM_DIR / "EBGaramond08-Regular.woff2")
        committed = TTFont(_FONT_DIR / "EBGaramond08-Regular.woff2")
        _report_glyf_diffs(upstream, committed, "08pt")
        captured = capsys.readouterr()
        assert "bracketleft" in captured.out
        assert "braceleft" in captured.out


class TestBuildAll:
    def test_builds_both_fonts(self, tmp_path: Path) -> None:
        build_all(tmp_path)
        assert (tmp_path / "EBGaramond08-Regular.woff2").exists()
        assert (tmp_path / "EBGaramond12-Regular.woff2").exists()

    def test_missing_upstream_raises(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            build_fonts, "_UPSTREAM_DIR", tmp_path / "nonexistent"
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
        "font_fixture,f_glyphs",
        [
            ("upstream_08", _F_GLYPHS_08),
            ("upstream_12", _F_GLYPHS_12),
        ],
        ids=["08pt", "12pt"],
    )
    def test_existing_kern_has_zero_for_our_pairs(
        self,
        font_fixture: str,
        f_glyphs: tuple[str, ...],
        request: pytest.FixtureRequest,
    ) -> None:
        """
        Our kern lookup appends to the kern feature.

        Existing kern lookups must not have non-zero values for our glyph pairs,
        or the values would stack.
        """
        font: TTFont = request.getfixturevalue(font_fixture)
        gpos = font["GPOS"].table

        f_set = set(f_glyphs)
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
    subtable: object,
    f_glyphs: set[str],
    targets: set[str],
) -> None:
    if subtable.Format == 1:  # type: ignore[union-attr]
        for gi, glyph in enumerate(
            subtable.Coverage.glyphs  # type: ignore[union-attr]
        ):
            if glyph not in f_glyphs:
                continue
            # type: ignore[union-attr]
            for pvr in subtable.PairSet[gi].PairValueRecord:
                if pvr.SecondGlyph in targets:
                    xadv = pvr.Value1.XAdvance if pvr.Value1 else 0
                    assert xadv == 0, (
                        f"Existing kern {glyph}+{pvr.SecondGlyph}" f" = {xadv}"
                    )
    elif subtable.Format == 2:  # type: ignore[union-attr]
        cd1 = subtable.ClassDef1.classDefs  # type: ignore[union-attr]
        cd2 = subtable.ClassDef2.classDefs  # type: ignore[union-attr]
        for f_name in f_glyphs:
            f_class = cd1.get(f_name, 0)
            for t_name in targets:
                t_class = cd2.get(t_name, 0)
                # type: ignore[union-attr]
                rec = subtable.Class1Record[f_class].Class2Record[t_class]
                if rec.Value1:
                    xadv = rec.Value1.XAdvance
                    assert xadv == 0, (
                        f"Existing kern {f_name}+{t_name}" f" = {xadv}"
                    )
