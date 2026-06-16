"""
Archive outbound external links and flag dead ones for build-time fallback.

This is the Python half of the link-archiving system (the TypeScript half is
``quartz/plugins/transformers/archiveLinks.ts``). It:

  1. Scans ``website_content/`` for outbound ``http(s)`` links (excluding the
     author's own domains and the asset CDN).
  2. Archives newly-discovered links with ArchiveBox (singlefile by default),
     injects ``noindex`` into the snapshot, and syncs it to R2 under a stable
     ``static/link-archive/<sha256>/singlefile.html`` key.
  3. Probes each link's liveness and records it in
     ``config/link_archive_manifest.json``. A link is only marked ``dead`` on a
     hard-gone status (404/410) confirmed on N>=2 consecutive runs; transient or
     blocked statuses (403/429/5xx/timeouts) never flip ``dead``.

The build-time transformer rewrites a ``dead`` link's ``href`` to its archived
copy. The canonicalization rule here is mirrored exactly in
``archiveLinks.ts``; the two share fixture tests so the manifest key the writer
emits always matches the key the reader looks up.

Expected environment variables (for the R2 sync step):
    - ACCESS_KEY_ID_TURNTROUT_MEDIA
    - SECRET_ACCESS_TURNTROUT_MEDIA
    - S3_ENDPOINT_ID_TURNTROUT_MEDIA
"""

import argparse
import datetime
import hashlib
import json
import re
import subprocess
import sys
from collections.abc import Iterable, Sequence
from pathlib import Path

import requests
from ada_url import URL

try:
    from . import r2_upload
    from . import utils as script_utils
except ImportError:
    import r2_upload  # type: ignore
    import utils as script_utils  # type: ignore

# --- Configuration constants -------------------------------------------------

# Hard-gone statuses: the only ones that can flip a link to ``dead``.
DEAD_STATUSES: frozenset[int] = frozenset({404, 410})
# Consecutive dead probes required before the destructive rewrite is allowed.
DEAD_STRIKE_THRESHOLD: int = 2
# Snapshots smaller than this are treated as login-walls / blank captures.
MIN_SNAPSHOT_BYTES: int = 2048
# Seconds to wait on a single liveness probe before recording it as blocked.
PROBE_TIMEOUT: int = 30
DEFAULT_PARALLEL: int = 4
DEFAULT_EXTRACTORS: str = "singlefile"
SNAPSHOT_FILENAME: str = "singlefile.html"

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
    """Raised when an ArchiveBox snapshot is too small to be a real capture."""


class SnapshotFailedError(RuntimeError):
    """Raised when ArchiveBox produces no snapshot for a single URL."""


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


# --- Manifest persistence ----------------------------------------------------


def _new_entry() -> dict:
    """Return a fresh manifest entry for a not-yet-archived URL."""
    return {
        "archive_url": "",
        "dead": False,
        "dead_strikes": 0,
        "last_status": 0,
        "last_checked": "",
    }


def load_manifest(path: Path) -> dict:
    """Load the manifest from *path*, or ``{}`` if it does not exist."""
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


def merge_manifest_fragments(fragments: Sequence[dict]) -> dict:
    """
    Fold sharded manifest *fragments* into one manifest (sorted keys).

    On a key collision the entry with the most recent ``last_checked`` wins, so
    a stale fragment never clobbers a fresher probe result.
    """
    merged: dict = {}
    for fragment in fragments:
        for key, entry in fragment.items():
            existing = merged.get(key)
            if existing is None or entry.get(
                "last_checked", ""
            ) >= existing.get("last_checked", ""):
                merged[key] = entry
    return {key: merged[key] for key in sorted(merged)}


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


def probe_status(url: str, session: requests.Session) -> int:
    """
    Return the final HTTP status of *url* after redirects, or ``0`` on error.

    Streams the response so the body is not downloaded. A ``0`` is treated as a
    transient/blocked result by :func:`update_dead_state`, never as ``dead``.
    """
    try:
        response = session.get(
            url, timeout=PROBE_TIMEOUT, allow_redirects=True, stream=True
        )
        response.close()
        return response.status_code
    except requests.RequestException as exc:
        print(f"Probe failed for {url}: {exc}", file=sys.stderr)
        return 0


def _is_alive_status(status: int) -> bool:
    """Whether *status* indicates a reachable resource (2xx/3xx final)."""
    return 200 <= status < 400


def update_dead_state(entry: dict, status: int) -> dict:
    """
    Return a copy of *entry* updated for a probe that returned *status*.

    Death requires ``DEAD_STRIKE_THRESHOLD`` *consecutive* hard-gone probes, so
    a flaky 404 sandwiched between healthy/transient probes can never drive the
    destructive rewrite (the repo's zero-flakiness rule for irreversible
    actions):

    - 404/410: increment the strike count; flip ``dead`` once it reaches the
      threshold. A confirmed ``dead`` verdict never reverts to ``False`` here.
    - 2xx/3xx: the link recovered — reset strikes and clear ``dead``.
    - anything else (403/429/5xx/timeout=0): blocked/transient — record the
      status and reset the consecutive-strike streak, but keep a previously
      confirmed ``dead`` verdict until a real recovery.
    """
    updated = dict(entry)
    updated["last_status"] = status
    updated["last_checked"] = _now_iso()
    if status in DEAD_STATUSES:
        strikes = updated.get("dead_strikes", 0) + 1
        updated["dead_strikes"] = strikes
        if strikes >= DEAD_STRIKE_THRESHOLD:
            updated["dead"] = True
    elif _is_alive_status(status):
        updated["dead_strikes"] = 0
        updated["dead"] = False
    else:
        updated["dead_strikes"] = 0
    return updated


# --- ArchiveBox + R2 sync ----------------------------------------------------


def _run_archivebox_add(
    urls: Sequence[str],
    data_dir: Path,
    parallel: int,
    extractors: str,
) -> None:  # pragma: no cover - thin subprocess wrapper, mocked in tests
    archivebox = script_utils.find_executable("archivebox")
    subprocess.run(
        [
            archivebox,
            "add",
            f"--parallel={parallel}",
            f"--extract={extractors}",
            *urls,
        ],
        cwd=str(data_dir),
        check=True,
    )


def archive_one(
    canonical_url: str,
    data_dir: Path,
    parallel: int = DEFAULT_PARALLEL,
    extractors: str = DEFAULT_EXTRACTORS,
) -> Path:
    """
    Archive *canonical_url* with ArchiveBox and return its ``singlefile.html``.

    ArchiveBox writes snapshots into timestamped ``archive/<ts>/`` dirs, so we
    diff the ``archive/`` directory before and after this single-URL add and
    pick the new snapshot that produced a ``singlefile.html``.
    """
    archive_root = data_dir / "archive"
    before = set(archive_root.glob("*")) if archive_root.exists() else set()
    _run_archivebox_add([canonical_url], data_dir, parallel, extractors)
    after = set(archive_root.glob("*")) if archive_root.exists() else set()

    new_snapshots = [
        directory
        for directory in (after - before)
        if (directory / SNAPSHOT_FILENAME).is_file()
    ]
    if not new_snapshots:
        raise SnapshotFailedError(
            f"ArchiveBox produced no {SNAPSHOT_FILENAME} for {canonical_url}"
        )
    newest = max(new_snapshots, key=lambda directory: directory.stat().st_mtime)
    return newest / SNAPSHOT_FILENAME


def sync_snapshot_to_r2(snapshot_path: Path) -> str:
    """
    Upload *snapshot_path* to R2 with a ``noindex`` header and return its URL.

    Reuses the R2 plumbing in :mod:`r2_upload` for key derivation and bucket
    config, but adds ``X-Robots-Tag: noindex`` so the mirrored copy stays out of
    search engines even when fetched directly from the CDN.
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
                "--metadata-set",
                "content-type=text/html",
            ],
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"Failed to upload snapshot to R2: {exc}") from exc
    return f"{r2_upload.R2_BASE_URL}/{r2_key}"


def archive_and_upload(
    canonical_url: str,
    data_dir: Path,
    static_dir: Path,
    parallel: int = DEFAULT_PARALLEL,
    extractors: str = DEFAULT_EXTRACTORS,
) -> str:
    """
    Archive *canonical_url*, ``noindex`` it, store it locally, sync to R2.

    Returns the public CDN URL of the uploaded snapshot.

    Raises:
        LowQualitySnapshotError: If the capture is too small to be real.
        SnapshotFailedError: If ArchiveBox produced no snapshot for the URL.
        RuntimeError: If the R2 upload failed (infra error — fails loud).
    """
    snapshot = archive_one(canonical_url, data_dir, parallel, extractors)
    raw = snapshot.read_bytes()
    if is_low_quality(raw):
        raise LowQualitySnapshotError(
            f"Snapshot for {canonical_url} is only {len(raw)} bytes"
        )

    html = inject_noindex(raw.decode("utf-8", errors="replace"))
    dest = snapshot_dest_path(static_dir, canonical_url)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(html, encoding="utf-8")
    return sync_snapshot_to_r2(dest)


# --- Orchestration -----------------------------------------------------------


def run_archive(  # pylint: disable=too-many-arguments,too-many-locals
    *,
    content_dir: Path,
    manifest_path: Path,
    denylist_path: Path,
    data_dir: Path,
    static_dir: Path,
    session: requests.Session,
    parallel: int = DEFAULT_PARALLEL,
    extractors: str = DEFAULT_EXTRACTORS,
    backfill: bool = False,
    refresh: bool = False,
) -> dict:
    """
    Discover outbound links, archive new ones, probe liveness, save manifest.

    Returns the updated manifest. New links are archived proactively (so a
    snapshot exists before the link rots); the rewrite only happens later, once
    a link is confirmed ``dead``.
    """
    manifest = load_manifest(manifest_path)
    denylist = load_denylist(denylist_path)
    markdown_files = script_utils.get_files(
        content_dir, (".md",), use_git_ignore=False
    )
    discovered = find_external_links(markdown_files)

    if backfill or refresh:
        to_archive = sorted(discovered)
    else:
        to_archive = diff_new_urls(discovered, manifest)

    for canonical in to_archive:
        if is_denied(canonical, denylist):
            print(f"Skipping deny-listed URL: {canonical}")
            continue
        already_archived = bool(manifest.get(canonical, {}).get("archive_url"))
        if already_archived and not refresh:
            continue
        try:
            archive_url = archive_and_upload(
                canonical, data_dir, static_dir, parallel, extractors
            )
        except (LowQualitySnapshotError, SnapshotFailedError) as exc:
            # Per-URL capture problems are expected (some sites block crawlers);
            # skip them. Infra failures (e.g. R2 auth) raise other errors that
            # propagate and fail the job loudly rather than silently archiving
            # nothing.
            print(f"Skipping {canonical}: {exc}", file=sys.stderr)
            continue
        entry = manifest.get(canonical, _new_entry())
        entry["archive_url"] = archive_url
        manifest[canonical] = entry

    for canonical in sorted(discovered):
        if canonical not in manifest:
            continue
        status = probe_status(canonical, session)
        manifest[canonical] = update_dead_state(manifest[canonical], status)

    save_manifest(manifest_path, manifest)
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
        "--data-dir", type=Path, default=None, help="ArchiveBox data dir"
    )
    parser.add_argument(
        "--static-dir", type=Path, default=None, help="quartz/static dir"
    )
    parser.add_argument(
        "--parallel",
        type=int,
        default=DEFAULT_PARALLEL,
        help="ArchiveBox parallelism",
    )
    parser.add_argument(
        "--extract", default=DEFAULT_EXTRACTORS, help="ArchiveBox extractors"
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
    parser.add_argument(
        "--merge",
        nargs="+",
        default=None,
        help="Merge the given manifest fragments into --manifest and exit",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    """Entry point for ``scripts/archive_links.py``."""
    args = _parse_args(argv)
    git_root = script_utils.get_git_root()

    manifest_path = args.manifest or (
        git_root / "config" / "link_archive_manifest.json"
    )

    if args.merge:
        fragments = [load_manifest(Path(path)) for path in args.merge]
        save_manifest(manifest_path, merge_manifest_fragments(fragments))
        print(f"Merged {len(fragments)} fragment(s) into {manifest_path}")
        return

    content_dir = args.content_dir or (git_root / script_utils.CONTENT_DIR_NAME)
    denylist_path = args.denylist or (
        git_root / "config" / "link_archive_denylist.json"
    )
    data_dir = args.data_dir or (git_root / ".archivebox")
    static_dir = args.static_dir or (git_root / "quartz" / "static")

    run_archive(
        content_dir=content_dir,
        manifest_path=manifest_path,
        denylist_path=denylist_path,
        data_dir=data_dir,
        static_dir=static_dir,
        session=script_utils.http_session(),
        parallel=args.parallel,
        extractors=args.extract,
        backfill=args.backfill,
        refresh=args.refresh,
    )


if __name__ == "__main__":
    main()
