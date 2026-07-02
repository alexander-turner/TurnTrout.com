"""
Verify every archived snapshot URL in the manifest is a live R2 object.

The per-PR ``linkchecker`` ignores ``assets.turntrout.com/static/link-archive/``
so a populated manifest doesn't make every build fetch thousands of multi-
hundred-KB snapshots and hammer R2. This check is what then guarantees the
invariant the reader depends on: every ``archive_url`` a dead link could be
rewritten to is actually reachable. It HEADs each ``archive_url`` and exits
non-zero on any non-200, and is meant to run in the weekly archive job (after
the manifest is written), not on the push critical path.
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


def find_broken_archives(
    manifest: dict, session: requests.Session
) -> list[tuple[str, str, int]]:
    """
    Return ``(canonical_url, archive_url, status)`` for every unreachable
    snapshot.

    ``status`` is the HTTP status of the HEAD request, or ``0`` if the request
    raised (DNS/connection/timeout). Entries without an ``archive_url`` are
    skipped — there is nothing to verify until they are archived.
    """
    broken: list[tuple[str, str, int]] = []
    for canonical, entry in sorted(manifest.items()):
        archive_url = entry.get("archive_url")
        if not archive_url:
            continue
        try:
            response = session.head(
                archive_url, timeout=PROBE_TIMEOUT, allow_redirects=True
            )
            status = response.status_code
        except requests.RequestException as exc:
            print(f"HEAD failed for {archive_url}: {exc}", file=sys.stderr)
            status = 0
        if status != 200:
            broken.append((canonical, archive_url, status))
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
            f"{len(broken)} archived snapshot(s) are not live on R2:",
            file=sys.stderr,
        )
        for canonical, archive_url, status in broken:
            print(
                f"  {status or 'ERR'}  {archive_url}  ({canonical})",
                file=sys.stderr,
            )
        return 1
    print(f"All {len(manifest)} manifest archive_urls are live (HTTP 200).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
