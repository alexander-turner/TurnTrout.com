"""Tests for :mod:`scripts.classify_visual_failures`."""

from __future__ import annotations

import json
import zipfile
from collections.abc import Iterable
from pathlib import Path

import pytest

from scripts import classify_visual_failures as classify

_Cls = classify.Classification


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
    test_id: str, status: str, expected_status: str = "passed"
) -> dict:
    return {
        "method": "onTestEnd",
        "params": {
            "test": {"testId": test_id, "expectedStatus": expected_status},
            "result": {"status": status},
        },
    }


def _attach(test_id: str | None, attachment_names: Iterable[str]) -> dict:
    params: dict = {
        "attachments": [
            {"name": name, "contentType": "image/png"}
            for name in attachment_names
        ],
    }
    if test_id is not None:
        params["testId"] = test_id
    return {"method": "onAttach", "params": params}


def _classify_with_events(tmp_path: Path, events: list[dict]) -> _Cls:
    _write_blob(tmp_path / "report.zip", events)
    return classify.classify_directory(tmp_path)


@pytest.mark.parametrize(
    "snapshot, real",
    [(0, 0), (3, 0), (0, 2), (1, 1)],
)
def test_classification_flags(snapshot: int, real: int) -> None:
    c = _Cls(snapshot_failures=snapshot, real_failures=real)
    assert c.has_any_failures is (snapshot + real > 0)
    assert c.has_real_failures is (real > 0)


@pytest.mark.parametrize(
    "events, expected",
    [
        pytest.param(
            [
                _test_end("t1", "failed"),
                _attach("t1", ["foo-Desktop-Chrome-actual.png"]),
            ],
            _Cls(1, 0),
            id="snapshot_failure",
        ),
        pytest.param(
            [
                _test_end("t1", "timedOut"),
                _attach("t1", ["test-failed-1.png"]),
            ],
            _Cls(0, 1),
            id="non_snapshot_attachment_is_real_failure",
        ),
        pytest.param(
            [_test_end("t1", "passed")], _Cls(0, 0), id="passing_test"
        ),
        pytest.param(
            [
                _test_end("t1", "failed"),
                _attach("t1", ["foo-actual.png"]),
                _test_end("t1", "passed"),
            ],
            _Cls(0, 0),
            id="flaky_retry_passes",
        ),
        pytest.param(
            [_test_end("t1", "failed", expected_status="failed")],
            _Cls(0, 0),
            id="expected_failure",
        ),
        pytest.param(
            [
                _test_end("snap", "failed"),
                _attach("snap", ["one-actual.png"]),
                _test_end("err", "failed"),
                _test_end("ok", "passed"),
            ],
            _Cls(1, 1),
            id="mixed_snapshot_and_real",
        ),
        pytest.param(
            [
                {
                    "method": "onTestEnd",
                    "params": {
                        "test": {},
                        "result": {"status": "failed"},
                    },
                }
            ],
            _Cls(0, 0),
            id="event_without_test_id",
        ),
        pytest.param(
            [
                {
                    "method": "onTestEnd",
                    "params": {
                        "test": {"testId": "t1", "expectedStatus": "passed"},
                        "result": {},
                    },
                }
            ],
            _Cls(0, 0),
            id="event_without_status",
        ),
        pytest.param(
            [
                _test_end("t1", "failed"),
                _attach(None, ["stray-actual.png"]),
            ],
            _Cls(0, 1),
            id="attach_without_test_id_does_not_link",
        ),
        pytest.param(
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
            _Cls(0, 1),
            id="attachment_without_name_is_real",
        ),
        pytest.param(
            [
                {"method": "onTestEnd", "params": None},
                {"method": "onAttach", "params": None},
            ],
            _Cls(0, 0),
            id="null_params_tolerated",
        ),
    ],
)
def test_classify_single_blob(
    tmp_path: Path, events: list[dict], expected: _Cls
) -> None:
    assert _classify_with_events(tmp_path, events) == expected


def test_classify_empty_directory(tmp_path: Path) -> None:
    assert classify.classify_directory(tmp_path) == _Cls(0, 0)


def test_classify_sums_across_blobs(tmp_path: Path) -> None:
    _write_blob(
        tmp_path / "a.zip",
        [_test_end("t1", "failed"), _attach("t1", ["one-actual.png"])],
    )
    _write_blob(tmp_path / "b.zip", [_test_end("t2", "failed")])
    assert classify.classify_directory(tmp_path) == _Cls(1, 1)


def test_classify_skips_blank_lines_and_unknown_methods(
    tmp_path: Path,
) -> None:
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
    assert classify.classify_directory(tmp_path) == _Cls(0, 1)


def test_classify_blob_without_jsonl_entry(tmp_path: Path) -> None:
    _write_blob(tmp_path / "report.zip", [], include_jsonl=False)
    assert classify.classify_directory(tmp_path) == _Cls(0, 0)


def _flags_from(text: str) -> dict[str, str]:
    return dict(line.split("=", 1) for line in text.strip().splitlines())


@pytest.mark.parametrize(
    "events, extra_args, expected_rc, expected_flags",
    [
        pytest.param(
            [
                _test_end("t1", "failed"),
                _attach("t1", ["foo-actual.png"]),
            ],
            [],
            0,
            {
                "has_any_failures": "true",
                "has_real_failures": "false",
                "snapshot_failures": "1",
                "real_failures": "0",
            },
            id="snapshot_only_writes_flags",
        ),
        pytest.param(
            [
                _test_end("t1", "failed"),
                _attach("t1", ["foo-actual.png"]),
            ],
            ["--fail-on-real"],
            0,
            {"has_real_failures": "false"},
            id="snapshot_only_with_fail_on_real_exits_zero",
        ),
        pytest.param(
            [_test_end("t1", "failed")],
            ["--fail-on-real"],
            1,
            {"has_real_failures": "true"},
            id="real_failure_with_fail_on_real_exits_one",
        ),
        pytest.param(
            [
                _test_end("t1", "failed"),
                _attach("t1", ["foo-actual.png"]),
            ],
            ["--playwright-outcome", "failure"],
            0,
            {"snapshot_failures": "1", "real_failures": "0"},
            id="playwright_failure_does_not_override_snapshot_only",
        ),
        pytest.param(
            [],
            ["--playwright-outcome", "failure", "--fail-on-real"],
            1,
            {"has_real_failures": "true"},
            id="playwright_failure_with_empty_blob_promoted_to_real",
        ),
    ],
)
def test_main_with_blob_dir(
    tmp_path: Path,
    events: list[dict],
    extra_args: list[str],
    expected_rc: int,
    expected_flags: dict[str, str],
) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    if events:
        _write_blob(blob_dir / "report.zip", events)
    output = tmp_path / "status.txt"

    rc = classify.main([str(blob_dir), "--output", str(output), *extra_args])

    assert rc == expected_rc
    flags = _flags_from(output.read_text())
    for key, value in expected_flags.items():
        assert flags[key] == value


@pytest.mark.parametrize(
    "outcome, expected_any, expected_real",
    [
        pytest.param("failure", "true", "true", id="failure_outcome"),
        pytest.param("success", "false", "false", id="success_outcome"),
    ],
)
def test_main_missing_blob_dir_defers_to_playwright_outcome(
    tmp_path: Path, outcome: str, expected_any: str, expected_real: str
) -> None:
    output = tmp_path / "status.txt"
    rc = classify.main(
        [
            str(tmp_path / "no-such-dir"),
            "--playwright-outcome",
            outcome,
            "--output",
            str(output),
        ]
    )
    assert rc == 0
    flags = _flags_from(output.read_text())
    assert flags["has_any_failures"] == expected_any
    assert flags["has_real_failures"] == expected_real


def test_main_writes_to_stdout_without_output_flag(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    blob_dir = tmp_path / "blobs"
    blob_dir.mkdir()
    assert classify.main([str(blob_dir)]) == 0
    flags = _flags_from(capsys.readouterr().out)
    assert flags["has_any_failures"] == "false"
    assert flags["has_real_failures"] == "false"


def test_main_raises_when_blob_dir_missing_and_no_outcome(
    tmp_path: Path,
) -> None:
    with pytest.raises(NotADirectoryError):
        classify.main([str(tmp_path / "nope")])
