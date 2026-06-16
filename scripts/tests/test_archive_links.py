"""Tests for scripts/archive_links.py."""

import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock

import pytest
import requests

from .. import archive_links

# --- canonicalize_url (mirrors archiveLinks.test.ts fixtures) ----------------


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://example.com/", "https://example.com"),
        ("https://example.com", "https://example.com"),
        ("http://Example.com/Path/", "https://example.com/Path"),
        ("https://EXAMPLE.com/a?q=1", "https://example.com/a?q=1"),
        ("https://example.com/a/?q=1", "https://example.com/a?q=1"),
        ("https://example.com/a#frag", "https://example.com/a"),
        ("https://example.com/a/#frag", "https://example.com/a"),
        ("https://example.com:8080/a/", "https://example.com:8080/a"),
        (
            "http://example.com/keep?x=1&y=2#z",
            "https://example.com/keep?x=1&y=2",
        ),
        ("https://user:pw@example.com/a", "https://example.com/a"),
    ],
)
def test_canonicalize_url(url: str, expected: str) -> None:
    assert archive_links.canonicalize_url(url) == expected


# --- find_external_links -----------------------------------------------------


def test_find_external_links_extracts_and_excludes(tmp_path: Path) -> None:
    md = tmp_path / "page.md"
    md.write_text(
        "A [markdown link](https://example.com/a) and bare "
        "https://other.com/b, plus <https://third.com/c>. "
        'Also <a href="https://html.com/d">x</a>. '
        "Own site https://turntrout.com/about and "
        "CDN https://assets.turntrout.com/x.png should be skipped. "
        "Trailing punctuation https://punct.com/e. ",
        encoding="utf-8",
    )

    links = archive_links.find_external_links([md])

    assert links == {
        "https://example.com/a",
        "https://other.com/b",
        "https://third.com/c",
        "https://html.com/d",
        "https://punct.com/e",
    }


def test_find_external_links_skips_schemeless_or_empty_host(
    tmp_path: Path,
) -> None:
    md = tmp_path / "page.md"
    # ``https://`` with no host should not produce an entry.
    md.write_text("broken https:// link", encoding="utf-8")
    assert archive_links.find_external_links([md]) == set()


# --- manifest persistence ----------------------------------------------------


def test_load_manifest_missing(tmp_path: Path) -> None:
    assert archive_links.load_manifest(tmp_path / "nope.json") == {}


def test_save_then_load_manifest_roundtrip(tmp_path: Path) -> None:
    path = tmp_path / "sub" / "manifest.json"
    manifest = {
        "https://b.com": archive_links._new_entry(),
        "https://a.com": archive_links._new_entry(),
    }
    archive_links.save_manifest(path, manifest)

    text = path.read_text(encoding="utf-8")
    assert text.endswith("\n")
    # Keys are written sorted.
    assert text.index('"https://a.com"') < text.index('"https://b.com"')
    assert archive_links.load_manifest(path) == manifest


def test_diff_new_urls() -> None:
    manifest = {"https://known.com": archive_links._new_entry()}
    discovered = {"https://known.com", "https://new.com", "https://also.com"}
    assert archive_links.diff_new_urls(discovered, manifest) == [
        "https://also.com",
        "https://new.com",
    ]


def test_merge_manifest_fragments_prefers_fresher_and_sorts() -> None:
    older = {
        "https://x.com": {"last_checked": "2026-01-01T00:00:00Z", "dead": False}
    }
    newer = {
        "https://x.com": {"last_checked": "2026-02-01T00:00:00Z", "dead": True}
    }
    extra = {"https://a.com": {"last_checked": "", "dead": False}}

    merged = archive_links.merge_manifest_fragments([older, newer, extra])

    assert list(merged.keys()) == ["https://a.com", "https://x.com"]
    assert merged["https://x.com"]["dead"] is True


# --- deny-list ---------------------------------------------------------------


def test_load_denylist_missing(tmp_path: Path) -> None:
    assert archive_links.load_denylist(tmp_path / "nope.json") == frozenset()


def test_load_denylist_lowercases(tmp_path: Path) -> None:
    path = tmp_path / "deny.json"
    path.write_text(
        json.dumps({"hosts": ["X.com", "NYTimes.com"]}), encoding="utf-8"
    )
    assert archive_links.load_denylist(path) == frozenset(
        {"x.com", "nytimes.com"}
    )


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://x.com/foo", True),
        ("https://mobile.x.com/foo", True),
        ("https://notx.com/foo", False),
        ("https://example.com/foo", False),
    ],
)
def test_is_denied(url: str, expected: bool) -> None:
    assert archive_links.is_denied(url, frozenset({"x.com"})) is expected


# --- snapshot keys -----------------------------------------------------------


def test_snapshot_key_is_stable_sha256() -> None:
    canonical = "https://example.com/this-is-a-dead-link-demo"
    assert archive_links.snapshot_key(canonical) == (
        "4e2d0456251df35186ad814553340991e6095a8866160ea5f6a9534fb1a08dcb"
    )


def test_r2_key_and_archive_url() -> None:
    canonical = "https://example.com/a"
    key = archive_links.snapshot_key(canonical)
    assert archive_links.r2_key_for(canonical) == (
        f"static/link-archive/{key}/singlefile.html"
    )
    assert archive_links.archive_url_for(canonical) == (
        f"{archive_links.script_utils.CDN_BASE_URL}/static/link-archive/"
        f"{key}/singlefile.html"
    )


def test_snapshot_dest_path(tmp_path: Path) -> None:
    canonical = "https://example.com/a"
    key = archive_links.snapshot_key(canonical)
    assert archive_links.snapshot_dest_path(tmp_path, canonical) == (
        tmp_path / "link-archive" / key / "singlefile.html"
    )


# --- quality gate + noindex --------------------------------------------------


def test_is_low_quality() -> None:
    assert archive_links.is_low_quality(b"x" * 10, min_size=100) is True
    assert archive_links.is_low_quality(b"x" * 200, min_size=100) is False


@pytest.mark.parametrize(
    ("html", "expected_contains"),
    [
        (
            "<html><head></head><body>x</body></html>",
            "<head>" + archive_links._NOINDEX_META,
        ),
        (
            "<html><body>no head</body></html>",
            archive_links._NOINDEX_META + "<html>",
        ),
    ],
)
def test_inject_noindex_inserts(html: str, expected_contains: str) -> None:
    assert expected_contains in archive_links.inject_noindex(html)


def test_inject_noindex_idempotent() -> None:
    html = f"<head>{archive_links._NOINDEX_META}</head>"
    assert archive_links.inject_noindex(html) == html


# --- liveness ----------------------------------------------------------------


def test_probe_status_success() -> None:
    session = MagicMock()
    response = MagicMock()
    response.status_code = 200
    session.get.return_value = response
    assert archive_links.probe_status("https://example.com", session) == 200
    response.close.assert_called_once()


def test_probe_status_error_returns_zero() -> None:
    session = MagicMock()
    session.get.side_effect = requests.RequestException("boom")
    assert archive_links.probe_status("https://example.com", session) == 0


def test_now_iso_format() -> None:
    stamp = archive_links._now_iso()
    assert stamp.endswith("Z")
    assert "T" in stamp


def test_update_dead_state_dead_strikes_then_flip() -> None:
    entry = archive_links._new_entry()
    first = archive_links.update_dead_state(entry, 404)
    assert first["dead_strikes"] == 1
    assert first["dead"] is False
    assert first["last_status"] == 404

    second = archive_links.update_dead_state(first, 410)
    assert second["dead_strikes"] == 2
    assert second["dead"] is True


def test_update_dead_state_alive_resets() -> None:
    entry = {**archive_links._new_entry(), "dead_strikes": 5, "dead": True}
    updated = archive_links.update_dead_state(entry, 200)
    assert updated["dead_strikes"] == 0
    assert updated["dead"] is False


@pytest.mark.parametrize("status", [403, 429, 500, 0])
def test_update_dead_state_blocked_unchanged(status: int) -> None:
    entry = {**archive_links._new_entry(), "dead_strikes": 1, "dead": False}
    updated = archive_links.update_dead_state(entry, status)
    assert updated["dead_strikes"] == 1
    assert updated["dead"] is False
    assert updated["last_status"] == status


# --- archive_one -------------------------------------------------------------


def _make_snapshot(
    data_dir: Path, name: str, body: bytes = b"x" * 5000
) -> Path:
    snap_dir = data_dir / "archive" / name
    snap_dir.mkdir(parents=True)
    snapshot = snap_dir / archive_links.SNAPSHOT_FILENAME
    snapshot.write_bytes(body)
    return snapshot


def test_archive_one_returns_new_snapshot(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    data_dir = tmp_path / "abox"
    # Pre-existing snapshot that must be ignored (it is in ``before``).
    _make_snapshot(data_dir, "100")

    def fake_add(urls, _data_dir, _parallel, _extractors):
        _make_snapshot(data_dir, "200")

    monkeypatch.setattr(archive_links, "_run_archivebox_add", fake_add)
    result = archive_links.archive_one("https://example.com/a", data_dir)
    assert result == data_dir / "archive" / "200" / "singlefile.html"


def test_archive_one_raises_without_snapshot(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    data_dir = tmp_path / "abox"
    monkeypatch.setattr(
        archive_links, "_run_archivebox_add", lambda *a, **k: None
    )
    with pytest.raises(RuntimeError, match="no singlefile.html"):
        archive_links.archive_one("https://example.com/a", data_dir)


# --- sync_snapshot_to_r2 -----------------------------------------------------


def _make_quartz_snapshot(tmp_path: Path) -> Path:
    dest = (
        tmp_path
        / "quartz"
        / "static"
        / "link-archive"
        / "abc"
        / "singlefile.html"
    )
    dest.parent.mkdir(parents=True)
    dest.write_text("<html></html>", encoding="utf-8")
    return dest


def test_sync_snapshot_to_r2_success(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    dest = _make_quartz_snapshot(tmp_path)
    monkeypatch.setattr(
        archive_links.script_utils, "check_r2_env", lambda: None
    )
    monkeypatch.setattr(
        archive_links.script_utils,
        "find_executable",
        lambda name: f"/usr/bin/{name}",
    )
    captured: dict = {}

    def fake_run(cmd, check):
        captured["cmd"] = cmd
        assert check is True

    monkeypatch.setattr(archive_links.subprocess, "run", fake_run)

    url = archive_links.sync_snapshot_to_r2(dest)
    assert url.startswith(archive_links.r2_upload.R2_BASE_URL)
    assert "static/link-archive/abc/singlefile.html" in url
    assert "X-Robots-Tag: noindex" in captured["cmd"]


def test_sync_snapshot_to_r2_upload_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    dest = _make_quartz_snapshot(tmp_path)
    monkeypatch.setattr(
        archive_links.script_utils, "check_r2_env", lambda: None
    )
    monkeypatch.setattr(
        archive_links.script_utils,
        "find_executable",
        lambda name: f"/usr/bin/{name}",
    )

    def fake_run(cmd, check):
        raise subprocess.CalledProcessError(1, cmd)

    monkeypatch.setattr(archive_links.subprocess, "run", fake_run)
    with pytest.raises(RuntimeError, match="Failed to upload"):
        archive_links.sync_snapshot_to_r2(dest)


# --- archive_and_upload ------------------------------------------------------


def test_archive_and_upload_success(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    data_dir = tmp_path / "abox"
    static_dir = tmp_path / "quartz" / "static"
    static_dir.mkdir(parents=True)
    snapshot = _make_snapshot(
        data_dir,
        "200",
        body=b"<html><head></head><body>" + b"x" * 5000 + b"</body></html>",
    )

    monkeypatch.setattr(archive_links, "archive_one", lambda *a, **k: snapshot)
    monkeypatch.setattr(
        archive_links, "sync_snapshot_to_r2", lambda path: "https://cdn/x.html"
    )

    canonical = "https://example.com/a"
    result = archive_links.archive_and_upload(canonical, data_dir, static_dir)
    assert result == "https://cdn/x.html"

    written = archive_links.snapshot_dest_path(static_dir, canonical)
    assert archive_links._NOINDEX_META in written.read_text(encoding="utf-8")


def test_archive_and_upload_rejects_low_quality(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    data_dir = tmp_path / "abox"
    static_dir = tmp_path / "quartz" / "static"
    snapshot = _make_snapshot(data_dir, "200", body=b"tiny")
    monkeypatch.setattr(archive_links, "archive_one", lambda *a, **k: snapshot)
    with pytest.raises(archive_links.LowQualitySnapshotError):
        archive_links.archive_and_upload(
            "https://example.com/a", data_dir, static_dir
        )


# --- run_archive orchestration ----------------------------------------------


@pytest.fixture()
def content_dir(tmp_path: Path) -> Path:
    directory = tmp_path / "content"
    directory.mkdir()
    (directory / "page.md").write_text(
        "[new](https://new.example.com/page) "
        "[denied](https://x.com/foo) "
        "[done](https://done.example.com/page) ",
        encoding="utf-8",
    )
    return directory


def test_run_archive_full_flow(
    tmp_path: Path, content_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    manifest_path = tmp_path / "manifest.json"
    denylist_path = tmp_path / "deny.json"
    denylist_path.write_text(json.dumps({"hosts": ["x.com"]}), encoding="utf-8")

    # "done" is already archived; "new" is not yet in the manifest.
    archive_links.save_manifest(
        manifest_path,
        {
            "https://done.example.com/page": {
                **archive_links._new_entry(),
                "archive_url": "https://cdn/done.html",
            }
        },
    )

    archived: list[str] = []

    def fake_archive(canonical, *_a, **_k):
        archived.append(canonical)
        return "https://cdn/new.html"

    monkeypatch.setattr(archive_links, "archive_and_upload", fake_archive)
    monkeypatch.setattr(archive_links, "probe_status", lambda url, session: 404)

    manifest = archive_links.run_archive(
        content_dir=content_dir,
        manifest_path=manifest_path,
        denylist_path=denylist_path,
        data_dir=tmp_path / "abox",
        static_dir=tmp_path / "static",
        session=MagicMock(),
    )

    # Only the new, non-denied, not-yet-archived URL was archived.
    assert archived == ["https://new.example.com/page"]
    assert (
        manifest["https://new.example.com/page"]["archive_url"]
        == "https://cdn/new.html"
    )
    # x.com was deny-listed → never archived nor added.
    assert "https://x.com/foo" not in manifest
    # Liveness probed every known URL (404 recorded).
    assert manifest["https://new.example.com/page"]["last_status"] == 404
    assert manifest["https://done.example.com/page"]["last_status"] == 404
    # Manifest persisted to disk.
    assert archive_links.load_manifest(manifest_path) == manifest


def test_run_archive_skips_failed_archive(
    tmp_path: Path, content_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    manifest_path = tmp_path / "manifest.json"

    def fail_archive(canonical, *_a, **_k):
        raise archive_links.LowQualitySnapshotError("too small")

    monkeypatch.setattr(archive_links, "archive_and_upload", fail_archive)
    monkeypatch.setattr(archive_links, "probe_status", lambda url, session: 200)

    manifest = archive_links.run_archive(
        content_dir=content_dir,
        manifest_path=manifest_path,
        denylist_path=tmp_path / "missing-deny.json",
        data_dir=tmp_path / "abox",
        static_dir=tmp_path / "static",
        session=MagicMock(),
    )

    # Failed archive → URL not added to the manifest.
    assert "https://new.example.com/page" not in manifest


def test_run_archive_backfill_refreshes_existing(
    tmp_path: Path, content_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    manifest_path = tmp_path / "manifest.json"
    archive_links.save_manifest(
        manifest_path,
        {
            "https://done.example.com/page": {
                **archive_links._new_entry(),
                "archive_url": "https://cdn/old.html",
            }
        },
    )

    monkeypatch.setattr(
        archive_links,
        "archive_and_upload",
        lambda *a, **k: "https://cdn/fresh.html",
    )
    monkeypatch.setattr(archive_links, "probe_status", lambda url, session: 200)

    manifest = archive_links.run_archive(
        content_dir=content_dir,
        manifest_path=manifest_path,
        denylist_path=tmp_path / "deny.json",
        data_dir=tmp_path / "abox",
        static_dir=tmp_path / "static",
        session=MagicMock(),
        refresh=True,
    )

    # refresh=True re-archives the already-archived URL.
    assert (
        manifest["https://done.example.com/page"]["archive_url"]
        == "https://cdn/fresh.html"
    )


def test_run_archive_backfill_skips_already_archived(
    tmp_path: Path, content_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    manifest_path = tmp_path / "manifest.json"
    archive_links.save_manifest(
        manifest_path,
        {
            "https://done.example.com/page": {
                **archive_links._new_entry(),
                "archive_url": "https://cdn/keep.html",
            }
        },
    )

    archived: list[str] = []

    def fake_archive(canonical, *_a, **_k):
        archived.append(canonical)
        return "https://cdn/new.html"

    monkeypatch.setattr(archive_links, "archive_and_upload", fake_archive)
    monkeypatch.setattr(archive_links, "probe_status", lambda url, session: 200)

    manifest = archive_links.run_archive(
        content_dir=content_dir,
        manifest_path=manifest_path,
        denylist_path=tmp_path / "deny.json",
        data_dir=tmp_path / "abox",
        static_dir=tmp_path / "static",
        session=MagicMock(),
        backfill=True,
    )

    # backfill considers every URL, but the already-archived one is skipped
    # (refresh is False) and keeps its existing archive_url.
    assert "https://done.example.com/page" not in archived
    assert (
        manifest["https://done.example.com/page"]["archive_url"]
        == "https://cdn/keep.html"
    )


# --- main / CLI --------------------------------------------------------------


def test_main_merge_mode(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    frag_a = tmp_path / "a.json"
    frag_b = tmp_path / "b.json"
    frag_a.write_text(
        json.dumps({"https://a.com": {"last_checked": "2026-01-01T00:00:00Z"}}),
        encoding="utf-8",
    )
    frag_b.write_text(
        json.dumps({"https://b.com": {"last_checked": "2026-01-02T00:00:00Z"}}),
        encoding="utf-8",
    )
    manifest_path = tmp_path / "manifest.json"

    archive_links.main(
        ["--merge", str(frag_a), str(frag_b), "--manifest", str(manifest_path)]
    )

    merged = archive_links.load_manifest(manifest_path)
    assert set(merged.keys()) == {"https://a.com", "https://b.com"}


def test_main_run_mode_uses_defaults(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    git_root = tmp_path / "repo"
    (git_root / "config").mkdir(parents=True)
    (git_root / "website_content").mkdir(parents=True)
    (git_root / "website_content" / "p.md").write_text(
        "[x](https://new.example.com/page)", encoding="utf-8"
    )

    monkeypatch.setattr(
        archive_links.script_utils, "get_git_root", lambda: git_root
    )
    monkeypatch.setattr(
        archive_links.script_utils, "http_session", lambda: MagicMock()
    )
    monkeypatch.setattr(
        archive_links,
        "archive_and_upload",
        lambda *a, **k: "https://cdn/x.html",
    )
    monkeypatch.setattr(archive_links, "probe_status", lambda url, session: 200)

    archive_links.main([])

    manifest = archive_links.load_manifest(
        git_root / "config" / "link_archive_manifest.json"
    )
    assert (
        manifest["https://new.example.com/page"]["archive_url"]
        == "https://cdn/x.html"
    )
