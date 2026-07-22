"""Tests for scripts/pin_screenshot_assets.py."""

from __future__ import annotations

from pathlib import Path

import pytest

from .. import pin_screenshot_assets as pin

CDN = "https://assets.turntrout.com"


def test_extract_pinned_urls_filters_to_images_and_dedupes() -> None:
    markdown = f"""
    ![img]({CDN}/static/images/a.avif)
    <img src="{CDN}/static/images/a.avif" />
    ![svg]({CDN}/twemoji/1f970.svg)
    <video src="{CDN}/clip.mp4"></video>
    [audio]({CDN}/static/audio/batman.mp3)
    <track src="{CDN}/static/debate.vtt" />
    ![spaced]({CDN}/Attachments/Pasted%20image.avif)
    """
    assert pin.extract_pinned_urls(markdown) == [
        f"{CDN}/Attachments/Pasted%20image.avif",
        f"{CDN}/static/images/a.avif",
        f"{CDN}/twemoji/1f970.svg",
    ]


def test_extract_pinned_urls_ignores_other_hosts() -> None:
    markdown = "![x](https://example.com/static/images/a.avif)"
    assert pin.extract_pinned_urls(markdown) == []


def test_cdn_url_to_local_path_decodes_and_mirrors_pathname(
    tmp_path: Path,
) -> None:
    url = f"{CDN}/Attachments/Pasted%20image.avif"
    assert (
        pin.cdn_url_to_local_path(url, tmp_path)
        == tmp_path / "Attachments/Pasted image.avif"
    )


def test_missing_pins_reports_only_absent_files(tmp_path: Path) -> None:
    present = f"{CDN}/static/images/present.avif"
    absent = f"{CDN}/static/images/absent.avif"
    dest = pin.cdn_url_to_local_path(present, tmp_path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(b"x")
    assert pin.missing_pins([present, absent], tmp_path) == [absent]


@pytest.fixture
def _patched(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Point the module at a temp page + pin dir referencing one image."""
    page = tmp_path / "test-page.md"
    page.write_text(f"![img]({CDN}/static/images/a.avif)", encoding="utf-8")
    monkeypatch.setattr(pin, "TEST_PAGE", page)
    monkeypatch.setattr(pin, "PIN_DIR", tmp_path / "cdn-assets")
    return tmp_path


def test_main_check_fails_when_a_pin_is_missing(
    _patched: Path, capsys: pytest.CaptureFixture
) -> None:
    assert pin.main(["--check"]) == 1
    assert "Missing pinned screenshot assets" in capsys.readouterr().err


def test_main_check_passes_when_all_pinned(
    _patched: Path, capsys: pytest.CaptureFixture
) -> None:
    dest = pin.cdn_url_to_local_path(f"{CDN}/static/images/a.avif", pin.PIN_DIR)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(b"x")
    assert pin.main(["--check"]) == 0
    assert "All 1 screenshot assets are pinned." in capsys.readouterr().out


def test_main_download_is_noop_when_all_pinned(
    _patched: Path, capsys: pytest.CaptureFixture
) -> None:
    dest = pin.cdn_url_to_local_path(f"{CDN}/static/images/a.avif", pin.PIN_DIR)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(b"x")
    assert pin.main([]) == 0
    assert (
        "Pinned 0 asset(s); 1 referenced in total." in capsys.readouterr().out
    )


def test_repo_pins_are_complete() -> None:
    """Every screenshot image referenced by the real test-page.md is
    committed."""
    urls = pin.extract_pinned_urls(pin.TEST_PAGE.read_text(encoding="utf-8"))
    assert urls, "expected test-page.md to reference pinnable CDN images"
    assert pin.missing_pins(urls, pin.PIN_DIR) == []
