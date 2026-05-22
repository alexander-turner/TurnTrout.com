"""Tests for ``scripts.generate_inverted_variants``."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Iterator

import numpy as np
import pytest
from PIL import Image

from .. import generate_inverted_variants as giv

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


def test_invert_image_file_promotes_grayscale_to_rgba(tmp_path: Path) -> None:
    src = tmp_path / "gray.png"
    Image.new("L", (2, 2), 100).save(src)
    dst = tmp_path / "gray-inv.png"
    giv.invert_image_file(src, dst)
    arr = np.array(Image.open(dst))
    # L=100 → RGB(100,100,100), delta = 255 - 100 - 100 = 55 → (155,155,155,255)
    assert tuple(arr[0, 0]) == (155, 155, 155, 255)


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

    skipped_video = asset_dir / "Attachments" / "vid.mp4"
    skipped_video.write_bytes(b"")

    already_inverted = asset_dir / "Attachments" / "x-inverted.avif"
    _write_solid_png(already_inverted, (0, 0, 0, 255))

    labels: dict[str, dict[str, bool]] = {
        f"{_BASE_URL}/Attachments/good.avif": {
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
    assert targets == [valid]


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
    rc = giv.main(
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
    assert rc == 0
    assert giv.inverted_path(src).is_file()


def test_main_missing_labels_file(asset_dir: Path, tmp_path: Path) -> None:
    rc = giv.main(
        [
            "--labels-file",
            str(tmp_path / "nope.json"),
            "--asset-directory",
            str(asset_dir),
        ]
    )
    assert rc == 1


def test_main_missing_asset_directory(tmp_path: Path) -> None:
    labels_file = tmp_path / "labels.json"
    labels_file.write_text("{}")
    rc = giv.main(
        [
            "--labels-file",
            str(labels_file),
            "--asset-directory",
            str(tmp_path / "nope"),
        ]
    )
    assert rc == 1
