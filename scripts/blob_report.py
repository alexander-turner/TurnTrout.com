"""
Shared helpers for reading Playwright blob-report ZIPs.

Each blob-report ZIP contains a ``report.jsonl`` of newline-delimited
events (``onTestEnd``, ``onAttach``, …) emitted by Playwright's blob
reporter. Used by ``classify_visual_failures`` and
``approve_baselines_from_artifacts``.
"""

from __future__ import annotations

import json
import zipfile
from collections.abc import Iterator
from pathlib import Path

_REPORT_JSONL = "report.jsonl"


def iter_jsonl_events(jsonl: str) -> Iterator[dict]:
    """Yield decoded events from a ``report.jsonl`` string."""
    for line in jsonl.splitlines():
        if not line.strip():
            continue
        yield json.loads(line)


def iter_events_from_zip(zf: zipfile.ZipFile) -> Iterator[dict]:
    """
    Yield events from an already-open blob-report ZipFile.

    Use when the caller needs the zip open for other reads too (e.g. extracting
    attachment PNGs by path). Yields nothing if Playwright was interrupted
    before writing the report.
    """
    try:
        jsonl = zf.read(_REPORT_JSONL).decode("utf-8")
    except KeyError:
        return
    yield from iter_jsonl_events(jsonl)


def iter_events(blob_zip: Path) -> Iterator[dict]:
    """Yield decoded events from ``report.jsonl`` inside a blob ZIP."""
    with zipfile.ZipFile(blob_zip) as zf:
        yield from iter_events_from_zip(zf)
