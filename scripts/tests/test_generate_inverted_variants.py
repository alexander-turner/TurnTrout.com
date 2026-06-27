"""Tests for ``scripts.generate_inverted_variants``."""

from __future__ import annotations

import json
import logging
from collections.abc import Iterator
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from .. import generate_inverted_variants as giv

# --------------- SVG color inversion tests ---------------


@pytest.mark.parametrize(
    ("token", "expected"),
    [
        ("white", "#000000"),
        ("#ffffff", "#000000"),
        ("#000000", "#ffffff"),
        ("#fff", "#000000"),
        ("#000", "#ffffff"),
        ("rgb(200, 100, 50)", "#cd6937"),
        ("green", "#7fff7f"),
        ("rgba(200, 100, 50, 0.5)", "#cd6937"),
        ("black", "#ffffff"),
    ],
)
def test_invert_color_token(token: str, expected: str) -> None:
    assert giv.invert_color_token(token) == expected


@pytest.mark.parametrize(
    "token",
    ["none", "currentColor", "transparent", "url(#grad)", "inherit", "garbage"],
)
def test_invert_color_token_returns_none_for_non_color(token: str) -> None:
    assert giv.invert_color_token(token) is None


def test_invert_css_colors() -> None:
    css = "fill: white; stroke: #000; opacity: 0.5"
    out = giv.invert_css_colors(css)
    assert "fill: #000000" in out
    assert "stroke: #ffffff" in out
    assert "opacity: 0.5" in out


def test_invert_css_colors_leaves_unparsable_values() -> None:
    assert giv.invert_css_colors("fill: none") == "fill: none"


def test_invert_svg_file(tmp_path: Path) -> None:
    src = tmp_path / "chart.svg"
    src.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg">'
        '<rect fill="white" stroke="#000"/>'
        '<path style="fill: green"/>'
        "</svg>"
    )
    dst = tmp_path / "chart-inverted.svg"
    giv.invert_svg_file(src, dst)
    content = dst.read_text()
    assert 'fill="#000000"' in content
    assert 'stroke="#ffffff"' in content
    assert "fill: #7fff7f" in content


def test_invert_svg_file_preserves_structure(tmp_path: Path) -> None:
    src = tmp_path / "chart.svg"
    src.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg">'
        "<style>circle { fill: white; }</style>"
        '<circle cx="10" cy="10" r="5"/>'
        "</svg>"
    )
    dst = tmp_path / "chart-inverted.svg"
    giv.invert_svg_file(src, dst)
    content = dst.read_text()
    assert "fill: #000000" in content
    assert "<circle" in content


_BASE_URL = "https://assets.turntrout.com"


def _write_solid_png(path: Path, rgba: tuple[int, int, int, int]) -> None:
    Image.new("RGBA", (4, 4), rgba).save(path)


@pytest.fixture()
def asset_dir(tmp_path: Path) -> Iterator[Path]:
    """Local-mirror layout: ``<asset_dir>/Attachments/sample.png``."""
    sub = tmp_path / "Attachments"
    sub.mkdir()
    yield tmp_path


@pytest.mark.parametrize(
    "src_name,expected_name",
    [
        ("foo.avif", "foo-inverted.avif"),
        ("nested/bar.PNG", "nested/bar-inverted.PNG"),
        ("dotted.name.webp", "dotted.name-inverted.webp"),
    ],
)
def test_inverted_path(src_name: str, expected_name: str) -> None:
    src = Path("/root") / src_name
    assert giv.inverted_path(src) == Path("/root") / expected_name


@pytest.mark.parametrize(
    "stem,expected",
    [
        ("foo", False),
        ("foo-inverted", True),
        ("inverted", False),
        # extension already stripped by .stem in caller
        ("foo-inverted.svg", False),
    ],
)
def test_is_inverted_path(stem: str, expected: bool) -> None:
    assert giv.is_inverted_path(Path(f"/x/{stem}.avif")) is expected


def test_invert_image_file_inverts_lightness_and_preserves_alpha(
    tmp_path: Path,
) -> None:
    src = tmp_path / "src.png"
    _write_solid_png(src, (200, 100, 50, 128))
    dst = tmp_path / "dst.png"
    giv.invert_image_file(src, dst)

    arr = np.array(Image.open(dst))
    # invertLightness(200, 100, 50): delta = 255 - 200 - 50 = 5 → (205,105,55)
    assert tuple(arr[0, 0]) == (205, 105, 55, 128)


def test_invert_image_file_double_invert_is_identity_for_lossless(
    tmp_path: Path,
) -> None:
    src = tmp_path / "src.png"
    Image.fromarray(
        np.random.default_rng(0).integers(0, 256, (8, 8, 4), dtype=np.uint8),
        "RGBA",
    ).save(src)
    mid = tmp_path / "mid.png"
    back = tmp_path / "back.png"
    giv.invert_image_file(src, mid)
    giv.invert_image_file(mid, back)
    assert np.array_equal(np.array(Image.open(src)), np.array(Image.open(back)))


def test_invert_image_file_grayscale_demotes_to_rgb(tmp_path: Path) -> None:
    src = tmp_path / "gray.png"
    Image.new("L", (2, 2), 100).save(src)
    dst = tmp_path / "gray-inv.png"
    giv.invert_image_file(src, dst)
    out = Image.open(dst)
    # L source is opaque, so output drops alpha to keep formats like
    # JPEG saveable. delta = 255 - 100 - 100 = 55 → (155, 155, 155).
    assert out.mode == "RGB"
    assert tuple(np.array(out)[0, 0]) == (155, 155, 155)


@pytest.mark.parametrize(
    "ext,source_mode,fill,expected_mode",
    [
        (".jpg", "RGB", (200, 100, 50), "RGB"),
        (".jpeg", "RGB", (200, 100, 50), "RGB"),
        (".png", "RGB", (200, 100, 50), "RGB"),
        (".png", "RGBA", (200, 100, 50, 128), "RGBA"),
        (".webp", "RGBA", (200, 100, 50, 128), "RGBA"),
        (".png", "P", 0, "RGB"),
        (".png", "1", 0, "RGB"),
    ],
)
def test_invert_image_file_preserves_alpha_only_when_source_had_it(
    tmp_path: Path,
    ext: str,
    source_mode: str,
    fill: object,
    expected_mode: str,
) -> None:
    src = tmp_path / f"src{ext}"
    Image.new(source_mode, (4, 4), fill).save(src)
    dst = tmp_path / f"dst{ext}"
    giv.invert_image_file(src, dst)
    assert Image.open(dst).mode == expected_mode


def test_url_to_local_path_decodes_percent_encoding(asset_dir: Path) -> None:
    url = f"{_BASE_URL}/Attachments/Pasted%20image.avif"
    assert giv._url_to_local_path(url, asset_dir, _BASE_URL) == (
        asset_dir / "Attachments" / "Pasted image.avif"
    )


def test_url_to_local_path_rejects_foreign_host(asset_dir: Path) -> None:
    assert (
        giv._url_to_local_path(
            "https://other.cdn/Attachments/x.avif", asset_dir, _BASE_URL
        )
        is None
    )


def test_iter_invert_targets_filters_correctly(asset_dir: Path) -> None:
    valid = asset_dir / "Attachments" / "good.avif"
    _write_solid_png(valid, (10, 20, 30, 255))
    valid.rename(valid)  # noop, exercises path

    valid_svg = asset_dir / "Attachments" / "chart.svg"
    valid_svg.write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')

    skipped_video = asset_dir / "Attachments" / "vid.mp4"
    skipped_video.write_bytes(b"")

    already_inverted = asset_dir / "Attachments" / "x-inverted.avif"
    _write_solid_png(already_inverted, (0, 0, 0, 255))

    labels: dict[str, dict[str, bool]] = {
        f"{_BASE_URL}/Attachments/good.avif": {
            "invert": True,
            "reviewed": True,
        },
        f"{_BASE_URL}/Attachments/chart.svg": {
            "invert": True,
            "reviewed": True,
        },
        f"{_BASE_URL}/Attachments/good.avif?dup": {
            "invert": False,
            "reviewed": True,
        },
        f"{_BASE_URL}/Attachments/missing.avif": {
            "invert": True,
            "reviewed": True,
        },
        f"{_BASE_URL}/Attachments/vid.mp4": {"invert": True, "reviewed": True},
        f"{_BASE_URL}/Attachments/x-inverted.avif": {
            "invert": True,
            "reviewed": True,
        },
        "https://other.cdn/y.png": {"invert": True, "reviewed": True},
    }
    targets = list(giv.iter_invert_targets(labels, asset_dir, _BASE_URL))
    assert set(targets) == {valid, valid_svg}


def test_generate_all_writes_inverted_and_is_idempotent(
    asset_dir: Path,
) -> None:
    src = asset_dir / "Attachments" / "a.png"
    _write_solid_png(src, (10, 20, 30, 255))
    labels = {
        f"{_BASE_URL}/Attachments/a.png": {"invert": True, "reviewed": True}
    }

    gen, skip = giv.generate_all(labels, asset_dir, _BASE_URL)
    assert (gen, skip) == (1, 0)
    assert giv.inverted_path(src).is_file()

    gen, skip = giv.generate_all(labels, asset_dir, _BASE_URL)
    assert (gen, skip) == (0, 1)


def test_generate_all_inverts_svg(asset_dir: Path) -> None:
    src = asset_dir / "Attachments" / "chart.svg"
    src.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="white"/></svg>'
    )
    labels = {
        f"{_BASE_URL}/Attachments/chart.svg": {
            "invert": True,
            "reviewed": True,
        }
    }
    gen, skip = giv.generate_all(labels, asset_dir, _BASE_URL)
    assert (gen, skip) == (1, 0)
    dst = giv.inverted_path(src)
    assert dst.is_file()
    assert 'fill="#000000"' in dst.read_text()


def test_generate_all_force_regenerates(asset_dir: Path) -> None:
    src = asset_dir / "Attachments" / "a.png"
    _write_solid_png(src, (10, 20, 30, 255))
    labels = {
        f"{_BASE_URL}/Attachments/a.png": {"invert": True, "reviewed": True}
    }
    giv.generate_all(labels, asset_dir, _BASE_URL)
    gen, skip = giv.generate_all(labels, asset_dir, _BASE_URL, force=True)
    assert (gen, skip) == (1, 0)


def test_generate_all_regenerates_when_source_newer(asset_dir: Path) -> None:
    src = asset_dir / "Attachments" / "a.png"
    _write_solid_png(src, (10, 20, 30, 255))
    labels = {
        f"{_BASE_URL}/Attachments/a.png": {"invert": True, "reviewed": True}
    }
    giv.generate_all(labels, asset_dir, _BASE_URL)
    dst = giv.inverted_path(src)
    # Make the dst look stale.
    older = dst.stat().st_mtime - 100
    import os

    os.utime(dst, (older, older))
    gen, skip = giv.generate_all(labels, asset_dir, _BASE_URL)
    assert (gen, skip) == (1, 0)


def test_generate_all_logs_and_skips_unreadable_source(
    asset_dir: Path, caplog: pytest.LogCaptureFixture
) -> None:
    bad = asset_dir / "Attachments" / "broken.png"
    bad.write_bytes(b"not a real png")
    labels = {
        f"{_BASE_URL}/Attachments/broken.png": {
            "invert": True,
            "reviewed": True,
        }
    }
    with caplog.at_level(logging.WARNING, logger=giv.logger.name):
        gen, skip = giv.generate_all(labels, asset_dir, _BASE_URL)
    assert (gen, skip) == (0, 1)
    assert "Failed to invert" in caplog.text


def test_main_happy_path(asset_dir: Path, tmp_path: Path) -> None:
    src = asset_dir / "Attachments" / "a.png"
    _write_solid_png(src, (10, 20, 30, 255))
    labels_file = tmp_path / "labels.json"
    labels_file.write_text(
        json.dumps(
            {
                f"{_BASE_URL}/Attachments/a.png": {
                    "invert": True,
                    "reviewed": True,
                }
            }
        )
    )
    giv.main(
        [
            "--labels-file",
            str(labels_file),
            "--asset-directory",
            str(asset_dir),
            "--base-url",
            _BASE_URL,
            "--force",
        ]
    )
    assert giv.inverted_path(src).is_file()


def test_main_missing_labels_file_raises(
    asset_dir: Path, tmp_path: Path
) -> None:
    with pytest.raises(FileNotFoundError):
        giv.main(
            [
                "--labels-file",
                str(tmp_path / "nope.json"),
                "--asset-directory",
                str(asset_dir),
            ]
        )


def test_main_missing_asset_directory_raises(tmp_path: Path) -> None:
    labels_file = tmp_path / "labels.json"
    labels_file.write_text("{}")
    with pytest.raises(NotADirectoryError):
        giv.main(
            [
                "--labels-file",
                str(labels_file),
                "--asset-directory",
                str(tmp_path / "nope"),
            ]
        )
