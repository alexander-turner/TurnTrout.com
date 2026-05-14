#!/usr/bin/env python3
"""Promote screenshots from a failing Playwright run into R2 as new
baselines."""

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

_ACTUAL_SUFFIX = "-actual.png"
_PNG_CONTENT_TYPE = "image/png"


def _canonical_baseline_name(attachment_name: str) -> str | None:
    if not attachment_name.endswith(_ACTUAL_SUFFIX):
        return None
    stem = attachment_name[: -len(_ACTUAL_SUFFIX)]
    if not stem or "/" in stem or "\\" in stem or ".." in stem.split("/"):
        return None
    return stem + ".png"


def _attachments_from_jsonl(jsonl: str) -> Iterator[dict]:
    for line in jsonl.splitlines():
        if not line.strip():
            continue
        event = json.loads(line)
        if event.get("method") != "onAttach":
            continue
        yield from (event.get("params") or {}).get("attachments") or []


def _iter_actual_pngs(blob_zip: Path) -> Iterator[tuple[str, bytes]]:
    with zipfile.ZipFile(blob_zip) as zf:
        try:
            jsonl = zf.read("report.jsonl").decode("utf-8")
        except KeyError:
            return
        for attachment in _attachments_from_jsonl(jsonl):
            if attachment.get("contentType") != _PNG_CONTENT_TYPE:
                continue
            baseline_name = _canonical_baseline_name(attachment.get("name", ""))
            path = attachment.get("path")
            if not baseline_name or not path:
                continue
            try:
                yield baseline_name, zf.read(path)
            except KeyError:
                continue


def collect_from_blob_reports(blob_reports_dir: Path, staging_dir: Path) -> int:
    """Stage canonical baselines from every blob-report zip; return the
    count."""
    staging_dir.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    count = 0
    for blob_zip in sorted(blob_reports_dir.rglob("*.zip")):
        for baseline_name, png_bytes in _iter_actual_pngs(blob_zip):
            if baseline_name in seen:
                continue
            seen.add(baseline_name)
            (staging_dir / baseline_name).write_bytes(png_bytes)
            count += 1
    return count


def main(argv: list[str] | None = None) -> None:
    """CLI entry point."""
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
        raise NotADirectoryError(args.blob_reports_dir)

    count = collect_from_blob_reports(args.blob_reports_dir, args.staging_dir)
    if count == 0:
        raise RuntimeError(
            "No PNG attachments found in any blob report; nothing to upload."
        )
    print(
        f"Staged {count} baseline(s) from "
        f"{args.blob_reports_dir} -> {args.staging_dir}"
    )

    r2_baselines.upload(args.staging_dir)
    print(f"Uploaded {count} baseline(s) to R2")


if __name__ == "__main__":  # pragma: no cover
    main()
