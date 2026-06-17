"""Tests for scripts/check_link_archive_integrity.py."""

from pathlib import Path
from unittest.mock import MagicMock

import pytest
import requests

from .. import archive_links, check_link_archive_integrity, utils


def _session(side_effect) -> MagicMock:
    """A fake requests.Session whose ``head`` is driven by *side_effect*."""
    session = MagicMock()
    session.head.side_effect = side_effect
    return session


def _ok(status: int):
    response = MagicMock()
    response.status_code = status
    return response


def test_find_broken_skips_entries_without_archive_url() -> None:
    manifest = {"https://a.com": {"archive_url": "", "dead": False}}
    session = _session([])
    assert (
        check_link_archive_integrity.find_broken_archives(manifest, session)
        == []
    )
    session.head.assert_not_called()


def test_find_broken_passes_live_snapshots() -> None:
    manifest = {
        "https://a.com": {"archive_url": "https://cdn/a.html", "dead": True}
    }
    broken = check_link_archive_integrity.find_broken_archives(
        manifest, _session([_ok(200)])
    )
    assert broken == []


def test_find_broken_flags_non_200_and_exceptions() -> None:
    manifest = {
        "https://gone.com": {"archive_url": "https://cdn/gone.html"},
        "https://err.com": {"archive_url": "https://cdn/err.html"},
    }
    # Entries are probed in sorted order: err.com before gone.com.
    session = _session([requests.ConnectionError("boom"), _ok(404)])
    broken = check_link_archive_integrity.find_broken_archives(
        manifest, session
    )
    assert broken == [
        ("https://err.com", "https://cdn/err.html", 0),
        ("https://gone.com", "https://cdn/gone.html", 404),
    ]


@pytest.fixture()
def _patched_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    """Stub git root + http session so ``main`` never touches the network."""
    monkeypatch.setattr(utils, "get_git_root", lambda: tmp_path)
    monkeypatch.setattr(
        check_link_archive_integrity.script_utils,
        "get_git_root",
        lambda: tmp_path,
    )
    monkeypatch.setattr(utils, "http_session", lambda: MagicMock())
    monkeypatch.setattr(
        check_link_archive_integrity.script_utils,
        "http_session",
        lambda: MagicMock(),
    )


def test_main_returns_zero_when_all_live(
    monkeypatch: pytest.MonkeyPatch, _patched_env, capsys
) -> None:
    monkeypatch.setattr(
        archive_links,
        "load_manifest",
        lambda _path: {"https://a.com": {"archive_url": "https://cdn/a.html"}},
    )
    monkeypatch.setattr(
        check_link_archive_integrity, "find_broken_archives", lambda *_: []
    )
    assert check_link_archive_integrity.main(["/tmp/manifest.json"]) == 0
    assert "are live" in capsys.readouterr().out


def test_main_returns_one_when_broken(
    monkeypatch: pytest.MonkeyPatch, _patched_env, capsys
) -> None:
    monkeypatch.setattr(archive_links, "load_manifest", lambda _path: {})
    monkeypatch.setattr(
        check_link_archive_integrity,
        "find_broken_archives",
        lambda *_: [("https://a.com", "https://cdn/a.html", 404)],
    )
    assert check_link_archive_integrity.main([]) == 1
    assert "not live" in capsys.readouterr().err


def test_main_defaults_to_committed_manifest_path(
    monkeypatch: pytest.MonkeyPatch, _patched_env
) -> None:
    seen: dict[str, Path] = {}

    def fake_load(path: Path):
        seen["path"] = path
        return {}

    monkeypatch.setattr(archive_links, "load_manifest", fake_load)
    monkeypatch.setattr(
        check_link_archive_integrity, "find_broken_archives", lambda *_: []
    )
    monkeypatch.setattr("sys.argv", ["check_link_archive_integrity.py"])
    assert check_link_archive_integrity.main() == 0
    assert seen["path"].name == "link_archive_manifest.json"
