"""Tests for scripts/archive_links.py."""

import base64
import http.server
import json
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


def test_probe_status_error_with_resolvable_host_is_transient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # A connection error to a host that still resolves (refused/reset/TLS) is
    # transient, not dead.
    session = MagicMock()
    session.get.side_effect = requests.ConnectionError("refused")
    monkeypatch.setattr(archive_links, "_host_resolves", lambda url: True)
    assert archive_links.probe_status("https://example.com", session) == 0


def test_probe_status_nxdomain_when_host_stops_resolving(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = MagicMock()
    session.get.side_effect = requests.ConnectionError("no route")
    monkeypatch.setattr(archive_links, "_host_resolves", lambda url: False)
    assert (
        archive_links.probe_status("https://gone.example.com", session)
        == archive_links.NXDOMAIN_STATUS
    )


def test_probe_status_transient_dns_is_not_nxdomain(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # An indeterminate resolver result (EAI_AGAIN) must read as transient, not
    # a dead domain.
    session = MagicMock()
    session.get.side_effect = requests.ConnectionError("temporary failure")
    monkeypatch.setattr(archive_links, "_host_resolves", lambda url: None)
    assert archive_links.probe_status("https://blip.example.com", session) == 0


def test_host_resolves_true_for_resolvable_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(archive_links.socket, "getaddrinfo", lambda *a: [()])
    assert archive_links._host_resolves("https://example.com/x") is True


def test_host_resolves_false_on_nxdomain(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    errno = next(iter(archive_links._NXDOMAIN_ERRNOS))

    def boom(*_a):
        raise archive_links.socket.gaierror(errno, "Name or service not known")

    monkeypatch.setattr(archive_links.socket, "getaddrinfo", boom)
    assert archive_links._host_resolves("https://gone.example.com/x") is False


def test_host_resolves_none_on_transient_dns(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def boom(*_a):
        raise archive_links.socket.gaierror(
            getattr(archive_links.socket, "EAI_AGAIN", -3), "try again"
        )

    monkeypatch.setattr(archive_links.socket, "getaddrinfo", boom)
    assert archive_links._host_resolves("https://blip.example.com/x") is None


def test_host_resolves_none_on_oserror(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def boom(*_a):
        raise OSError("resolver unavailable")

    monkeypatch.setattr(archive_links.socket, "getaddrinfo", boom)
    assert archive_links._host_resolves("https://example.com/x") is None


def test_host_resolves_none_without_hostname() -> None:
    assert archive_links._host_resolves("not-a-url") is None


def test_now_iso_format() -> None:
    stamp = archive_links._now_iso()
    assert stamp.endswith("Z")
    assert "T" in stamp


def test_probe_session_uses_browser_user_agent() -> None:
    # The default python-requests UA draws bot-shaped 404s from some anti-bot
    # setups, which would defeat the consecutive-strike gate.
    session = archive_links.probe_session()
    assert session.headers["User-Agent"] == archive_links.PROBE_USER_AGENT
    assert "Mozilla" in archive_links.PROBE_USER_AGENT


def test_probe_all_returns_status_per_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    statuses = {"https://a.com": 200, "https://b.com": 404}
    monkeypatch.setattr(
        archive_links,
        "probe_status",
        lambda url, session: statuses[url],
    )
    result = archive_links.probe_all(statuses.keys(), MagicMock(), workers=2)
    assert result == statuses


def test_update_dead_state_dead_strikes_then_flip() -> None:
    entry = archive_links._new_entry()
    state = archive_links._new_probe_state()
    entry, state = archive_links.update_dead_state(entry, state, 404)
    assert state["dead_strikes"] == 1
    assert entry["dead"] is False
    assert state["last_status"] == 404

    entry, state = archive_links.update_dead_state(entry, state, 410)
    assert state["dead_strikes"] == 2
    assert entry["dead"] is True


def test_update_dead_state_nxdomain_flips_like_a_hard_status() -> None:
    # A host that stops resolving for two consecutive runs is as dead as a 410.
    entry = archive_links._new_entry()
    state = archive_links._new_probe_state()
    entry, state = archive_links.update_dead_state(
        entry, state, archive_links.NXDOMAIN_STATUS
    )
    assert state["dead_strikes"] == 1
    assert entry["dead"] is False

    entry, state = archive_links.update_dead_state(
        entry, state, archive_links.NXDOMAIN_STATUS
    )
    assert state["dead_strikes"] == 2
    assert entry["dead"] is True


def test_update_dead_state_alive_resets() -> None:
    entry = {**archive_links._new_entry(), "dead": True}
    state = {**archive_links._new_probe_state(), "dead_strikes": 5}
    entry, state = archive_links.update_dead_state(entry, state, 200)
    assert state["dead_strikes"] == 0
    assert entry["dead"] is False


@pytest.mark.parametrize("status", [403, 429, 500, 0])
def test_update_dead_state_transient_breaks_streak(status: int) -> None:
    # A transient probe resets the consecutive-404 streak but does not mark a
    # still-suspected link dead.
    entry = archive_links._new_entry()
    state = {**archive_links._new_probe_state(), "dead_strikes": 1}
    entry, state = archive_links.update_dead_state(entry, state, status)
    assert state["dead_strikes"] == 0
    assert entry["dead"] is False
    assert state["last_status"] == status


def test_update_dead_state_interleaved_transient_never_dies() -> None:
    # 404 -> 500 -> 404 is NOT two consecutive strikes, so the link must stay
    # alive: a flaky 404 can never drive the destructive rewrite.
    entry = archive_links._new_entry()
    state = archive_links._new_probe_state()
    for status in (404, 500, 404):
        entry, state = archive_links.update_dead_state(entry, state, status)
    assert state["dead_strikes"] == 1
    assert entry["dead"] is False


def test_update_dead_state_transient_keeps_confirmed_dead() -> None:
    # Once confirmed dead, a transient probe must not revert the verdict (only a
    # real 2xx/3xx recovery does).
    entry = {**archive_links._new_entry(), "dead": True}
    state = {**archive_links._new_probe_state(), "dead_strikes": 2}
    entry, state = archive_links.update_dead_state(entry, state, 503)
    assert entry["dead"] is True
    assert state["dead_strikes"] == 0


def test_update_dead_state_dead_status_keeps_confirmed_dead() -> None:
    # A confirmed-dead link whose streak was reset stays dead on a fresh 404
    # even though the new strike count is below the threshold.
    entry = {**archive_links._new_entry(), "dead": True}
    state = archive_links._new_probe_state()
    entry, state = archive_links.update_dead_state(entry, state, 404)
    assert state["dead_strikes"] == 1
    assert entry["dead"] is True


# --- capture_page (single-file) ------------------------------------------------


def test_find_browser_prefers_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CHROME_BINARY", "/opt/custom/chrome")
    assert archive_links._find_browser() == "/opt/custom/chrome"


def test_find_browser_searches_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CHROME_BINARY", raising=False)
    monkeypatch.setattr(
        archive_links.shutil,
        "which",
        lambda name: "/usr/bin/chromium" if name == "chromium" else None,
    )
    assert archive_links._find_browser() == "/usr/bin/chromium"


def test_find_browser_falls_back_to_macos_bundles(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # macOS app bundles are not on PATH; the standard locations are searched.
    monkeypatch.delenv("CHROME_BINARY", raising=False)
    monkeypatch.setattr(archive_links.shutil, "which", lambda name: None)
    bundle_binary = tmp_path / "Google Chrome"
    bundle_binary.write_text("", encoding="utf-8")
    monkeypatch.setattr(
        archive_links, "_MACOS_BROWSER_PATHS", (str(bundle_binary),)
    )
    assert archive_links._find_browser() == str(bundle_binary)


def test_find_browser_missing_is_infra_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CHROME_BINARY", raising=False)
    monkeypatch.setattr(archive_links.shutil, "which", lambda name: None)
    monkeypatch.setattr(archive_links, "_MACOS_BROWSER_PATHS", ())
    with pytest.raises(RuntimeError, match="CHROME_BINARY"):
        archive_links._find_browser()


@pytest.fixture()
def _capture_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CHROME_BINARY", "/opt/chrome")
    monkeypatch.setattr(
        archive_links.script_utils,
        "find_executable",
        lambda name: f"/usr/bin/{name}",
    )


def test_capture_page_success(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, _capture_env: None
) -> None:
    dest = tmp_path / "out" / archive_links.SNAPSHOT_FILENAME
    captured: dict = {}

    def fake_run(command, check, timeout, capture_output):
        captured["command"] = command
        assert check is True and capture_output is True
        assert timeout == archive_links.CAPTURE_TIMEOUT
        dest.write_bytes(b"<html><!-- Page saved with SingleFile --></html>")
        return _silent_success(stderr=b"")

    monkeypatch.setattr(archive_links.subprocess, "run", fake_run)
    archive_links.capture_page("https://example.com/a", dest)

    assert captured["command"][0] == "/usr/bin/single-file"
    assert "--browser-executable-path=/opt/chrome" in captured["command"]
    assert '--browser-args=["--no-sandbox"]' in captured["command"]
    assert captured["command"][-2:] == ["https://example.com/a", str(dest)]


def test_capture_page_raises_on_subprocess_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, _capture_env: None
) -> None:
    def fake_run(command, **_kwargs):
        raise subprocess.CalledProcessError(1, command)

    monkeypatch.setattr(archive_links.subprocess, "run", fake_run)
    with pytest.raises(
        archive_links.SnapshotFailedError, match="single-file failed"
    ):
        archive_links.capture_page(
            "https://example.com/a", tmp_path / "out.html"
        )


def test_capture_page_raises_on_timeout(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, _capture_env: None
) -> None:
    def fake_run(command, **_kwargs):
        raise subprocess.TimeoutExpired(command, 1)

    monkeypatch.setattr(archive_links.subprocess, "run", fake_run)
    with pytest.raises(archive_links.SnapshotFailedError, match="timed out"):
        archive_links.capture_page(
            "https://example.com/a", tmp_path / "out.html"
        )


def _silent_success(stderr: bytes = b"load timed out") -> MagicMock:
    result = MagicMock()
    result.stdout = b""
    result.stderr = stderr
    return result


def test_capture_page_raises_when_no_file_written(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, _capture_env: None
) -> None:
    # single-file can exit 0 without writing anything on some failures; the
    # error must surface what single-file reported on stdio.
    monkeypatch.setattr(
        archive_links.subprocess, "run", lambda *a, **k: _silent_success()
    )
    with pytest.raises(
        archive_links.SnapshotFailedError, match="produced no.*load timed out"
    ):
        archive_links.capture_page(
            "https://example.com/a", tmp_path / "out.html"
        )


def test_capture_page_retries_after_cold_start_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, _capture_env: None
) -> None:
    # A cold Chromium start can make single-file exit 0 with no output; one
    # retry must succeed without surfacing the first failure.
    dest = tmp_path / archive_links.SNAPSHOT_FILENAME
    calls: list[int] = []

    def flaky_run(*_args, **_kwargs):
        calls.append(1)
        if len(calls) > 1:
            dest.write_bytes(
                b"<html><!-- Page saved with SingleFile --></html>"
            )
        return _silent_success()

    monkeypatch.setattr(archive_links.subprocess, "run", flaky_run)
    archive_links.capture_page("https://example.com/a", dest)
    assert len(calls) == 2


def test_capture_page_rejects_unprocessed_save(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, _capture_env: None
) -> None:
    # single-file can exit 0 having written the page WITHOUT running its
    # capture pipeline (e.g. the browser failed to launch): the output looks
    # plausible but embeds no images/fonts/styles. The missing banner must
    # fail the capture loudly instead of publishing a hollow snapshot.
    dest = tmp_path / archive_links.SNAPSHOT_FILENAME

    def raw_dump_run(*_args, **_kwargs):
        dest.write_bytes(b"<html><body>raw fetched page</body></html>")
        return _silent_success(stderr=b"browser launch failed")

    monkeypatch.setattr(archive_links.subprocess, "run", raw_dump_run)
    with pytest.raises(
        archive_links.SnapshotFailedError,
        match="without processing.*browser launch failed",
    ):
        archive_links.capture_page("https://example.com/a", dest)


# --- Wayback fallback ----------------------------------------------------------


def _wayback_availability(available: bool, url: str = "") -> MagicMock:
    response = MagicMock()
    response.json.return_value = {
        "archived_snapshots": (
            {"closest": {"available": available, "url": url}}
            if available or url
            else {}
        )
    }
    return response


def test_fetch_wayback_snapshot_returns_original_bytes() -> None:
    session = MagicMock()
    page = MagicMock()
    page.content = b"<html>old copy</html>"
    session.get.side_effect = [
        _wayback_availability(
            True, "http://web.archive.org/web/20200101000000/https://a.com/x"
        ),
        page,
    ]

    raw = archive_links.fetch_wayback_snapshot("https://a.com/x", session)

    assert raw == b"<html>old copy</html>"
    # The raw-bytes ``id_`` modifier is inserted into the snapshot URL.
    fetched = session.get.call_args_list[1].args[0]
    assert "/web/20200101000000id_/" in fetched


def test_fetch_wayback_snapshot_none_when_unavailable() -> None:
    session = MagicMock()
    session.get.return_value = _wayback_availability(False)
    assert (
        archive_links.fetch_wayback_snapshot("https://a.com/x", session) is None
    )


def test_fetch_wayback_snapshot_none_on_request_error() -> None:
    session = MagicMock()
    session.get.side_effect = requests.ConnectionError("boom")
    assert (
        archive_links.fetch_wayback_snapshot("https://a.com/x", session) is None
    )


def test_fetch_wayback_snapshot_none_on_malformed_payload() -> None:
    session = MagicMock()
    response = MagicMock()
    response.json.side_effect = ValueError("not json")
    session.get.return_value = response
    assert (
        archive_links.fetch_wayback_snapshot("https://a.com/x", session) is None
    )


def test_archive_from_wayback_publishes_snapshot(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    static_dir = tmp_path / "quartz" / "static"
    monkeypatch.setattr(
        archive_links,
        "fetch_wayback_snapshot",
        lambda url, session: b"<html><head></head>" + b"x" * 5000 + b"</html>",
    )
    monkeypatch.setattr(
        archive_links, "sync_snapshot_to_r2", lambda path: "https://cdn/w.html"
    )

    canonical = "https://gone.example.com/page"
    result = archive_links.archive_from_wayback(
        canonical, static_dir, MagicMock()
    )

    assert result == "https://cdn/w.html"
    written = archive_links.snapshot_dest_path(static_dir, canonical)
    assert archive_links._NOINDEX_META in written.read_text(encoding="utf-8")


def test_archive_from_wayback_raises_without_snapshot(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        archive_links, "fetch_wayback_snapshot", lambda url, session: None
    )
    with pytest.raises(
        archive_links.SnapshotFailedError, match="No Wayback snapshot"
    ):
        archive_links.archive_from_wayback(
            "https://gone.example.com/page", tmp_path, MagicMock()
        )


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
    assert "content-type=text/html" in captured["cmd"]
    # R2's S3 API rejects arbitrary response headers ("Don't know how to set
    # key ... on upload"); noindex/CSP come from the Cloudflare transform rule,
    # verified by check_link_archive_integrity.py.
    assert "--header-upload" not in captured["cmd"]


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


def _fake_capture(body: bytes):
    """A capture_page stand-in that writes *body* to the requested dest."""

    def capture(url: str, dest: Path, timeout: int = 0) -> None:
        dest.write_bytes(body)

    return capture


def test_archive_and_upload_success(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    static_dir = tmp_path / "quartz" / "static"
    static_dir.mkdir(parents=True)
    body = b"<html><head></head><body>" + b"x" * 5000 + b"</body></html>"

    monkeypatch.setattr(archive_links, "capture_page", _fake_capture(body))
    monkeypatch.setattr(
        archive_links, "sync_snapshot_to_r2", lambda path: "https://cdn/x.html"
    )

    canonical = "https://example.com/a"
    result = archive_links.archive_and_upload(canonical, static_dir)
    assert result == "https://cdn/x.html"

    written = archive_links.snapshot_dest_path(static_dir, canonical)
    assert archive_links._NOINDEX_META in written.read_text(encoding="utf-8")


def test_archive_and_upload_rejects_low_quality(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    static_dir = tmp_path / "quartz" / "static"
    monkeypatch.setattr(archive_links, "capture_page", _fake_capture(b"tiny"))
    with pytest.raises(archive_links.LowQualitySnapshotError):
        archive_links.archive_and_upload("https://example.com/a", static_dir)


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


def _run(tmp_path: Path, content_dir: Path, **overrides) -> dict:
    """Call run_archive with test defaults, letting tests override any part."""
    kwargs = {
        "content_dir": content_dir,
        "manifest_path": tmp_path / "manifest.json",
        "denylist_path": tmp_path / "deny.json",
        "static_dir": tmp_path / "static",
        "probe_state_path": tmp_path / "probe_state.json",
        "session": MagicMock(),
        **overrides,
    }
    return archive_links.run_archive(**kwargs)


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
    monkeypatch.setattr(archive_links, "probe_status", lambda url, session: 200)

    manifest = _run(tmp_path, content_dir, denylist_path=denylist_path)

    # Only the new, non-denied, not-yet-archived URL was archived.
    assert archived == ["https://new.example.com/page"]
    assert (
        manifest["https://new.example.com/page"]["archive_url"]
        == "https://cdn/new.html"
    )
    # x.com was deny-listed → never archived nor added.
    assert "https://x.com/foo" not in manifest
    # The committed manifest holds only durable facts; probe telemetry goes to
    # the separate state file.
    assert set(manifest["https://new.example.com/page"]) == {
        "archive_url",
        "dead",
    }
    probe_state = archive_links.load_manifest(tmp_path / "probe_state.json")
    assert probe_state["https://new.example.com/page"]["last_status"] == 200
    assert probe_state["https://done.example.com/page"]["last_status"] == 200
    # Manifest persisted to disk.
    assert archive_links.load_manifest(manifest_path) == manifest


def test_run_archive_dead_at_discovery_uses_wayback(
    tmp_path: Path, content_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A link that is already hard-gone must NOT be captured live (that would
    # snapshot the error page); it goes straight to the Wayback fallback.
    def never_capture(*_a, **_k):
        raise AssertionError("live capture must not run for a dead link")

    monkeypatch.setattr(archive_links, "archive_and_upload", never_capture)
    monkeypatch.setattr(
        archive_links,
        "archive_from_wayback",
        lambda canonical, static_dir, session: "https://cdn/wayback.html",
    )
    monkeypatch.setattr(archive_links, "probe_status", lambda url, session: 404)

    manifest = _run(tmp_path, content_dir)

    assert (
        manifest["https://new.example.com/page"]["archive_url"]
        == "https://cdn/wayback.html"
    )


def test_run_archive_nxdomain_routes_to_wayback(
    tmp_path: Path, content_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A host that no longer resolves can't be captured live either; route it to
    # Wayback like any other hard-gone link.
    def never_capture(*_a, **_k):
        raise AssertionError(
            "live capture must not run for a non-resolving host"
        )

    monkeypatch.setattr(archive_links, "archive_and_upload", never_capture)
    monkeypatch.setattr(
        archive_links,
        "archive_from_wayback",
        lambda canonical, static_dir, session: "https://cdn/wayback.html",
    )
    monkeypatch.setattr(
        archive_links,
        "probe_status",
        lambda url, session: archive_links.NXDOMAIN_STATUS,
    )

    manifest = _run(tmp_path, content_dir)

    assert (
        manifest["https://new.example.com/page"]["archive_url"]
        == "https://cdn/wayback.html"
    )


def test_run_archive_capture_failure_falls_back_to_wayback(
    tmp_path: Path,
    content_dir: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    def fail_capture(*_a, **_k):
        raise archive_links.SnapshotFailedError("blocked the crawler")

    monkeypatch.setattr(archive_links, "archive_and_upload", fail_capture)
    monkeypatch.setattr(
        archive_links,
        "archive_from_wayback",
        lambda canonical, static_dir, session: "https://cdn/wayback.html",
    )
    monkeypatch.setattr(archive_links, "probe_status", lambda url, session: 200)

    manifest = _run(tmp_path, content_dir)

    assert (
        manifest["https://new.example.com/page"]["archive_url"]
        == "https://cdn/wayback.html"
    )
    # The live-capture reason is surfaced, not swallowed by the Wayback result.
    err = capsys.readouterr().err
    assert "Live capture failed" in err
    assert "blocked the crawler" in err


def test_run_archive_skips_when_capture_and_wayback_fail(
    tmp_path: Path, content_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail_capture(*_a, **_k):
        raise archive_links.LowQualitySnapshotError("too small")

    def fail_wayback(*_a, **_k):
        raise archive_links.SnapshotFailedError("no wayback copy")

    monkeypatch.setattr(archive_links, "archive_and_upload", fail_capture)
    monkeypatch.setattr(archive_links, "archive_from_wayback", fail_wayback)
    monkeypatch.setattr(archive_links, "probe_status", lambda url, session: 200)

    manifest = _run(
        tmp_path,
        content_dir,
        denylist_path=tmp_path / "missing-deny.json",
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
        _run(tmp_path, content_dir)


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

    manifest = _run(tmp_path, content_dir, refresh=True)

    # refresh=True re-archives the already-archived URL.
    assert (
        manifest["https://done.example.com/page"]["archive_url"]
        == "https://cdn/fresh.html"
    )


def test_run_archive_refresh_never_clobbers_snapshot_of_dead_page(
    tmp_path: Path, content_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The existing snapshot predates the rot; re-capturing (or a Wayback fetch)
    # could only replace it with something worse.
    manifest_path = tmp_path / "manifest.json"
    archive_links.save_manifest(
        manifest_path,
        {
            "https://done.example.com/page": {
                **archive_links._new_entry(),
                "archive_url": "https://cdn/good-old.html",
            }
        },
    )

    touched: list[str] = []

    def record(canonical, *_a, **_k):
        touched.append(canonical)
        return "https://cdn/replacement.html"

    monkeypatch.setattr(archive_links, "archive_and_upload", record)
    monkeypatch.setattr(archive_links, "archive_from_wayback", record)
    monkeypatch.setattr(archive_links, "probe_status", lambda url, session: 404)

    manifest = _run(tmp_path, content_dir, refresh=True)

    assert "https://done.example.com/page" not in touched
    assert (
        manifest["https://done.example.com/page"]["archive_url"]
        == "https://cdn/good-old.html"
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

    manifest = _run(tmp_path, content_dir, backfill=True)

    # backfill considers every URL, but the already-archived one is skipped
    # (refresh is False) and keeps its existing archive_url.
    assert "https://done.example.com/page" not in archived
    assert (
        manifest["https://done.example.com/page"]["archive_url"]
        == "https://cdn/keep.html"
    )


def test_run_archive_strikes_persist_across_runs(
    tmp_path: Path, content_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The strike counter lives in the probe-state file, so two consecutive
    # weekly runs of 404s flip the link dead.
    monkeypatch.setattr(
        archive_links, "archive_and_upload", lambda *a, **k: "https://cdn/x"
    )
    monkeypatch.setattr(
        archive_links,
        "archive_from_wayback",
        lambda *a, **k: "https://cdn/wayback.html",
    )
    monkeypatch.setattr(archive_links, "probe_status", lambda url, session: 404)

    first = _run(tmp_path, content_dir)
    assert first["https://new.example.com/page"]["dead"] is False

    second = _run(tmp_path, content_dir)
    assert second["https://new.example.com/page"]["dead"] is True


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
    # Probe telemetry defaults to an uncommitted file at the repo root.
    probe_state = archive_links.load_manifest(
        git_root / ".archive_probe_state.json"
    )
    assert probe_state["https://new.example.com/page"]["last_status"] == 200


# --- Real single-file integration ----------------------------------------------
#
# The unit tests above mock `capture_page`'s subprocess, so they prove the
# orchestration but NOT that a real `single-file` run writes a usable
# `singlefile.html`. This test closes that gap by capturing a locally-served
# fixture page for real.
#
# Requirements (provided by the dedicated CI job, mirrored locally):
# `single-file` (single-file-cli) on PATH and a Chromium (CHROME_BINARY or
# auto-detected). Skipped wherever they are absent (e.g. the default
# `python-tests` job), so it only executes in the dedicated job or a local run.

# Large enough that single-file's inlined output clears MIN_SNAPSHOT_BYTES.
_FIXTURE_BODY: str = "<p>" + ("Lorem ipsum dolor sit amet. " * 80) + "</p>"
# The <img> proves resource embedding: the capture must turn it into a data:
# URI, or the snapshot's images die with the origin.
_FIXTURE_HTML: str = (
    "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
    "<title>Archive integration fixture</title></head><body>"
    "<h1>Archive integration fixture</h1>"
    "<img src='/img.png' alt='embedded fixture image'>"
    + _FIXTURE_BODY * 6
    + "</body></html>"
)
# A 1x1 PNG.
_FIXTURE_PNG: bytes = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
    "z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


@pytest.fixture()
def fixture_server() -> Iterator[str]:
    """Serve a sizable HTML page + an image on an ephemeral localhost port."""

    class _Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 - http.server API
            if self.path.endswith(".png"):
                body = _FIXTURE_PNG
                content_type = "image/png"
            else:
                body = _FIXTURE_HTML.encode("utf-8")
                content_type = "text/html; charset=utf-8"
            self.send_response(200)
            self.send_header("Content-Type", content_type)
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


@pytest.mark.requires_singlefile
def test_capture_page_produces_real_singlefile(
    tmp_path: Path, fixture_server: str
) -> None:
    """`capture_page` captures a live page into a usable `singlefile.html`."""
    if shutil.which("single-file") is None:
        pytest.skip("single-file is not installed")
    try:
        archive_links._find_browser()
    except RuntimeError:
        pytest.skip("no Chromium/Chrome available")

    # `capture_page` archives whatever URL it is given; pass the reachable http
    # fixture directly (canonicalization would force https, which the fixture
    # server does not speak).
    dest = tmp_path / archive_links.SNAPSHOT_FILENAME
    archive_links.capture_page(fixture_server, dest)

    raw = dest.read_bytes()
    assert not archive_links.is_low_quality(raw), (
        f"snapshot is only {len(raw)} bytes; capture likely failed"
    )
    html = archive_links.inject_noindex(raw.decode("utf-8", errors="replace"))
    assert archive_links._NOINDEX_META in html
    assert archive_links.SINGLEFILE_BANNER in html
    # The fixture image must be embedded, not left as a URL that dies with
    # the origin.
    assert "data:image/png" in html
