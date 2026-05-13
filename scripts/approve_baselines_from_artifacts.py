#!/usr/bin/env python3
"""
Promote screenshots from a failing Playwright run into R2 as new visual
baselines, using the run's blob report as the source of truth for snapshot
names.

Used by the comment-triggered approve flow: instead of regenerating screenshots
from scratch (rebuild site, run all browsers again), we adopt the screenshots
the failing visual-testing run already produced.

Why the blob report (and not the ``test-results/`` tree on disk)? Playwright
writes ``<truncated>-actual.png`` to ``test-results/`` and silently hashes the
filename when the full snapshot name would exceed filesystem path limits. The
truncated form does *not* match the canonical baseline filename visual-testing
compares against. The blob report's attachment metadata, on the other hand,
records the canonical snapshot name verbatim and pairs it with the PNG body, so
it round-trips correctly for every test, long titles included.
"""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from collections.abc import Iterator
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

# pylint: disable=wrong-import-position
# skipcq: FLK-E402
from scripts import r2_baselines  # noqa: E402

_ACTUAL_SUFFIX = "-actual"
_PNG_CONTENT_TYPE = "image/png"


def _canonical_baseline_name(attachment_name: str) -> str | None:
    """
    Return the baseline filename for a Playwright ``-actual`` attachment.

    Playwright produces attachment names like ``"<snapshot>-actual"`` or
    ``"<snapshot>.png-actual"`` depending on whether the snapshot path already
    carries an extension. Normalise both shapes to ``<snapshot>.png``.
    """
    if not attachment_name.endswith(_ACTUAL_SUFFIX):
        return None
    stem = attachment_name[: -len(_ACTUAL_SUFFIX)]
    if stem.endswith(".png"):
        return stem
    return stem + ".png"


def _iter_actual_attachments(
    blob_zip: Path,
) -> Iterator[tuple[str, str]]:
    """
    Yield ``(canonical_baseline_name, zip_entry_path)`` for each PNG actual.

    Parses the blob report's ``report.jsonl`` for ``onAttach`` events and emits
    one tuple per snapshot mismatch attachment. The zip entry path is the
    ``resources/<sha1>.png`` path inside the same blob zip, ready for the caller
    to extract.
    """
    with zipfile.ZipFile(blob_zip) as zf:
        try:
            jsonl = zf.read("report.jsonl").decode("utf-8")
        except KeyError:
            return
        for line in jsonl.splitlines():
            if not line.strip():
                continue
            event = json.loads(line)
            if event.get("method") != "onAttach":
                continue
            for attachment in event.get("params", {}).get("attachments", []):
                if attachment.get("contentType") != _PNG_CONTENT_TYPE:
                    continue
                baseline_name = _canonical_baseline_name(
                    attachment.get("name", "")
                )
                path = attachment.get("path")
                if not baseline_name or not path:
                    continue
                yield baseline_name, path


def collect_from_blob_reports(blob_reports_dir: Path, staging_dir: Path) -> int:
    """
    Stage canonical baselines from every blob report zip in the directory.

    A blob report covers one shard; the dispatch workflow downloads them all
    (Linux + macOS, every shard) and passes the merged directory here. When
    multiple shards report the same snapshot, the first one wins — they contain
    identical PNG bytes because the shards run disjoint test subsets.
    """
    staging_dir.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    count = 0
    for blob_zip in sorted(blob_reports_dir.rglob("*.zip")):
        with zipfile.ZipFile(blob_zip) as zf:
            for baseline_name, zip_entry_path in _iter_actual_attachments(
                blob_zip
            ):
                if baseline_name in seen:
                    continue
                try:
                    png_bytes = zf.read(zip_entry_path)
                except KeyError:
                    # Attachment metadata referenced a path the zip doesn't
                    # contain (truncated upload? blob format drift?). Skip it
                    # rather than ship a half-staged baseline.
                    continue
                seen.add(baseline_name)
                (staging_dir / baseline_name).write_bytes(png_bytes)
                count += 1
    return count


def main(argv: list[str] | None = None) -> int:
    """Stage canonical baselines from blob reports and push them to R2."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "blob_reports_dir",
        type=Path,
        help="Directory containing downloaded blob-report-* artifacts "
        "(one .zip per shard).",
    )
    parser.add_argument(
        "--staging-dir",
        type=Path,
        default=Path("tests/visual-baselines"),
        help="Where to assemble the renamed PNGs before upload.",
    )
    args = parser.parse_args(argv)

    if not args.blob_reports_dir.is_dir():
        print(f"Not a directory: {args.blob_reports_dir}", file=sys.stderr)
        return 2

    count = collect_from_blob_reports(args.blob_reports_dir, args.staging_dir)
    if count == 0:
        print(
            "No PNG attachments found in any blob report; nothing to upload.",
            file=sys.stderr,
        )
        return 1
    print(
        f"Staged {count} baseline(s) from "
        f"{args.blob_reports_dir} -> {args.staging_dir}"
    )

    r2_baselines.upload(args.staging_dir)
    print(f"Uploaded {count} baseline(s) to R2")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
