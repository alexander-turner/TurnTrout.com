"""Tests for scripts/visual_drift.py."""

from __future__ import annotations

import contextlib
import subprocess
from collections.abc import Iterator
from pathlib import Path
from unittest import mock

import pytest

from scripts import visual_drift


@contextlib.contextmanager
def _fake_config() -> Iterator[Path]:
    yield Path("/tmp/rclone.conf")


# --- compose_note (pure) ----------------------------------------------------


def test_compose_note_non_schedule_has_no_sentinel_prefix() -> None:
    note = visual_drift.compose_note(
        event_name="push",
        ref_name="main",
        environments="linux: pinned",
        provenance_sha=None,
        changed_paths=None,
    )
    assert note == "trigger: push on main · linux: pinned"
    assert "sentinel" not in note


def test_compose_note_non_schedule_without_environments() -> None:
    note = visual_drift.compose_note(
        event_name="pull_request",
        ref_name="my-branch",
        environments="",
        provenance_sha="abc",
        changed_paths=[],
    )
    assert note == "trigger: pull_request on my-branch"


def test_compose_note_schedule_no_provenance_hedges() -> None:
    note = visual_drift.compose_note(
        event_name="schedule",
        ref_name="main",
        environments="",
        provenance_sha=None,
        changed_paths=None,
    )
    assert "no baseline-approval provenance recorded yet" in note
    assert note.endswith("trigger: schedule on main")


def test_compose_note_schedule_unresolved_commit_hedges() -> None:
    note = visual_drift.compose_note(
        event_name="schedule",
        ref_name="main",
        environments="linux: pinned",
        provenance_sha="deadbeefcafe",
        changed_paths=None,
    )
    assert "couldn't resolve the baseline-approval commit deadbeef" in note
    assert note.endswith("· linux: pinned")


def test_compose_note_schedule_no_change_is_deterministic_drift() -> None:
    note = visual_drift.compose_note(
        event_name="schedule",
        ref_name="main",
        environments="",
        provenance_sha="deadbeefcafe1234",
        changed_paths=[],
    )
    assert "main is unchanged in rendering-relevant paths" in note
    assert "approved at deadbeef" in note
    assert "every diff below is environment drift" in note


def test_compose_note_schedule_single_change_singular_wording() -> None:
    note = visual_drift.compose_note(
        event_name="schedule",
        ref_name="main",
        environments="",
        provenance_sha="deadbeefcafe1234",
        changed_paths=["quartz/foo.ts"],
    )
    assert "1 rendering-relevant file," in note
    assert "e.g. quartz/foo.ts" in note
    assert "may be code changes" in note


def test_compose_note_schedule_multiple_changes_plural_wording() -> None:
    note = visual_drift.compose_note(
        event_name="schedule",
        ref_name="main",
        environments="macos",
        provenance_sha="deadbeefcafe1234",
        changed_paths=["website_content/a.md", "quartz/b.ts"],
    )
    assert "2 rendering-relevant files," in note
    assert "e.g. website_content/a.md" in note
    assert note.endswith("· macos")


# --- read_provenance_sha ----------------------------------------------------


def test_read_provenance_sha_success() -> None:
    with (
        mock.patch.object(visual_drift.r2_sync, "rclone_config", _fake_config),
        mock.patch.object(
            visual_drift.r2_sync,
            "rclone_output",
            return_value='{"sha": "abc123"}',
        ),
    ):
        assert visual_drift.read_provenance_sha() == "abc123"


def test_read_provenance_sha_missing_object_returns_none(
    capsys: pytest.CaptureFixture[str],
) -> None:
    err = subprocess.CalledProcessError(1, ["rclone"])
    with (
        mock.patch.object(visual_drift.r2_sync, "rclone_config", _fake_config),
        mock.patch.object(
            visual_drift.r2_sync, "rclone_output", side_effect=err
        ),
    ):
        assert visual_drift.read_provenance_sha() is None
    assert "hedge" in capsys.readouterr().err


def test_read_provenance_sha_malformed_json_returns_none(
    capsys: pytest.CaptureFixture[str],
) -> None:
    with (
        mock.patch.object(visual_drift.r2_sync, "rclone_config", _fake_config),
        mock.patch.object(
            visual_drift.r2_sync, "rclone_output", return_value="not json"
        ),
    ):
        assert visual_drift.read_provenance_sha() is None
    assert "malformed" in capsys.readouterr().err


def test_read_provenance_sha_non_object_json_returns_none() -> None:
    # A bare JSON array has no .get -> AttributeError branch.
    with (
        mock.patch.object(visual_drift.r2_sync, "rclone_config", _fake_config),
        mock.patch.object(
            visual_drift.r2_sync, "rclone_output", return_value="[1, 2]"
        ),
    ):
        assert visual_drift.read_provenance_sha() is None


@pytest.mark.parametrize("raw", ['{"sha": ""}', '{"sha": 5}', "{}"])
def test_read_provenance_sha_bad_sha_returns_none(
    raw: str, capsys: pytest.CaptureFixture[str]
) -> None:
    with (
        mock.patch.object(visual_drift.r2_sync, "rclone_config", _fake_config),
        mock.patch.object(
            visual_drift.r2_sync, "rclone_output", return_value=raw
        ),
    ):
        assert visual_drift.read_provenance_sha() is None
    assert "no 'sha'" in capsys.readouterr().err


# --- write_provenance_sha ---------------------------------------------------


def test_write_provenance_sha_uploads_json(
    capsys: pytest.CaptureFixture[str],
) -> None:
    with (
        mock.patch.object(visual_drift.r2_sync, "rclone_config", _fake_config),
        mock.patch.object(visual_drift.r2_sync, "rclone") as rclone,
    ):
        visual_drift.write_provenance_sha("abc123")
    args, _ = rclone.call_args
    argv, _config = args
    assert argv[0] == "copyto"
    assert argv[2] == visual_drift._remote_object()
    written = Path(argv[1])
    # File is cleaned up after the temp dir closes; assert on the call shape.
    assert written.name == "provenance.json"
    assert "Recorded baseline provenance: abc123" in capsys.readouterr().out


def test_write_provenance_sha_rejects_empty() -> None:
    with pytest.raises(ValueError, match="empty provenance"):
        visual_drift.write_provenance_sha("")


# --- CLI --------------------------------------------------------------------


def test_cli_read_provenance_prints_sha(
    capsys: pytest.CaptureFixture[str],
) -> None:
    with mock.patch.object(
        visual_drift, "read_provenance_sha", return_value="abc123"
    ):
        visual_drift.main(["read-provenance"])
    assert capsys.readouterr().out == "abc123\n"


def test_cli_read_provenance_prints_nothing_when_absent(
    capsys: pytest.CaptureFixture[str],
) -> None:
    with mock.patch.object(
        visual_drift, "read_provenance_sha", return_value=None
    ):
        visual_drift.main(["read-provenance"])
    assert capsys.readouterr().out == ""


def test_cli_write_provenance_delegates() -> None:
    with mock.patch.object(visual_drift, "write_provenance_sha") as write:
        visual_drift.main(["write-provenance", "--sha", "abc123"])
    write.assert_called_once_with("abc123")


def test_cli_render_paths_prints_all(
    capsys: pytest.CaptureFixture[str],
) -> None:
    visual_drift.main(["render-paths"])
    out = capsys.readouterr().out.splitlines()
    assert out == list(visual_drift.RENDERING_RELEVANT_PATHS)


def test_cli_compose_note_with_changed_file(
    capsys: pytest.CaptureFixture[str], tmp_path: Path
) -> None:
    changed = tmp_path / "changed.txt"
    changed.write_text(
        "quartz/a.ts\n\nwebsite_content/b.md\n", encoding="utf-8"
    )
    visual_drift.main(
        [
            "compose-note",
            "--event-name",
            "schedule",
            "--ref-name",
            "main",
            "--provenance-sha",
            "deadbeefcafe",
            "--changed-paths-file",
            str(changed),
        ]
    )
    out = capsys.readouterr().out
    # Blank lines are dropped -> two real paths.
    assert "2 rendering-relevant files," in out


def test_cli_compose_note_changed_unknown_overrides_file(
    capsys: pytest.CaptureFixture[str], tmp_path: Path
) -> None:
    changed = tmp_path / "changed.txt"
    changed.write_text("quartz/a.ts\n", encoding="utf-8")
    visual_drift.main(
        [
            "compose-note",
            "--event-name",
            "schedule",
            "--ref-name",
            "main",
            "--provenance-sha",
            "deadbeefcafe",
            "--changed-paths-file",
            str(changed),
            "--changed-unknown",
        ]
    )
    assert "couldn't resolve" in capsys.readouterr().out


def test_cli_compose_note_no_provenance(
    capsys: pytest.CaptureFixture[str],
) -> None:
    visual_drift.main(
        [
            "compose-note",
            "--event-name",
            "schedule",
            "--ref-name",
            "main",
        ]
    )
    assert (
        "no baseline-approval provenance recorded yet"
        in capsys.readouterr().out
    )
