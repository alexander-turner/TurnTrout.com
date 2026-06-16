"""Tests for scripts/archive_links.py."""

import http.server
import json
import os
import shutil
import socketserver
import subprocess
import threading
from collections.abc import Iterator
from pathlib import Path
from unittest.mock import MagicMock

import pytest
import requests

from .. import archive_links

# --- canonicalize_url (mirrors archiveLinks.test.ts fixtures) ----------------


# These cases are mirrored verbatim in archiveLinks.test.ts; both
# implementations must produce identical output for every row.
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
        # WHATWG normalization (identical on both sides — it's the same parser):
        ("http://example.com:80/a", "https://example.com/a"),
        ("https://example.com:443/a", "https://example.com/a"),
        ("https://example.com/a b", "https://example.com/a%20b"),
        ("https://example.com/café", "https://example.com/caf%C3%A9"),
        ("https://exämple.com/a", "https://xn--exmple-cua.com/a"),
        (
            "https://en.wikipedia.org/wiki/Foo_(bar)",
            "https://en.wikipedia.org/wiki/Foo_(bar)",
        ),
        ("https://example.com/a;p=1", "https://example.com/a;p=1"),
        ("https://example.com/a?", "https://example.com/a"),
    ],
)
def test_canonicalize_url(url: str, expected: str) -> None:
    assert archive_links.canonicalize_url(url) == expected


def test_canonicalize_url_raises_on_unparseable() -> None:
    with pytest.raises(ValueError):
        archive_links.canonicalize_url("not a url")


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


def test_find_external_links_balances_parens(tmp_path: Path) -> None:
    md = tmp_path / "page.md"
    # The closing ``)`` of a Markdown link is dropped, but a balanced ``)``
    # inside the URL (Wikipedia-style) is kept — matching the rendered href the
    # TS side canonicalizes.
    md.write_text(
        "[wiki](https://en.wikipedia.org/wiki/Foo_(bar)) and a bare "
        "https://en.wikipedia.org/wiki/Baz_(qux).",
        encoding="utf-8",
    )
    assert archive_links.find_external_links([md]) == {
        "https://en.wikipedia.org/wiki/Foo_(bar)",
        "https://en.wikipedia.org/wiki/Baz_(qux)",
    }


def test_find_external_links_skips_unparseable(tmp_path: Path) -> None:
    md = tmp_path / "page.md"
    # A token that the URL regex captures but the WHATWG parser rejects (an
    # unterminated IPv6 host) must be skipped, not raise.
    md.write_text("broken https://[bad link", encoding="utf-8")
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
def test_update_dead_state_transient_breaks_streak(status: int) -> None:
    # A transient probe resets the consecutive-404 streak but does not mark a
    # still-suspected link dead.
    entry = {**archive_links._new_entry(), "dead_strikes": 1, "dead": False}
    updated = archive_links.update_dead_state(entry, status)
    assert updated["dead_strikes"] == 0
    assert updated["dead"] is False
    assert updated["last_status"] == status


def test_update_dead_state_interleaved_transient_never_dies() -> None:
    # 404 -> 500 -> 404 is NOT two consecutive strikes, so the link must stay
    # alive: a flaky 404 can never drive the destructive rewrite.
    entry = archive_links._new_entry()
    entry = archive_links.update_dead_state(entry, 404)
    entry = archive_links.update_dead_state(entry, 500)
    entry = archive_links.update_dead_state(entry, 404)
    assert entry["dead_strikes"] == 1
    assert entry["dead"] is False


def test_update_dead_state_transient_keeps_confirmed_dead() -> None:
    # Once confirmed dead, a transient probe must not revert the verdict (only a
    # real 2xx/3xx recovery does).
    entry = {**archive_links._new_entry(), "dead_strikes": 2, "dead": True}
    updated = archive_links.update_dead_state(entry, 503)
    assert updated["dead"] is True
    assert updated["dead_strikes"] == 0


def test_update_dead_state_dead_status_keeps_confirmed_dead() -> None:
    # A confirmed-dead link whose streak was reset stays dead on a fresh 404
    # even though the new strike count is below the threshold.
    entry = {**archive_links._new_entry(), "dead_strikes": 0, "dead": True}
    updated = archive_links.update_dead_state(entry, 404)
    assert updated["dead_strikes"] == 1
    assert updated["dead"] is True


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

    def fake_add(urls, _data_dir, _extractors):
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
    with pytest.raises(
        archive_links.SnapshotFailedError, match="no singlefile.html"
    ):
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


def test_run_archive_propagates_infra_failure(
    tmp_path: Path, content_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # An R2/infra RuntimeError must fail the job loudly, not be swallowed as a
    # per-URL skip (otherwise the run "archives nothing" but looks successful).
    def infra_failure(canonical, *_a, **_k):
        raise RuntimeError("Failed to upload snapshot to R2")

    monkeypatch.setattr(archive_links, "archive_and_upload", infra_failure)
    monkeypatch.setattr(archive_links, "probe_status", lambda url, session: 200)

    with pytest.raises(RuntimeError, match="Failed to upload"):
        archive_links.run_archive(
            content_dir=content_dir,
            manifest_path=tmp_path / "manifest.json",
            denylist_path=tmp_path / "deny.json",
            data_dir=tmp_path / "abox",
            static_dir=tmp_path / "static",
            session=MagicMock(),
        )


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


# --- Real ArchiveBox integration ---------------------------------------------
#
# The unit tests above mock `_run_archivebox_add`, so they prove the
# orchestration but NOT that a real `archivebox add` writes `singlefile.html`
# where `archive_one` looks. This test closes that gap by capturing a
# locally-served fixture page for real.
#
# Requirements (provided by the dedicated CI job, mirrored locally):
#   - `archivebox`, `single-file` (single-file-cli) and a Chromium on PATH.
#   - The Chromium must report a "Chromium <version>" version string.
#     ArchiveBox 0.7.x parses the major version out of `chrome --version`; the
#     "Google Chrome for Testing" build (Playwright's default) reports a string
#     ArchiveBox truncates to "Google Chrome for", which makes the singlefile
#     extractor crash and silently produce no snapshot.
#
# Skipped wherever archivebox is absent (e.g. the default `python-tests` job),
# so it only executes in the dedicated archivebox job or a local run.

# Large enough that single-file's inlined output clears MIN_SNAPSHOT_BYTES.
_FIXTURE_BODY: str = "<p>" + ("Lorem ipsum dolor sit amet. " * 80) + "</p>"
_FIXTURE_HTML: str = (
    "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
    "<title>Archive integration fixture</title></head><body>"
    "<h1>Archive integration fixture</h1>"
    + _FIXTURE_BODY * 6
    + "</body></html>"
)


@pytest.fixture()
def fixture_server() -> Iterator[str]:
    """Serve a single sizable HTML page on an ephemeral localhost port."""

    class _Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 - http.server API
            body = _FIXTURE_HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_args: object) -> None:
            """Silence the default stderr request logging."""

    with socketserver.TCPServer(("127.0.0.1", 0), _Handler) as httpd:
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{port}/page.html"
        finally:
            httpd.shutdown()


@pytest.mark.requires_archivebox
@pytest.mark.allow_git_operations
def test_archive_one_produces_real_singlefile(
    tmp_path: Path, fixture_server: str
) -> None:
    """`archive_one` captures a live page into a usable `singlefile.html`."""
    archivebox = shutil.which("archivebox")
    if archivebox is None:
        pytest.skip("archivebox is not installed")

    data_dir = tmp_path / "archivebox"
    data_dir.mkdir()
    subprocess.run(
        [archivebox, "init"], cwd=str(data_dir), check=True, env=os.environ
    )

    # `archive_one` archives whatever URL it is given; pass the reachable http
    # fixture directly (canonicalization would force https, which the fixture
    # server does not speak).
    snapshot = archive_links.archive_one(fixture_server, data_dir)

    assert snapshot.name == archive_links.SNAPSHOT_FILENAME
    assert snapshot.is_file()
    raw = snapshot.read_bytes()
    assert not archive_links.is_low_quality(raw), (
        f"snapshot is only {len(raw)} bytes; capture likely failed"
    )
    html = archive_links.inject_noindex(raw.decode("utf-8", errors="replace"))
    assert archive_links._NOINDEX_META in html
