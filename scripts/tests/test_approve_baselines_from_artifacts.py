"""Tests for :mod:`scripts.approve_baselines_from_artifacts`."""

from __future__ import annotations

import json
import zipfile
from pathlib import Path
from unittest.mock import patch

import pytest

from scripts import approve_baselines_from_artifacts as approve

_PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000d49444154789c63000100000005000100000a2db40000000049454e"
    "44ae426082"
)


def _make_blob_zip(
    path: Path,
    attachments: list[tuple[str, str, bytes | None]],
) -> None:
    events = []
    with zipfile.ZipFile(path, "w") as zf:
        for idx, (name, content_type, body) in enumerate(attachments):
            attachment: dict[str, object] = {
                "name": name,
                "contentType": content_type,
            }
            if body is not None:
                entry_path = f"resources/sha{idx}.png"
                attachment["path"] = entry_path
                zf.writestr(entry_path, body)
            events.append(
                {
                    "method": "onAttach",
                    "params": {
                        "testId": f"t{idx}",
                        "resultId": f"r{idx}",
                        "attachments": [attachment],
                    },
                }
            )
        zf.writestr(
            "report.jsonl",
            "\n".join(json.dumps(e) for e in events) + "\n",
        )


@pytest.mark.parametrize(
    "attachment_name, expected",
    [
        ("toc-Desktop-Safari-actual", "toc-Desktop-Safari.png"),
        (
            "spoiler-after-revealing-light.png-actual",
            "spoiler-after-revealing-light.png",
        ),
        (
            "-can-trigger-popover-links-show-popover-on-hover-"
            "-screenshot--first-visible-popover-Desktop-Safari-actual",
            "-can-trigger-popover-links-show-popover-on-hover-"
            "-screenshot--first-visible-popover-Desktop-Safari.png",
        ),
        ("toc-Desktop-Safari-expected", None),
        ("toc-Desktop-Safari-diff", None),
        ("trace", None),
    ],
)
def test_canonical_baseline_name(
    attachment_name: str, expected: str | None
) -> None:
    assert approve._canonical_baseline_name(attachment_name) == expected


def test_collect_extracts_actual_png_attachments(tmp_path: Path) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    _make_blob_zip(
        blob_dir / "linux-report-1.zip",
        [
            ("toc-Desktop-Safari-actual", "image/png", _PNG_BYTES),
            ("toc-Desktop-Safari-expected", "image/png", _PNG_BYTES),
            ("toc-Desktop-Safari-diff", "image/png", _PNG_BYTES),
            (
                "-can-trigger-popover-links-show-popover-on-hover-"
                "-screenshot--first-visible-popover-Desktop-Safari-actual",
                "image/png",
                _PNG_BYTES,
            ),
            ("trace-actual", "application/zip", b"zip-bytes"),
        ],
    )

    staging = tmp_path / "stage"
    count = approve.collect_from_blob_reports(blob_dir, staging)

    assert count == 2
    expected_files = {
        "toc-Desktop-Safari.png",
        "-can-trigger-popover-links-show-popover-on-hover-"
        "-screenshot--first-visible-popover-Desktop-Safari.png",
    }
    assert {p.name for p in staging.iterdir()} == expected_files
    for staged in staging.iterdir():
        assert staged.read_bytes() == _PNG_BYTES


def test_collect_deduplicates_across_shards(tmp_path: Path) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    for shard in (1, 2):
        _make_blob_zip(
            blob_dir / f"linux-report-{shard}.zip",
            [("toc-Desktop-Safari-actual", "image/png", _PNG_BYTES)],
        )

    staging = tmp_path / "stage"
    count = approve.collect_from_blob_reports(blob_dir, staging)
    assert count == 1


def test_collect_skips_missing_zip_entry(tmp_path: Path) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    zip_path = blob_dir / "report.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr(
            "report.jsonl",
            json.dumps(
                {
                    "method": "onAttach",
                    "params": {
                        "attachments": [
                            {
                                "name": "toc-actual",
                                "contentType": "image/png",
                                "path": "resources/missing.png",
                            }
                        ],
                    },
                }
            )
            + "\n",
        )

    staging = tmp_path / "stage"
    assert approve.collect_from_blob_reports(blob_dir, staging) == 0


def test_collect_handles_blob_zip_without_report_jsonl(tmp_path: Path) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    with zipfile.ZipFile(blob_dir / "empty.zip", "w") as zf:
        zf.writestr("unrelated.txt", "no jsonl here")

    assert approve.collect_from_blob_reports(blob_dir, tmp_path / "stage") == 0


def test_collect_skips_attachments_without_path(tmp_path: Path) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    zip_path = blob_dir / "report.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr(
            "report.jsonl",
            json.dumps(
                {
                    "method": "onAttach",
                    "params": {
                        "attachments": [
                            {
                                "name": "toc-actual",
                                "contentType": "image/png",
                                "body": "base64data",
                            }
                        ],
                    },
                }
            )
            + "\n",
        )

    assert approve.collect_from_blob_reports(blob_dir, tmp_path / "stage") == 0


def test_collect_skips_blank_and_non_attach_lines(tmp_path: Path) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    zip_path = blob_dir / "report.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("resources/sha0.png", _PNG_BYTES)
        zf.writestr(
            "report.jsonl",
            "\n".join(
                [
                    "",
                    json.dumps({"method": "onTestEnd", "params": {}}),
                    json.dumps(
                        {
                            "method": "onAttach",
                            "params": {
                                "attachments": [
                                    {
                                        "name": "toc-actual",
                                        "contentType": "image/png",
                                        "path": "resources/sha0.png",
                                    }
                                ],
                            },
                        }
                    ),
                ]
            )
            + "\n",
        )

    assert approve.collect_from_blob_reports(blob_dir, tmp_path / "stage") == 1


def test_main_uploads_when_attachments_found(tmp_path: Path) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    _make_blob_zip(
        blob_dir / "report.zip",
        [("toc-actual", "image/png", _PNG_BYTES)],
    )
    staging = tmp_path / "stage"

    with patch.object(approve.r2_baselines, "upload") as mock_upload:
        approve.main([str(blob_dir), "--staging-dir", str(staging)])
    mock_upload.assert_called_once_with(staging)
    assert (staging / "toc.png").exists()


def test_main_exits_when_dir_missing(tmp_path: Path) -> None:
    with pytest.raises(SystemExit) as exc:
        approve.main([str(tmp_path / "does-not-exist")])
    assert exc.value.code == 2


def test_main_exits_when_no_attachments(tmp_path: Path) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    with (
        patch.object(approve.r2_baselines, "upload") as mock_upload,
        pytest.raises(SystemExit) as exc,
    ):
        approve.main([str(blob_dir)])
    assert "No PNG attachments" in str(exc.value)
    mock_upload.assert_not_called()
