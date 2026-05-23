"""Tests for the EBGaramond font build pipeline."""

from pathlib import Path

import pytest
from fontTools.ttLib import TTFont  # type: ignore[import-untyped]

from .. import build_fonts
from ..build_fonts import (
    _BASE_KERN,
    _BRACKET_GLYPHS,
    _F_GLYPHS_08,
    _F_GLYPHS_12,
    _FONT_DIR,
    _KERN_OFFSET,
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


@pytest.fixture()
def committed_08() -> TTFont:
    return TTFont(_FONT_DIR / "EBGaramond08-Regular.woff2")


@pytest.fixture()
def committed_12() -> TTFont:
    return TTFont(_FONT_DIR / "EBGaramond12-Regular.woff2")


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


class TestHarmonizeBrackets:
    def test_all_brackets_match_paren_bounds(self, upstream_08: TTFont) -> None:
        paren = upstream_08["glyf"]["parenleft"]
        target_y_min, target_y_max = paren.yMin, paren.yMax

        _harmonize_brackets(upstream_08)

        for name in _BRACKET_GLYPHS:
            glyph = upstream_08["glyf"][name]
            assert glyph.yMin == target_y_min, f"{name} yMin mismatch"
            assert glyph.yMax == target_y_max, f"{name} yMax mismatch"

    @pytest.mark.parametrize(
        "font_fixture,expected_y_min,expected_y_max",
        [
            ("upstream_08", -510, 1481),
            ("upstream_12", -438, 1444),
        ],
    )
    def test_target_bounds_per_font(
        self,
        font_fixture: str,
        expected_y_min: int,
        expected_y_max: int,
        request: pytest.FixtureRequest,
    ) -> None:
        font: TTFont = request.getfixturevalue(font_fixture)
        _harmonize_brackets(font)
        for name in _BRACKET_GLYPHS:
            glyph = font["glyf"][name]
            assert glyph.yMin == expected_y_min
            assert glyph.yMax == expected_y_max


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
        original_lookup_count = original_kern.Feature.LookupCount

        _add_f_kerning(upstream_12, _F_GLYPHS_12)
        assert original_kern.Feature.LookupCount == original_lookup_count + 1

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

    def test_12pt_all_tables_match(self, tmp_path: Path) -> None:
        output = tmp_path / "EBGaramond12-Regular.woff2"
        build_fonts._build_font(
            _UPSTREAM_DIR / "EBGaramond12-Regular.woff2",
            output,
            _F_GLYPHS_12,
        )

        built = TTFont(output)
        committed = TTFont(_FONT_DIR / "EBGaramond12-Regular.woff2")

        for tag in self._table_tags(built) | self._table_tags(committed):
            assert built.getTableData(tag) == committed.getTableData(
                tag
            ), f"Table {tag} differs"

    def test_08pt_non_glyf_tables_match(self, tmp_path: Path) -> None:
        output = tmp_path / "EBGaramond08-Regular.woff2"
        build_fonts._build_font(
            _UPSTREAM_DIR / "EBGaramond08-Regular.woff2",
            output,
            _F_GLYPHS_08,
        )

        built = TTFont(output)
        committed = TTFont(_FONT_DIR / "EBGaramond08-Regular.woff2")

        for tag in self._table_tags(built) | self._table_tags(committed):
            if tag == "glyf":
                continue
            assert built.getTableData(tag) == committed.getTableData(
                tag
            ), f"Table {tag} differs"

    def test_08pt_glyf_diffs_are_bracket_rounding_only(
        self, tmp_path: Path
    ) -> None:
        output = tmp_path / "EBGaramond08-Regular.woff2"
        build_fonts._build_font(
            _UPSTREAM_DIR / "EBGaramond08-Regular.woff2",
            output,
            _F_GLYPHS_08,
        )

        built = TTFont(output)
        committed = TTFont(_FONT_DIR / "EBGaramond08-Regular.woff2")

        glyf_b = built["glyf"]
        glyf_c = committed["glyf"]

        differing_glyphs = set()
        for name in glyf_b.keys():
            gb = glyf_b[name]
            gc = glyf_c[name]
            if not hasattr(gb, "coordinates"):
                continue
            if gb.coordinates != gc.coordinates:
                differing_glyphs.add(name)
                for (xb, yb), (xc, yc) in zip(gb.coordinates, gc.coordinates):
                    assert xb == xc, f"{name}: X coordinate changed"
                    assert abs(yb - yc) <= 1, f"{name}: Y delta > 1 unit"

        assert differing_glyphs <= {"bracketleft", "bracketright"}


class TestVerifyTables:
    def test_returns_true_for_identical_fonts(self, tmp_path: Path) -> None:
        output = tmp_path / "EBGaramond12-Regular.woff2"
        build_fonts._build_font(
            _UPSTREAM_DIR / "EBGaramond12-Regular.woff2",
            output,
            _F_GLYPHS_12,
        )
        assert _verify_tables(
            output, _FONT_DIR / "EBGaramond12-Regular.woff2", "12pt"
        )

    def test_returns_false_for_glyf_diff(self, tmp_path: Path) -> None:
        output = tmp_path / "EBGaramond08-Regular.woff2"
        build_fonts._build_font(
            _UPSTREAM_DIR / "EBGaramond08-Regular.woff2",
            output,
            _F_GLYPHS_08,
        )
        assert not _verify_tables(
            output, _FONT_DIR / "EBGaramond08-Regular.woff2", "08pt"
        )


class TestReportGlyfDiffs:
    def test_reports_differing_glyphs(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        output = tmp_path / "EBGaramond08-Regular.woff2"
        build_fonts._build_font(
            _UPSTREAM_DIR / "EBGaramond08-Regular.woff2",
            output,
            _F_GLYPHS_08,
        )
        built = TTFont(output)
        committed = TTFont(_FONT_DIR / "EBGaramond08-Regular.woff2")
        _report_glyf_diffs(built, committed, "08pt")
        captured = capsys.readouterr()
        assert "bracketleft" in captured.out
        assert "bracketright" in captured.out


class TestBuildAll:
    def test_builds_both_fonts(self, tmp_path: Path) -> None:
        build_all(tmp_path)
        assert (tmp_path / "EBGaramond08-Regular.woff2").exists()
        assert (tmp_path / "EBGaramond12-Regular.woff2").exists()

    def test_missing_upstream_raises(self, tmp_path: Path) -> None:
        import scripts.build_fonts as bf

        original_dir = bf._UPSTREAM_DIR
        try:
            bf._UPSTREAM_DIR = tmp_path / "nonexistent"  # type: ignore[misc]
            with pytest.raises(FileNotFoundError):
                build_all(tmp_path)
        finally:
            bf._UPSTREAM_DIR = original_dir  # type: ignore[misc]


class TestAffineMapEdgeCases:
    def test_no_contour_glyph_is_noop(self, upstream_08: TTFont) -> None:
        glyph = upstream_08["glyf"]["space"]
        assert glyph.numberOfContours == 0
        _affine_map_glyph_y(upstream_08, "space", -100, 100)
