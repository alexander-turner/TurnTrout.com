"""
Tests for :mod:`scripts.approve_baselines_from_artifacts`.

The crucial regression coverage here is the long-snapshot-name case: when
Playwright writes ``test-results/<truncated>-<hash>-<actual>.png`` instead of
``test-results/<full-name>-actual.png``. The pre-blob-report version of the
script stripped ``-actual.png`` from the on-disk filename and uploaded *that* to
R2 — so the canonical baseline never got refreshed and visual-testing kept
failing on the same diff. We assert here that the blob-report path round-trips
the canonical name verbatim regardless of any truncation in the test-results
tree.
"""

from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path
from unittest.mock import patch

import pytest

from scripts import approve_baselines_from_artifacts as approve

# 1×1 transparent PNG; enough bytes to round-trip through a zip without
# trickling the test through real image processing.
_PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000d49444154789c63000100000005000100000a2db40000000049454e"
    "44ae426082"
)


def _make_blob_zip(
    path: Path,
    attachments: list[tuple[str, str, bytes | None]],
) -> None:
    """
    Write a fake blob report zip mirroring Playwright's blob-reporter shape.

    Each ``(name, content_type, body)`` becomes one ``onAttach`` event;
    non-``None`` bodies also become a ``resources/...`` entry inside the zip.
    """
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
        # Common short shape.
        ("toc-Desktop-Safari-actual", "toc-Desktop-Safari.png"),
        # Extension already present on the snapshot name.
        (
            "spoiler-after-revealing-light.png-actual",
            "spoiler-after-revealing-light.png",
        ),
        # Long descriptive name — the case the on-disk script silently broke
        # because Playwright would truncate-and-hash the path.
        (
            "-can-trigger-popover-links-show-popover-on-hover-"
            "-screenshot--first-visible-popover-Desktop-Safari-actual",
            "-can-trigger-popover-links-show-popover-on-hover-"
            "-screenshot--first-visible-popover-Desktop-Safari.png",
        ),
        # Non-actual attachments shouldn't yield a baseline.
        ("toc-Desktop-Safari-expected", None),
        ("toc-Desktop-Safari-diff", None),
        ("trace", None),
    ],
)
def test_canonical_baseline_name(
    attachment_name: str, expected: str | None
) -> None:
    """``_canonical_baseline_name`` extracts canonical PNG name iff
    ``-actual``."""
    assert approve._canonical_baseline_name(attachment_name) == expected


def test_collect_extracts_actual_png_attachments(tmp_path: Path) -> None:
    """Each ``image/png`` ``-actual`` attachment lands at its canonical path."""
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    _make_blob_zip(
        blob_dir / "linux-report-1.zip",
        [
            ("toc-Desktop-Safari-actual", "image/png", _PNG_BYTES),
            ("toc-Desktop-Safari-expected", "image/png", _PNG_BYTES),
            ("toc-Desktop-Safari-diff", "image/png", _PNG_BYTES),
            # The bug repro: long name that on-disk Playwright would truncate.
            (
                "-can-trigger-popover-links-show-popover-on-hover-"
                "-screenshot--first-visible-popover-Desktop-Safari-actual",
                "image/png",
                _PNG_BYTES,
            ),
            # Non-PNG attachment is skipped (e.g. trace, video).
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
    """Same snapshot reported by multiple shards is staged once."""
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
    """Metadata pointing at an absent zip entry is skipped, not crashed on."""
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
                        "testId": "t",
                        "resultId": "r",
                        "attachments": [
                            {
                                "name": "toc-Desktop-Safari-actual",
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
    count = approve.collect_from_blob_reports(blob_dir, staging)
    assert count == 0


def test_collect_handles_blob_zip_without_report_jsonl(tmp_path: Path) -> None:
    """A zip with no ``report.jsonl`` is silently skipped."""
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    with zipfile.ZipFile(blob_dir / "empty.zip", "w") as zf:
        zf.writestr("unrelated.txt", "no jsonl here")

    staging = tmp_path / "stage"
    assert approve.collect_from_blob_reports(blob_dir, staging) == 0


def test_collect_skips_blank_jsonl_lines(tmp_path: Path) -> None:
    """Blank lines in ``report.jsonl`` don't break parsing."""
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
                    "   ",
                    json.dumps(
                        {
                            "method": "onAttach",
                            "params": {
                                "testId": "t",
                                "resultId": "r",
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

    staging = tmp_path / "stage"
    assert approve.collect_from_blob_reports(blob_dir, staging) == 1


def test_collect_ignores_non_attach_events(tmp_path: Path) -> None:
    """``onTestBegin`` / ``onTestEnd`` etc. carry no attachments to stage."""
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    zip_path = blob_dir / "report.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr(
            "report.jsonl",
            "\n".join(
                json.dumps(e)
                for e in [
                    {"method": "onTestBegin", "params": {}},
                    {"method": "onTestEnd", "params": {}},
                    {"method": "onBlobReportMetadata", "params": {}},
                ]
            )
            + "\n",
        )

    staging = tmp_path / "stage"
    assert approve.collect_from_blob_reports(blob_dir, staging) == 0


def test_collect_skips_attachments_without_path(tmp_path: Path) -> None:
    """
    Inline ``body`` attachments without a ``path`` aren't staged.

    Playwright can inline tiny attachments as base64 instead of writing a
    resources/ file. We only want PNG bytes that came from disk.
    """
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
                        "testId": "t",
                        "resultId": "r",
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

    staging = tmp_path / "stage"
    assert approve.collect_from_blob_reports(blob_dir, staging) == 0


def test_main_uploads_when_attachments_found(tmp_path: Path) -> None:
    """``main`` stages then calls ``r2_baselines.upload`` on the staging dir."""
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    _make_blob_zip(
        blob_dir / "report.zip",
        [("toc-actual", "image/png", _PNG_BYTES)],
    )
    staging = tmp_path / "stage"

    with patch.object(approve.r2_baselines, "upload") as mock_upload:
        exit_code = approve.main([str(blob_dir), "--staging-dir", str(staging)])
    assert exit_code == 0
    mock_upload.assert_called_once_with(staging)
    assert (staging / "toc.png").exists()


def test_main_returns_nonzero_when_dir_missing(tmp_path: Path) -> None:
    """Invalid input directory yields exit code 2, not a crash."""
    missing = tmp_path / "does-not-exist"
    assert approve.main([str(missing)]) == 2


def test_main_returns_nonzero_when_no_attachments(tmp_path: Path) -> None:
    """Empty input directory yields exit code 1 and skips the upload."""
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()

    with patch.object(approve.r2_baselines, "upload") as mock_upload:
        exit_code = approve.main([str(blob_dir)])
    assert exit_code == 1
    mock_upload.assert_not_called()


def test_iter_actual_attachments_handles_corrupt_zip(tmp_path: Path) -> None:
    """A zip whose ``report.jsonl`` entry is missing yields no attachments."""
    zip_path = tmp_path / "broken.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("resources/orphan.png", b"png-bytes")

    # No raise, no attachments.
    assert list(approve._iter_actual_attachments(zip_path)) == []


def test_iter_actual_attachments_streams_zip_entries(
    tmp_path: Path,
) -> None:
    """The iterator returns paths usable for in-zip reads, not absolute
    paths."""
    zip_path = tmp_path / "report.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("resources/sha0.png", _PNG_BYTES)
        zf.writestr(
            "report.jsonl",
            json.dumps(
                {
                    "method": "onAttach",
                    "params": {
                        "attachments": [
                            {
                                "name": "long-name-actual",
                                "contentType": "image/png",
                                "path": "resources/sha0.png",
                            }
                        ],
                    },
                }
            )
            + "\n",
        )

    results = list(approve._iter_actual_attachments(zip_path))
    assert results == [("long-name.png", "resources/sha0.png")]
    # The path the iterator returned must read out the bytes from the same zip.
    with zipfile.ZipFile(zip_path) as zf:
        assert zf.read(results[0][1]) == _PNG_BYTES


def test_collect_from_blob_reports_no_zips(tmp_path: Path) -> None:
    """An empty blob-reports dir staging is a no-op without raising."""
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    staging = tmp_path / "stage"
    assert approve.collect_from_blob_reports(blob_dir, staging) == 0
    # Staging dir is still created so subsequent uploads don't crash.
    assert staging.is_dir()


def test_iter_actual_attachments_uses_io_only(tmp_path: Path) -> None:
    """Smoke check: blob parsing works against an in-memory zip too."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("resources/sha0.png", _PNG_BYTES)
        zf.writestr(
            "report.jsonl",
            json.dumps(
                {
                    "method": "onAttach",
                    "params": {
                        "attachments": [
                            {
                                "name": "x-actual",
                                "contentType": "image/png",
                                "path": "resources/sha0.png",
                            }
                        ]
                    },
                }
            )
            + "\n",
        )
    zip_path = tmp_path / "in-memory.zip"
    zip_path.write_bytes(buffer.getvalue())
    assert list(approve._iter_actual_attachments(zip_path)) == [
        ("x.png", "resources/sha0.png")
    ]
