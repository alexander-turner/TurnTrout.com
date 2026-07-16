"""
Verify every archived snapshot URL in the manifest is a live, hardened R2
object.

The per-PR ``linkchecker`` ignores ``assets.turntrout.com/static/link-archive/``
so a populated manifest doesn't make every build fetch thousands of multi-
hundred-KB snapshots and hammer R2. This check is what then guarantees the
invariants the reader depends on. For every ``archive_url`` it HEADs the
snapshot and fails on:

- a non-200 response (the rewrite must never point at a missing object);
- a URL outside the snapshot prefix (mirroring the reader's own origin check —
  the rewrite trusts ``archive_url`` completely);
- missing hardening response headers. R2's S3 API cannot attach arbitrary
  per-object response headers, so ``X-Robots-Tag: noindex`` and
  ``Content-Security-Policy: sandbox`` are served by a Cloudflare transform
  rule on the ``static/link-archive/`` path prefix; this check is what keeps
  that dashboard-configured rule honest.

Meant to run in the weekly archive job (after the manifest is written), not on
the push critical path.
"""

import sys
from collections.abc import Sequence
from pathlib import Path

import requests

try:
    from . import archive_links
    from . import utils as script_utils
except ImportError:
    import archive_links
    import utils as script_utils

# Seconds to wait on a single HEAD before recording it as unreachable.
PROBE_TIMEOUT: int = 30
# Matches ARCHIVE_URL_PREFIX in quartz/plugins/transformers/archiveLinks.ts.
ARCHIVE_URL_PREFIX: str = f"{script_utils.CDN_BASE_URL}/static/link-archive/"
# Response headers the Cloudflare transform rule must attach to snapshots
# (header -> required substring of its value).
REQUIRED_RESPONSE_HEADERS: dict[str, str] = {
    "X-Robots-Tag": "noindex",
    "Content-Security-Policy": "sandbox",
}


def _snapshot_problems(response: requests.Response) -> list[str]:
    """Return every integrity problem with a snapshot's HEAD *response*."""
    if response.status_code != 200:
        return [f"HTTP {response.status_code}"]
    problems = []
    for header, required in REQUIRED_RESPONSE_HEADERS.items():
        if required not in response.headers.get(header, ""):
            problems.append(
                f"missing response header '{header}: {required}' "
                "(is the Cloudflare transform rule for "
                "static/link-archive/ configured?)"
            )
    return problems


def find_broken_archives(
    manifest: dict, session: requests.Session
) -> list[tuple[str, str, str]]:
    """
    Return ``(canonical_url, archive_url, problem)`` for every bad snapshot.

    Entries without an ``archive_url`` are skipped — there is nothing to
    verify until they are archived.
    """
    broken: list[tuple[str, str, str]] = []
    for canonical, entry in sorted(manifest.items()):
        archive_url = entry.get("archive_url")
        if not archive_url:
            continue
        if not archive_url.startswith(ARCHIVE_URL_PREFIX):
            broken.append(
                (canonical, archive_url, "outside the snapshot prefix")
            )
            continue
        try:
            response = session.head(
                archive_url, timeout=PROBE_TIMEOUT, allow_redirects=True
            )
        except requests.RequestException as exc:
            broken.append((canonical, archive_url, f"HEAD failed: {exc}"))
            continue
        broken.extend(
            (canonical, archive_url, problem)
            for problem in _snapshot_problems(response)
        )
    return broken


def main(argv: Sequence[str] | None = None) -> int:
    """Check the committed manifest; return a process exit code."""
    args = list(sys.argv[1:] if argv is None else argv)
    git_root = script_utils.get_git_root()
    manifest_path = (
        Path(args[0])
        if args
        else git_root / "config" / "link_archive_manifest.json"
    )
    manifest = archive_links.load_manifest(manifest_path)
    broken = find_broken_archives(manifest, script_utils.http_session())
    if broken:
        print(
            f"{len(broken)} archived snapshot problem(s):",
            file=sys.stderr,
        )
        for canonical, archive_url, problem in broken:
            print(f"  {problem}  {archive_url}  ({canonical})", file=sys.stderr)
        return 1
    print(f"All {len(manifest)} manifest archive_urls are live and hardened.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
