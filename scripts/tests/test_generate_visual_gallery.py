"""Tests for scripts/generate_visual_gallery.py."""

from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

from scripts import generate_visual_gallery as gvg


def _png(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (4, 4), "red").save(path)


def test_collect_tiles_pairs_expected_actual_diff(tmp_path: Path) -> None:
    test_dir = tmp_path / "traces" / "spec-foo-Desktop-Chrome"
    _png(test_dir / "shot-actual.png")
    _png(test_dir / "shot-expected.png")
    _png(test_dir / "shot-diff.png")

    images = tmp_path / "out" / "gallery-images"
    tiles = gvg.collect_tiles(tmp_path / "traces", images)

    assert len(tiles) == 1
    tile = tiles[0]
    assert tile.label == "shot"
    assert tile.expected and (images / tile.expected).exists()
    assert tile.actual and (images / tile.actual).exists()
    assert tile.diff and (images / tile.diff).exists()


def test_collect_tiles_handles_missing_siblings(tmp_path: Path) -> None:
    test_dir = tmp_path / "traces" / "spec"
    _png(test_dir / "shot-actual.png")
    # No -expected.png, no -diff.png
    tiles = gvg.collect_tiles(tmp_path / "traces", tmp_path / "out")

    assert len(tiles) == 1
    assert tiles[0].expected is None
    assert tiles[0].diff is None
    assert tiles[0].actual is not None


def test_collect_tiles_skips_retry_dirs(tmp_path: Path) -> None:
    _png(tmp_path / "traces" / "spec" / "shot-actual.png")
    _png(tmp_path / "traces" / "spec-retry1" / "shot-actual.png")
    tiles = gvg.collect_tiles(tmp_path / "traces", tmp_path / "out")

    assert len(tiles) == 1
    # Retry duplicate of the same parent name still gets deduped via `seen`.
    assert "retry" not in tiles[0].label


def test_collect_tiles_dedupes_same_parent_and_stem(tmp_path: Path) -> None:
    """Two artifact dirs with the same trailing test dir collapse to one
    tile."""
    a = tmp_path / "traces" / "shard1" / "spec"
    b = tmp_path / "traces" / "shard2" / "spec"
    _png(a / "shot-actual.png")
    _png(b / "shot-actual.png")

    tiles = gvg.collect_tiles(tmp_path / "traces", tmp_path / "out")

    # Same parent name ('spec') + same stem ('shot') → one tile.
    assert len(tiles) == 1


def test_collect_tiles_keeps_distinct_parents(tmp_path: Path) -> None:
    """Different test dirs produce distinct tiles even with the same stem."""
    _png(tmp_path / "traces" / "spec-Chrome" / "shot-actual.png")
    _png(tmp_path / "traces" / "spec-Firefox" / "shot-actual.png")

    tiles = gvg.collect_tiles(tmp_path / "traces", tmp_path / "out")
    assert len(tiles) == 2


def test_render_html_includes_all_tiles(tmp_path: Path) -> None:
    tiles = [
        gvg.Tile(
            label="alpha",
            expected="a-e.avif",
            actual="a-a.avif",
            diff="a-d.avif",
        ),
        gvg.Tile(label="beta", expected=None, actual="b-a.avif", diff=None),
    ]
    page = gvg.render_html(tiles)

    assert "2 failing screenshots" in page
    assert "alpha" in page and "beta" in page
    assert "gallery-images/a-e.avif" in page
    assert "not captured" in page  # placeholder for missing files
    assert 'href="report.html"' in page  # link to Playwright report


def test_render_html_singular_count() -> None:
    page = gvg.render_html([gvg.Tile("only", None, "x.avif", None)])
    assert "1 failing screenshot " in page  # no plural "s"


def test_render_html_empty() -> None:
    page = gvg.render_html([])
    assert "No failing screenshots found" in page
    assert "0 failing screenshots" in page


def test_render_html_omits_report_link_when_absent() -> None:
    page = gvg.render_html([], has_playwright_report=False)
    assert 'href="report.html"' not in page


def test_render_html_uses_full_height_cells() -> None:
    """Cells render images at natural height — no per-cell scroll cap."""
    page = gvg.render_html([])
    # Per-cell scroll cap (would clip tall screenshots) must not appear.
    assert "max-height: 600px" not in page
    # Cells let images flow at natural height.
    assert "height: auto" in page


def test_render_html_escapes_label() -> None:
    tiles = [gvg.Tile(label="<script>x", expected=None, actual=None, diff=None)]
    page = gvg.render_html(tiles)
    # The label is escaped wherever rendered.
    assert "&lt;script&gt;x" in page
    # The raw tag does not leak into the page (the inline script block uses
    # a literal <script>, so check for our payload-marker form).
    assert "<script>x" not in page


@pytest.mark.parametrize(
    "environment, expected_fragment, expected_sub_count",
    [
        (
            "trigger: schedule on main · linux: pinned <container>",
            "trigger: schedule on main · linux: pinned &lt;container&gt;",
            2,
        ),
        (None, None, 1),
        ("", None, 1),
    ],
)
def test_render_html_environment_note(
    environment: str | None,
    expected_fragment: str | None,
    expected_sub_count: int,
) -> None:
    # The gallery's summary line ("N failing screenshots · ...") always renders
    # as `<p class="sub">`, the same class the environment note uses — so
    # presence/absence of the note can't be checked via a raw substring match
    # against that class. Counting occurrences distinguishes "no note" (1,
    # just the summary) from "note present" (2).
    page = gvg.render_html([], environment=environment)
    if expected_fragment is not None:
        assert expected_fragment in page
    assert page.count('<p class="sub">') == expected_sub_count


def test_install_as_index_preserves_playwright(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("PLAYWRIGHT_HTML", encoding="utf-8")
    gvg.install_as_index(tmp_path, "GALLERY_HTML")

    assert (tmp_path / "report.html").read_text(
        encoding="utf-8"
    ) == "PLAYWRIGHT_HTML"
    assert (tmp_path / "index.html").read_text(
        encoding="utf-8"
    ) == "GALLERY_HTML"


def test_install_as_index_when_no_playwright(tmp_path: Path) -> None:
    gvg.install_as_index(tmp_path, "GALLERY_HTML")
    assert (tmp_path / "index.html").read_text(
        encoding="utf-8"
    ) == "GALLERY_HTML"
    assert not (tmp_path / "report.html").exists()


def test_main_writes_index_and_gallery(tmp_path: Path) -> None:
    traces = tmp_path / "traces"
    report = tmp_path / "report"
    report.mkdir()
    (report / "index.html").write_text("ORIGINAL", encoding="utf-8")
    _png(traces / "spec" / "shot-actual.png")
    _png(traces / "spec" / "shot-diff.png")

    gvg.main(traces, report)

    assert (report / "index.html").exists()
    assert (report / "gallery.html").exists()
    assert (report / "report.html").read_text(encoding="utf-8") == "ORIGINAL"
    assert (report / "gallery-images" / "spec__shot-actual.avif").exists()
    # Playwright report existed → header link to it is rendered.
    assert 'href="report.html"' in (report / "index.html").read_text(
        encoding="utf-8"
    )


def test_main_omits_report_link_when_no_playwright_index(
    tmp_path: Path,
) -> None:
    traces = tmp_path / "traces"
    report = tmp_path / "report"
    report.mkdir()  # no index.html
    _png(traces / "spec" / "shot-actual.png")

    gvg.main(traces, report)

    page = (report / "index.html").read_text(encoding="utf-8")
    assert 'href="report.html"' not in page


def test_cli_argument_parsing(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Run the script via runpy so the __main__ branch is covered."""
    import runpy
    import sys

    traces = tmp_path / "traces"
    report = tmp_path / "report"
    report.mkdir()
    traces.mkdir()

    monkeypatch.setattr(
        sys, "argv", ["generate_visual_gallery.py", str(traces), str(report)]
    )
    runpy.run_module("scripts.generate_visual_gallery", run_name="__main__")

    assert (report / "index.html").exists()


def test_cli_with_approve_flags(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """--run-id (+ optional --pr-number) get injected into the HTML."""
    import runpy
    import sys

    traces = tmp_path / "traces"
    report = tmp_path / "report"
    report.mkdir()
    # Approve button only renders when there's at least one failing tile, so
    # plant a minimal *-actual.png the gallery generator can pick up.
    _png(traces / "shard" / "img-actual.png")

    monkeypatch.setattr(
        sys,
        "argv",
        [
            "generate_visual_gallery.py",
            str(traces),
            str(report),
            "--run-id",
            "987654",
            "--pr-number",
            "42",
            "--environment",
            "nightly drift sentinel · linux: pinned container",
        ],
    )
    runpy.run_module("scripts.generate_visual_gallery", run_name="__main__")

    page = (report / "index.html").read_text(encoding="utf-8")
    assert "approve-btn" in page
    assert '"runId": "987654"' in page
    assert '"prNumber": "42"' in page
    assert "nightly drift sentinel" in page
    # POSTs to the same-origin proxy, not GitHub directly.
    assert "/api/approve-baselines" in page
    assert "api.github.com" not in page
    # No PAT prompt / localStorage handling in the new JS.
    assert "localStorage" not in page
    assert "prompt(" not in page


def test_cli_wrong_arg_count(monkeypatch: pytest.MonkeyPatch) -> None:
    import runpy
    import sys

    monkeypatch.setattr(sys, "argv", ["generate_visual_gallery.py"])
    with pytest.raises(SystemExit) as exc:
        runpy.run_module("scripts.generate_visual_gallery", run_name="__main__")
    assert exc.value.code == 2


def test_render_html_omits_approve_without_config() -> None:
    """No ApproveConfig → no approve UI rendered."""
    page = gvg.render_html([gvg.Tile("t", None, "a.avif", None)])
    assert "approve-btn" not in page
    assert "__APPROVE_CFG__" not in page


def test_render_html_includes_approve_with_config() -> None:
    """ApproveConfig + at least one tile → approve button + config script."""
    page = gvg.render_html(
        [gvg.Tile("t", None, "a.avif", None)],
        approve=gvg.ApproveConfig(run_id="123"),
    )
    assert 'id="approve-btn"' in page
    assert '"runId": "123"' in page
    assert '"prNumber": null' in page
    # The old PAT-in-localStorage flow is gone from the rendered JS.
    assert "localStorage" not in page
    assert "prompt(" not in page
    assert "api.github.com" not in page
    assert "/api/approve-baselines" in page


def test_render_html_omits_approve_on_clean_gallery() -> None:
    """Even with an ApproveConfig, an empty tile list (passing run) hides the
    button — nothing to adopt as a baseline."""
    page = gvg.render_html([], approve=gvg.ApproveConfig(run_id="123"))
    assert "approve-btn" not in page
