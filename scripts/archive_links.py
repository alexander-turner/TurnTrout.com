"""
Archive outbound external links and flag dead ones for build-time fallback.

This is the Python half of the link-archiving system (the TypeScript half is
``quartz/plugins/transformers/archiveLinks.ts``). It:

  1. Scans ``website_content/`` for outbound ``http(s)`` links (excluding the
     author's own domains and the asset CDN).
  2. Probes every discovered link's liveness (browser-like User-Agent,
     parallel), then archives links that need a snapshot: live links are
     captured with ``single-file`` (a headless-Chromium page inliner); links
     that are already hard-gone (404/410, or a host that no longer resolves) —
     or whose capture fails — fall back to the newest Wayback Machine snapshot,
     so the preserved copy predates the rot instead of memorializing it. Every
     snapshot gets a ``noindex`` meta
     and is synced to R2 under a stable
     ``static/link-archive/<sha256>/singlefile.html`` key.
  3. Records durable facts in ``config/link_archive_manifest.json``
     (``archive_url`` + ``dead`` — exactly what the build consumes) and
     per-probe telemetry (strike counts, last status/checked) in a separate
     probe-state file that is NOT committed, so the weekly manifest PR only
     appears when something real changed. A link is only marked ``dead`` on a
     hard-gone status (404/410, or a non-resolving host) confirmed on N>=2
     consecutive runs; transient or blocked statuses (403/429/5xx/timeouts,
     transient DNS failures) never flip ``dead``.

The build-time transformer rewrites a ``dead`` link's ``href`` to its archived
copy. The canonicalization rule here is mirrored exactly in
``archiveLinks.ts``; the two share fixture tests so the manifest key the writer
emits always matches the key the reader looks up.

Expected environment variables:
    - ACCESS_KEY_ID_TURNTROUT_MEDIA / SECRET_ACCESS_TURNTROUT_MEDIA /
      S3_ENDPOINT_ID_TURNTROUT_MEDIA (R2 sync)
    - CHROME_BINARY (optional; Chromium for single-file, auto-detected if
      unset)
"""

import argparse
import datetime
import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
from collections.abc import Iterable, Sequence
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlsplit

import requests
from ada_url import URL

try:
    from . import r2_upload
    from . import utils as script_utils
except ImportError:
    import r2_upload
    import utils as script_utils

# --- Configuration constants -------------------------------------------------

# Hard-gone HTTP statuses that can flip a link to ``dead``.
DEAD_STATUSES: frozenset[int] = frozenset({404, 410})
# Sentinel "status" for a host that does not resolve (authoritative NXDOMAIN).
# As final as a 410 — a domain that no longer exists is gone — so it counts
# toward ``dead`` through the same consecutive-strike gate. Distinct from ``0``
# (transient/blocked), which never does.
NXDOMAIN_STATUS: int = -2
# getaddrinfo errnos meaning "this host does not exist", as opposed to
# ``EAI_AGAIN`` ("temporary failure in name resolution"), which is transient.
_NXDOMAIN_ERRNOS: frozenset[int] = frozenset(
    errno
    for errno in (
        getattr(socket, "EAI_NONAME", None),
        getattr(socket, "EAI_NODATA", None),
    )
    if errno is not None
)
# Consecutive dead probes required before the destructive rewrite is allowed.
DEAD_STRIKE_THRESHOLD: int = 2
# Snapshots smaller than this are treated as login-walls / blank captures.
MIN_SNAPSHOT_BYTES: int = 2048
# Seconds to wait on a single liveness probe before recording it as blocked.
PROBE_TIMEOUT: int = 30
# Seconds a single single-file capture may take before it is skipped; a hung
# Chromium must not stall the whole weekly run.
CAPTURE_TIMEOUT: int = 180
# Concurrent liveness probes; entries are independent, so the only bound is
# politeness and the session's connection pool.
PROBE_WORKERS: int = 8
SNAPSHOT_FILENAME: str = "singlefile.html"

# Some anti-bot configurations return 404 (not 403) to non-browser agents;
# with the default ``python-requests/…`` UA that reads as consistently dead
# and would defeat the consecutive-strike gate. Probe as a browser.
PROBE_USER_AGENT: str = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

WAYBACK_AVAILABILITY_API: str = "https://archive.org/wayback/available"

# Author's own hosts never get archived (internal links + the asset CDN, which
# all sit under turntrout.com).
OWN_HOST_SUFFIX: str = "turntrout.com"

_NOINDEX_META: str = '<meta name="robots" content="noindex">'
_HEAD_OPEN_RE: re.Pattern[str] = re.compile(r"<head[^>]*>", re.IGNORECASE)
# Matches an http(s) URL up to whitespace or a delimiter that can't be part of a
# URL in Markdown/HTML (``]``, quotes, angle brackets, ``}``). ``)`` is allowed
# inside the match and balanced afterwards by :func:`_trim_url` so URLs like
# ``…/Foo_(bar)`` survive while the closing ``)`` of ``[text](url)`` is dropped.
_URL_RE: re.Pattern[str] = re.compile(r"https?://[^\s\]\"'<>}\\]+")
# Trailing punctuation that is almost always sentence/markup, not part of a URL.
_TRAILING_PUNCT: str = ".,;:!?"


class LowQualitySnapshotError(RuntimeError):
    """Raised when a snapshot is too small to be a real capture."""


class SnapshotFailedError(RuntimeError):
    """Raised when no usable snapshot could be produced for a single URL."""


# --- URL handling ------------------------------------------------------------


def canonicalize_url(url: str) -> str:
    """
    Return the canonical form of *url* used as the manifest key.

    Mirrors ``canonicalizeUrl`` in ``archiveLinks.ts`` exactly: both sides parse
    with the same WHATWG URL parser (``ada`` — Node's ``new URL`` and this
    ``ada-url`` binding share the identical C++ implementation), so the writer's
    key and the reader's lookup can never disagree. On top of WHATWG
    normalization (lowercased/punycoded host, default-port stripping,
    percent-encoding) we force ``https``, drop a single trailing ``/``, and drop
    the ``#fragment`` while keeping the query.

    Raises:
        ValueError: If *url* is not a parseable absolute URL.
    """
    parsed = URL(url)
    path = parsed.pathname
    if path.endswith("/"):
        path = path[:-1]
    return f"https://{parsed.host}{path}{parsed.search}"


def _url_host(url: str) -> str:
    """Return the host of *url* (lowercased, punycoded, no port or userinfo)."""
    return URL(url).hostname


def _host_matches(host: str, suffix: str) -> bool:
    """Whether *host* equals *suffix* or is a subdomain of it."""
    return host == suffix or host.endswith(f".{suffix}")


def _trim_url(raw: str) -> str:
    """Strip trailing sentence punctuation and unbalanced closing parens."""
    trimmed = raw.rstrip(_TRAILING_PUNCT)
    while trimmed.endswith(")") and trimmed.count("(") < trimmed.count(")"):
        trimmed = trimmed[:-1]
    return trimmed


def find_external_links(markdown_files: Iterable[Path]) -> set[str]:
    """
    Return the canonicalized set of outbound external links in *markdown_files*.

    Matches Markdown links, bare autolinks, and HTML ``href=`` targets. Links to
    the author's own domains (including the asset CDN) are excluded.
    """
    links: set[str] = set()
    for file in markdown_files:
        content = file.read_text(encoding="utf-8")
        for raw in _URL_RE.findall(content):
            cleaned = _trim_url(raw)
            try:
                canonical = canonicalize_url(cleaned)
            except ValueError:
                continue  # e.g. a bare ``https://`` with no host
            if _host_matches(_url_host(canonical), OWN_HOST_SUFFIX):
                continue
            links.add(canonical)
    return links


# --- Manifest + probe-state persistence ---------------------------------------
#
# The committed manifest holds only what the build consumes (``archive_url``,
# ``dead``); probe telemetry lives in a separate uncommitted file so the weekly
# manifest PR diff contains real changes, not timestamp churn — that diff is
# the human gate before an irreversible rewrite, and it must stay readable.


def _new_entry() -> dict:
    """Return a fresh manifest entry for a not-yet-archived URL."""
    return {"archive_url": "", "dead": False}


def _new_probe_state() -> dict:
    """Return fresh probe telemetry for a never-probed URL."""
    return {"dead_strikes": 0, "last_status": 0, "last_checked": ""}


def load_manifest(path: Path) -> dict:
    """Load a JSON dict from *path*, or ``{}`` if it does not exist."""
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_manifest(path: Path, manifest: dict) -> None:
    """Write *manifest* to *path* with sorted keys and a trailing newline."""
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(
        {key: manifest[key] for key in sorted(manifest)},
        indent=2,
        ensure_ascii=False,
    )
    path.write_text(f"{serialized}\n", encoding="utf-8")


def diff_new_urls(discovered: Iterable[str], manifest: dict) -> list[str]:
    """Return the sorted canonical URLs in *discovered* not yet in
    *manifest*."""
    return sorted(url for url in discovered if url not in manifest)


# --- Deny-list ---------------------------------------------------------------


def load_denylist(path: Path) -> frozenset[str]:
    """Load the lowercase set of deny-listed hosts from *path* (``{}`` if
    absent)."""
    if not path.exists():
        return frozenset()
    data = json.loads(path.read_text(encoding="utf-8"))
    return frozenset(host.lower() for host in data.get("hosts", []))


def is_denied(url: str, denied_hosts: frozenset[str]) -> bool:
    """Whether *url*'s host is on the deny-list (exact host or a subdomain)."""
    host = _url_host(url)
    return any(_host_matches(host, denied) for denied in denied_hosts)


# --- Snapshot keys -----------------------------------------------------------


def snapshot_key(canonical_url: str) -> str:
    """Return the stable sha256 hex prefix for *canonical_url*'s snapshot."""
    return hashlib.sha256(canonical_url.encode("utf-8")).hexdigest()


def snapshot_dest_path(static_dir: Path, canonical_url: str) -> Path:
    """Return the local path under ``quartz/static`` for *canonical_url*."""
    return (
        static_dir
        / "link-archive"
        / snapshot_key(canonical_url)
        / SNAPSHOT_FILENAME
    )


# --- Snapshot quality + noindex ----------------------------------------------


def is_low_quality(
    html_bytes: bytes, min_size: int = MIN_SNAPSHOT_BYTES
) -> bool:
    """Whether a snapshot is suspiciously small (login-wall / blank capture)."""
    return len(html_bytes) < min_size


def inject_noindex(html: str) -> str:
    """
    Insert a ``noindex`` robots meta into *html*, keeping mirrored third-party
    content out of search engines.

    Idempotent: returns *html* unchanged if the meta is already present.
    """
    if _NOINDEX_META in html:
        return html
    match = _HEAD_OPEN_RE.search(html)
    if match:
        return f"{html[: match.end()]}{_NOINDEX_META}{html[match.end() :]}"
    return f"{_NOINDEX_META}{html}"


# --- Liveness probing --------------------------------------------------------


def _now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return (
        datetime.datetime.now(datetime.UTC)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def probe_session() -> requests.Session:
    """Return a retrying session that probes with a browser-like User-Agent."""
    session = script_utils.http_session()
    session.headers["User-Agent"] = PROBE_USER_AGENT
    return session


def _host_resolves(url: str) -> bool | None:
    """
    Whether *url*'s host resolves in DNS.

    Returns ``False`` only on an authoritative "no such host" (NXDOMAIN);
    ``None`` when the answer is indeterminate (transient resolver failure, an
    unparseable host, etc.), so a temporary DNS hiccup is never mistaken for a
    dead domain.
    """
    host = urlsplit(url).hostname
    if not host:
        return None
    try:
        socket.getaddrinfo(host, None)
        return True
    except socket.gaierror as exc:
        if exc.errno in _NXDOMAIN_ERRNOS:
            return False
        return None
    except OSError:
        return None


def probe_status(url: str, session: requests.Session) -> int:
    """
    Return the final HTTP status of *url* after redirects.

    On a request failure, returns :data:`NXDOMAIN_STATUS` when the host no
    longer resolves (as final as a 410), or ``0`` for any other error. Both a
    ``0`` and any non-hard-gone status are treated as transient/blocked by
    :func:`update_dead_state`, never as ``dead``. Streams the response so the
    body is not downloaded.
    """
    try:
        response = session.get(
            url, timeout=PROBE_TIMEOUT, allow_redirects=True, stream=True
        )
        response.close()
        return response.status_code
    except requests.RequestException as exc:
        # A connection error may be the host ceasing to exist (NXDOMAIN) or a
        # transient network/TLS problem; only a definitive no-such-host counts
        # toward dead.
        if _host_resolves(url) is False:
            print(f"Probe for {url}: host does not resolve", file=sys.stderr)
            return NXDOMAIN_STATUS
        print(f"Probe failed for {url}: {exc}", file=sys.stderr)
        return 0


def probe_all(
    urls: Iterable[str],
    session: requests.Session,
    workers: int = PROBE_WORKERS,
) -> dict[str, int]:
    """Probe every URL concurrently; return ``{url: status}``."""
    ordered = sorted(urls)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        statuses = pool.map(lambda url: probe_status(url, session), ordered)
        return dict(zip(ordered, statuses, strict=True))


def _is_alive_status(status: int) -> bool:
    """Whether *status* indicates a reachable resource (2xx/3xx final)."""
    return 200 <= status < 400


def _is_dead_status(status: int) -> bool:
    """Whether *status* is hard-gone: a 404/410 or an NXDOMAIN host."""
    return status in DEAD_STATUSES or status == NXDOMAIN_STATUS


def update_dead_state(
    entry: dict, state: dict, status: int
) -> tuple[dict, dict]:
    """
    Return ``(entry, state)`` copies updated for a probe returning *status*.

    Death requires ``DEAD_STRIKE_THRESHOLD`` *consecutive* hard-gone probes, so
    a flaky 404 sandwiched between healthy/transient probes can never drive the
    destructive rewrite (the repo's zero-flakiness rule for irreversible
    actions):

    - 404/410 or NXDOMAIN: increment the strike count; flip ``dead`` once it
      reaches the threshold. A confirmed ``dead`` verdict never reverts to
      ``False`` here.
    - 2xx/3xx: the link recovered — reset strikes and clear ``dead``.
    - anything else (403/429/5xx/timeout=0): blocked/transient — record the
      status and reset the consecutive-strike streak, but keep a previously
      confirmed ``dead`` verdict until a real recovery.
    """
    updated_entry = dict(entry)
    updated_state = dict(state)
    updated_state["last_status"] = status
    updated_state["last_checked"] = _now_iso()
    if _is_dead_status(status):
        strikes = updated_state.get("dead_strikes", 0) + 1
        updated_state["dead_strikes"] = strikes
        if strikes >= DEAD_STRIKE_THRESHOLD:
            updated_entry["dead"] = True
    elif _is_alive_status(status):
        updated_state["dead_strikes"] = 0
        updated_entry["dead"] = False
    else:
        updated_state["dead_strikes"] = 0
    return updated_entry, updated_state


# --- Capture (single-file) + Wayback fallback ---------------------------------


def _find_browser() -> str:
    """
    Return the Chromium/Chrome binary for single-file.

    ``CHROME_BINARY`` wins when set; otherwise the usual names are searched on
    PATH. A missing browser is an infra failure (nothing could be captured), so
    it raises RuntimeError rather than the per-URL skip exceptions.
    """
    configured = os.environ.get("CHROME_BINARY")
    if configured:
        return configured
    for candidate in ("google-chrome", "chromium-browser", "chromium"):
        found = shutil.which(candidate)
        if found:
            return found
    raise RuntimeError(
        "No Chromium/Chrome binary found for single-file; set CHROME_BINARY"
    )


def _capture_once(
    command: Sequence[str], url: str, dest: Path, timeout: int
) -> None:
    """Run one single-file capture; raise SnapshotFailedError on any failure."""
    try:
        result = subprocess.run(
            command, check=True, timeout=timeout, capture_output=True
        )
    except subprocess.TimeoutExpired as exc:
        raise SnapshotFailedError(
            f"single-file timed out after {timeout}s for {url}"
        ) from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or b"").decode("utf-8", errors="replace")[-500:]
        raise SnapshotFailedError(
            f"single-file failed for {url}: {exc}: {stderr}"
        ) from exc
    if not dest.is_file():
        # single-file exits 0 on some failures, reporting them only on stdio.
        output = (result.stdout + result.stderr).decode(
            "utf-8", errors="replace"
        )[-500:]
        raise SnapshotFailedError(
            f"single-file produced no {SNAPSHOT_FILENAME} for {url}: {output}"
        )


def capture_page(
    url: str,
    dest: Path,
    timeout: int = CAPTURE_TIMEOUT,
    attempts: int = 2,
) -> None:
    """
    Capture *url* into *dest* as a self-contained HTML page via single-file.

    single-file inlines every asset, so *dest* renders standalone. The direct
    CLI gives a deterministic output path — no directory diffing. A cold
    Chromium start (first launch on a fresh runner/profile) can exceed
    single-file's internal page-load wait and fail with exit 0 and no output;
    the bounded retry absorbs that class without masking persistent failures.

    Raises:
        SnapshotFailedError: If every attempt errored, timed out, or produced
            no file.
    """
    single_file = script_utils.find_executable("single-file")
    browser = _find_browser()
    dest.parent.mkdir(parents=True, exist_ok=True)
    command = [
        single_file,
        f"--browser-executable-path={browser}",
        # CI containers run Chromium without a usable sandbox.
        '--browser-args=["--no-sandbox"]',
        url,
        str(dest),
    ]
    last_error = SnapshotFailedError(f"single-file never ran for {url}")
    for _ in range(attempts):
        try:
            _capture_once(command, url, dest, timeout)
        except SnapshotFailedError as exc:
            last_error = exc
            continue
        return
    raise last_error


def fetch_wayback_snapshot(url: str, session: requests.Session) -> bytes | None:
    """
    Return the newest Wayback Machine copy of *url*, or ``None`` if there is
    none.

    Uses the availability API to locate the closest snapshot, then downloads
    the raw original bytes (the ``id_`` modifier strips the Wayback toolbar and
    URL rewriting).
    """
    try:
        response = session.get(
            WAYBACK_AVAILABILITY_API,
            params={"url": url},
            timeout=PROBE_TIMEOUT,
        )
        response.raise_for_status()
        closest = (
            response.json().get("archived_snapshots", {}).get("closest", {})
        )
        if not closest.get("available"):
            return None
        raw_url = re.sub(
            r"/web/(\d+)/", r"/web/\1id_/", closest["url"], count=1
        )
        page = session.get(raw_url, timeout=CAPTURE_TIMEOUT)
        page.raise_for_status()
        return page.content
    except (requests.RequestException, ValueError, KeyError) as exc:
        print(f"Wayback lookup failed for {url}: {exc}", file=sys.stderr)
        return None


# --- R2 sync -------------------------------------------------------------------


def sync_snapshot_to_r2(snapshot_path: Path) -> str:
    """
    Upload *snapshot_path* to R2 with hardening headers; return its URL.

    Reuses the R2 plumbing in :mod:`r2_upload` for key derivation and bucket
    config. ``X-Robots-Tag: noindex`` keeps the mirrored copy out of search
    engines; ``Content-Security-Policy: sandbox`` neuters scripts and forms in
    the third-party HTML, which is served from the first-party CDN origin.
    """
    script_utils.check_r2_env()
    relative_path = script_utils.path_relative_to_quartz_parent(snapshot_path)
    r2_key = r2_upload.get_r2_key(relative_path)
    upload_target = f"r2:{r2_upload.R2_BUCKET_NAME}/{r2_key}"
    rclone = script_utils.find_executable("rclone")
    try:
        subprocess.run(
            [
                rclone,
                "copyto",
                str(snapshot_path),
                upload_target,
                "--header-upload",
                "X-Robots-Tag: noindex",
                "--header-upload",
                "Content-Security-Policy: sandbox",
                "--metadata-set",
                "content-type=text/html",
            ],
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"Failed to upload snapshot to R2: {exc}") from exc
    return f"{r2_upload.R2_BASE_URL}/{r2_key}"


def _finalize_snapshot(raw: bytes, canonical_url: str, static_dir: Path) -> str:
    """
    Quality-gate *raw*, inject ``noindex``, store under *static_dir*, sync to
    R2.

    Returns the public CDN URL of the uploaded snapshot.
    """
    if is_low_quality(raw):
        raise LowQualitySnapshotError(
            f"Snapshot for {canonical_url} is only {len(raw)} bytes"
        )
    html = inject_noindex(raw.decode("utf-8", errors="replace"))
    dest = snapshot_dest_path(static_dir, canonical_url)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(html, encoding="utf-8")
    return sync_snapshot_to_r2(dest)


def archive_and_upload(canonical_url: str, static_dir: Path) -> str:
    """
    Capture *canonical_url* live with single-file and publish the snapshot.

    Returns the public CDN URL of the uploaded snapshot.

    Raises:
        LowQualitySnapshotError: If the capture is too small to be real.
        SnapshotFailedError: If single-file produced no snapshot for the URL.
        RuntimeError: If the R2 upload failed (infra error — fails loud).
    """
    with tempfile.TemporaryDirectory() as tmp:
        capture = Path(tmp) / SNAPSHOT_FILENAME
        capture_page(canonical_url, capture)
        raw = capture.read_bytes()
    return _finalize_snapshot(raw, canonical_url, static_dir)


def archive_from_wayback(
    canonical_url: str, static_dir: Path, session: requests.Session
) -> str:
    """
    Publish the newest Wayback copy of *canonical_url* as its snapshot.

    Used when the live page is already hard-gone (a fresh capture would
    memorialize the error page) or when the live capture failed.

    Raises:
        SnapshotFailedError: If Wayback has no snapshot of the URL.
        LowQualitySnapshotError: If the Wayback copy is too small to be real.
    """
    raw = fetch_wayback_snapshot(canonical_url, session)
    if raw is None:
        raise SnapshotFailedError(
            f"No Wayback snapshot available for {canonical_url}"
        )
    return _finalize_snapshot(raw, canonical_url, static_dir)


# --- Orchestration -----------------------------------------------------------


def run_archive(  # pylint: disable=too-many-arguments,too-many-locals
    *,
    content_dir: Path,
    manifest_path: Path,
    denylist_path: Path,
    static_dir: Path,
    probe_state_path: Path,
    session: requests.Session,
    backfill: bool = False,
    refresh: bool = False,
) -> dict:
    """
    Discover outbound links, probe liveness, archive, save manifest + state.

    Probing happens FIRST so archiving can route on it: live links get a fresh
    single-file capture (a snapshot exists before the link rots); links that
    are already hard-gone go straight to the Wayback fallback rather than
    snapshotting their error page. Returns the updated manifest.
    """
    manifest = load_manifest(manifest_path)
    probe_state = load_manifest(probe_state_path)
    denylist = load_denylist(denylist_path)
    markdown_files = script_utils.get_files(
        content_dir, (".md",), use_git_ignore=False
    )
    discovered = find_external_links(markdown_files)

    if backfill or refresh:
        to_archive = sorted(discovered)
    else:
        to_archive = diff_new_urls(discovered, manifest)

    statuses = probe_all(discovered, session)

    for canonical in to_archive:
        if is_denied(canonical, denylist):
            print(f"Skipping deny-listed URL: {canonical}")
            continue
        status = statuses.get(canonical, 0)
        already_archived = bool(manifest.get(canonical, {}).get("archive_url"))
        if already_archived and (not refresh or _is_dead_status(status)):
            # An existing snapshot of a now-dead page is strictly better than
            # anything a re-capture could produce; never clobber it.
            continue
        try:
            if _is_dead_status(status):
                # A live capture of a 404 page — or of a host that no longer
                # resolves — would memorialize the rot; go to Wayback instead.
                archive_url = archive_from_wayback(
                    canonical, static_dir, session
                )
            else:
                try:
                    archive_url = archive_and_upload(canonical, static_dir)
                except (LowQualitySnapshotError, SnapshotFailedError):
                    archive_url = archive_from_wayback(
                        canonical, static_dir, session
                    )
        except (LowQualitySnapshotError, SnapshotFailedError) as exc:
            # Per-URL capture problems are expected (some sites block crawlers
            # and have no Wayback copy); skip them. Infra failures (e.g. R2
            # auth) raise other errors that propagate and fail the job loudly
            # rather than silently archiving nothing.
            print(f"Skipping {canonical}: {exc}", file=sys.stderr)
            continue
        entry = manifest.get(canonical, _new_entry())
        entry["archive_url"] = archive_url
        manifest[canonical] = entry

    for canonical in sorted(discovered):
        if canonical not in manifest:
            continue
        entry, state = update_dead_state(
            manifest[canonical],
            probe_state.get(canonical, _new_probe_state()),
            statuses[canonical],
        )
        manifest[canonical] = entry
        probe_state[canonical] = state

    save_manifest(manifest_path, manifest)
    save_manifest(probe_state_path, probe_state)
    return manifest


# --- CLI ---------------------------------------------------------------------


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--content-dir", type=Path, default=None, help="Markdown content dir"
    )
    parser.add_argument(
        "--manifest", type=Path, default=None, help="Manifest JSON path"
    )
    parser.add_argument(
        "--denylist", type=Path, default=None, help="Deny-list JSON path"
    )
    parser.add_argument(
        "--static-dir", type=Path, default=None, help="quartz/static dir"
    )
    parser.add_argument(
        "--probe-state",
        type=Path,
        default=None,
        help="Probe-state JSON path (uncommitted liveness telemetry)",
    )
    parser.add_argument(
        "--backfill",
        action="store_true",
        help="Archive every discovered link (first full pass; run locally)",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Re-archive links even if already archived",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    """Entry point for ``scripts/archive_links.py``."""
    args = _parse_args(argv)
    git_root = script_utils.get_git_root()

    manifest_path = args.manifest or (
        git_root / "config" / "link_archive_manifest.json"
    )
    content_dir = args.content_dir or (git_root / script_utils.CONTENT_DIR_NAME)
    denylist_path = args.denylist or (
        git_root / "config" / "link_archive_denylist.json"
    )
    static_dir = args.static_dir or (git_root / "quartz" / "static")
    probe_state_path = args.probe_state or (
        git_root / ".archive_probe_state.json"
    )

    run_archive(
        content_dir=content_dir,
        manifest_path=manifest_path,
        denylist_path=denylist_path,
        static_dir=static_dir,
        probe_state_path=probe_state_path,
        session=probe_session(),
        backfill=args.backfill,
        refresh=args.refresh,
    )


if __name__ == "__main__":
    main()
