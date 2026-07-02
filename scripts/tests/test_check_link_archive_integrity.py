"""Tests for scripts/check_link_archive_integrity.py."""

from pathlib import Path
from unittest.mock import MagicMock

import pytest
import requests

from .. import archive_links, check_link_archive_integrity, utils

_PREFIX = check_link_archive_integrity.ARCHIVE_URL_PREFIX


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
        "https://a.com": {"archive_url": f"{_PREFIX}a/x.html", "dead": True}
    }
    broken = check_link_archive_integrity.find_broken_archives(
        manifest, _session([_ok(200)])
    )
    assert broken == []


def test_find_broken_flags_non_200_and_exceptions() -> None:
    manifest = {
        "https://gone.com": {"archive_url": f"{_PREFIX}gone/x.html"},
        "https://err.com": {"archive_url": f"{_PREFIX}err/x.html"},
    }
    # Entries are probed in sorted order: err.com before gone.com.
    session = _session([requests.ConnectionError("boom"), _ok(404)])
    broken = check_link_archive_integrity.find_broken_archives(
        manifest, session
    )
    assert broken == [
        ("https://err.com", f"{_PREFIX}err/x.html", 0),
        ("https://gone.com", f"{_PREFIX}gone/x.html", 404),
    ]


def test_find_broken_flags_foreign_origin_without_probing() -> None:
    # Mirrors the reader's origin check: an archive_url outside the snapshot
    # prefix is broken by definition, no HEAD needed.
    manifest = {
        "https://a.com": {
            "archive_url": "https://evil.example.com/x.html",
            "dead": True,
        }
    }
    session = _session([])
    broken = check_link_archive_integrity.find_broken_archives(
        manifest, session
    )
    assert broken == [
        (
            "https://a.com",
            "https://evil.example.com/x.html",
            check_link_archive_integrity.FOREIGN_ORIGIN,
        )
    ]
    session.head.assert_not_called()


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
        lambda *_: [
            ("https://a.com", f"{_PREFIX}a/x.html", 404),
            (
                "https://b.com",
                "https://evil.example.com/x.html",
                check_link_archive_integrity.FOREIGN_ORIGIN,
            ),
        ],
    )
    assert check_link_archive_integrity.main([]) == 1
    err = capsys.readouterr().err
    assert "not live" in err
    assert "FOREIGN-ORIGIN" in err


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
