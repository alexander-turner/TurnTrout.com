"""Tests for :mod:`scripts.classify_visual_failures`."""

from __future__ import annotations

import json
import zipfile
from collections.abc import Iterable
from pathlib import Path

import pytest

from scripts import classify_visual_failures as classify


def _write_blob(
    path: Path, events: Iterable[dict], include_jsonl: bool = True
) -> None:
    with zipfile.ZipFile(path, "w") as zf:
        if include_jsonl:
            zf.writestr(
                "report.jsonl",
                "\n".join(json.dumps(e) for e in events) + "\n",
            )


def _test_end(
    test_id: str,
    status: str,
    expected_status: str = "passed",
) -> dict:
    return {
        "method": "onTestEnd",
        "params": {
            "test": {
                "testId": test_id,
                "expectedStatus": expected_status,
            },
            "result": {"status": status},
        },
    }


def _attach(test_id: str, attachment_names: Iterable[str]) -> dict:
    return {
        "method": "onAttach",
        "params": {
            "testId": test_id,
            "attachments": [
                {"name": name, "contentType": "image/png"}
                for name in attachment_names
            ],
        },
    }


def test_classification_flags_round_trip() -> None:
    none_failed = classify.Classification(snapshot_failures=0, real_failures=0)
    assert none_failed.has_any_failures is False
    assert none_failed.has_real_failures is False

    snapshot_only = classify.Classification(
        snapshot_failures=3, real_failures=0
    )
    assert snapshot_only.has_any_failures is True
    assert snapshot_only.has_real_failures is False

    real_only = classify.Classification(snapshot_failures=0, real_failures=2)
    assert real_only.has_any_failures is True
    assert real_only.has_real_failures is True


def test_classify_directory_empty(tmp_path: Path) -> None:
    result = classify.classify_directory(tmp_path)
    assert result == classify.Classification(0, 0)


def test_snapshot_failure_counted_as_snapshot(tmp_path: Path) -> None:
    _write_blob(
        tmp_path / "report.zip",
        [
            _test_end("t1", "failed"),
            _attach("t1", ["foo-Desktop-Chrome-actual.png"]),
        ],
    )
    result = classify.classify_directory(tmp_path)
    assert result == classify.Classification(
        snapshot_failures=1, real_failures=0
    )


def test_non_snapshot_failure_counted_as_real(tmp_path: Path) -> None:
    _write_blob(
        tmp_path / "report.zip",
        [
            _test_end("t1", "timedOut"),
            _attach("t1", ["test-failed-1.png"]),
        ],
    )
    result = classify.classify_directory(tmp_path)
    assert result == classify.Classification(
        snapshot_failures=0, real_failures=1
    )


def test_passing_test_ignored(tmp_path: Path) -> None:
    _write_blob(
        tmp_path / "report.zip",
        [_test_end("t1", "passed")],
    )
    assert classify.classify_directory(tmp_path) == classify.Classification(
        0, 0
    )


def test_flaky_test_not_a_failure(tmp_path: Path) -> None:
    # Retry: first attempt failed, second passed → "expected" outcome.
    _write_blob(
        tmp_path / "report.zip",
        [
            _test_end("t1", "failed"),
            _attach("t1", ["foo-actual.png"]),
            _test_end("t1", "passed"),
        ],
    )
    assert classify.classify_directory(tmp_path) == classify.Classification(
        0, 0
    )


def test_expected_failure_not_counted(tmp_path: Path) -> None:
    # test.fail() marks expectedStatus="failed"; matching outcome is fine.
    _write_blob(
        tmp_path / "report.zip",
        [_test_end("t1", "failed", expected_status="failed")],
    )
    assert classify.classify_directory(tmp_path) == classify.Classification(
        0, 0
    )


def test_mixed_snapshot_and_real_counted_separately(tmp_path: Path) -> None:
    _write_blob(
        tmp_path / "report.zip",
        [
            _test_end("snap", "failed"),
            _attach("snap", ["one-actual.png"]),
            _test_end("err", "failed"),
            _test_end("ok", "passed"),
        ],
    )
    assert classify.classify_directory(tmp_path) == classify.Classification(
        snapshot_failures=1, real_failures=1
    )


def test_multiple_blobs_summed(tmp_path: Path) -> None:
    _write_blob(
        tmp_path / "a.zip",
        [
            _test_end("t1", "failed"),
            _attach("t1", ["one-actual.png"]),
        ],
    )
    _write_blob(
        tmp_path / "b.zip",
        [_test_end("t2", "failed")],
    )
    assert classify.classify_directory(tmp_path) == classify.Classification(
        snapshot_failures=1, real_failures=1
    )


def test_blank_lines_and_unknown_methods_ignored(tmp_path: Path) -> None:
    path = tmp_path / "report.zip"
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr(
            "report.jsonl",
            "\n".join(
                [
                    "",
                    json.dumps({"method": "onBegin", "params": {}}),
                    json.dumps(_test_end("t1", "failed")),
                ]
            )
            + "\n",
        )
    assert classify.classify_directory(tmp_path) == classify.Classification(
        snapshot_failures=0, real_failures=1
    )


def test_missing_jsonl_treated_as_no_data(tmp_path: Path) -> None:
    _write_blob(tmp_path / "report.zip", [], include_jsonl=False)
    assert classify.classify_directory(tmp_path) == classify.Classification(
        0, 0
    )


def test_attachments_without_testid_ignored(tmp_path: Path) -> None:
    _write_blob(
        tmp_path / "report.zip",
        [
            _test_end("t1", "failed"),
            # Detached: no testId — should not link to t1.
            {
                "method": "onAttach",
                "params": {
                    "attachments": [
                        {
                            "name": "stray-actual.png",
                            "contentType": "image/png",
                        }
                    ],
                },
            },
        ],
    )
    assert classify.classify_directory(tmp_path) == classify.Classification(
        snapshot_failures=0, real_failures=1
    )


def test_event_without_test_id_ignored(tmp_path: Path) -> None:
    _write_blob(
        tmp_path / "report.zip",
        [
            {
                "method": "onTestEnd",
                "params": {
                    "test": {},
                    "result": {"status": "failed"},
                },
            },
        ],
    )
    assert classify.classify_directory(tmp_path) == classify.Classification(
        0, 0
    )


def test_event_without_status_ignored(tmp_path: Path) -> None:
    _write_blob(
        tmp_path / "report.zip",
        [
            {
                "method": "onTestEnd",
                "params": {
                    "test": {"testId": "t1", "expectedStatus": "passed"},
                    "result": {},
                },
            },
        ],
    )
    assert classify.classify_directory(tmp_path) == classify.Classification(
        0, 0
    )


def test_attachment_without_name_ignored(tmp_path: Path) -> None:
    _write_blob(
        tmp_path / "report.zip",
        [
            _test_end("t1", "failed"),
            {
                "method": "onAttach",
                "params": {
                    "testId": "t1",
                    "attachments": [{"contentType": "image/png"}],
                },
            },
        ],
    )
    # No -actual.png attachment, so this is a real failure.
    assert classify.classify_directory(tmp_path) == classify.Classification(
        snapshot_failures=0, real_failures=1
    )


def test_null_params_tolerated(tmp_path: Path) -> None:
    _write_blob(
        tmp_path / "report.zip",
        [
            {"method": "onTestEnd", "params": None},
            {"method": "onAttach", "params": None},
        ],
    )
    assert classify.classify_directory(tmp_path) == classify.Classification(
        0, 0
    )


def test_main_writes_flags_to_output(tmp_path: Path) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    _write_blob(
        blob_dir / "report.zip",
        [
            _test_end("t1", "failed"),
            _attach("t1", ["foo-actual.png"]),
        ],
    )
    output = tmp_path / "status.txt"
    rc = classify.main([str(blob_dir), "--output", str(output)])
    assert rc == 0
    text = output.read_text()
    assert "has_any_failures=true" in text
    assert "has_real_failures=false" in text
    assert "snapshot_failures=1" in text
    assert "real_failures=0" in text


def test_main_writes_flags_to_stdout_when_no_output(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    rc = classify.main([str(blob_dir)])
    assert rc == 0
    out = capsys.readouterr().out
    assert "has_any_failures=false" in out
    assert "has_real_failures=false" in out


def test_main_fail_on_real_exits_nonzero(tmp_path: Path) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    _write_blob(
        blob_dir / "report.zip",
        [_test_end("t1", "failed")],
    )
    rc = classify.main([str(blob_dir), "--fail-on-real"])
    assert rc == 1


def test_main_fail_on_real_zero_for_snapshot_only(tmp_path: Path) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    _write_blob(
        blob_dir / "report.zip",
        [
            _test_end("t1", "failed"),
            _attach("t1", ["foo-actual.png"]),
        ],
    )
    rc = classify.main([str(blob_dir), "--fail-on-real"])
    assert rc == 0


def test_main_raises_when_dir_missing(tmp_path: Path) -> None:
    with pytest.raises(NotADirectoryError):
        classify.main([str(tmp_path / "nope")])


def test_playwright_failure_with_empty_blob_dir_promoted_to_real(
    tmp_path: Path,
) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    rc = classify.main(
        [
            str(blob_dir),
            "--playwright-outcome",
            "failure",
            "--fail-on-real",
        ]
    )
    assert rc == 1


def test_playwright_failure_tolerates_missing_blob_dir(tmp_path: Path) -> None:
    output = tmp_path / "status.txt"
    rc = classify.main(
        [
            str(tmp_path / "no-such-dir"),
            "--playwright-outcome",
            "failure",
            "--output",
            str(output),
        ]
    )
    assert rc == 0
    text = output.read_text()
    assert "has_any_failures=true" in text
    assert "has_real_failures=true" in text


def test_playwright_success_with_missing_blob_dir_no_failures(
    tmp_path: Path,
) -> None:
    output = tmp_path / "status.txt"
    rc = classify.main(
        [
            str(tmp_path / "no-such-dir"),
            "--playwright-outcome",
            "success",
            "--output",
            str(output),
        ]
    )
    assert rc == 0
    text = output.read_text()
    assert "has_any_failures=false" in text
    assert "has_real_failures=false" in text


def test_playwright_failure_does_not_override_snapshot_only(
    tmp_path: Path,
) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    _write_blob(
        blob_dir / "report.zip",
        [
            _test_end("t1", "failed"),
            _attach("t1", ["foo-actual.png"]),
        ],
    )
    output = tmp_path / "status.txt"
    rc = classify.main(
        [
            str(blob_dir),
            "--playwright-outcome",
            "failure",
            "--output",
            str(output),
        ]
    )
    assert rc == 0
    text = output.read_text()
    assert "snapshot_failures=1" in text
    assert "real_failures=0" in text
