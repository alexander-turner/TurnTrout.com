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


def read_report_jsonl(blob_zip: Path) -> str | None:
    """
    Return the ``report.jsonl`` contents from a blob ZIP.

    Returns ``None`` when the entry is absent — Playwright omits it if it
    was interrupted before writing.
    """
    with zipfile.ZipFile(blob_zip) as zf:
        try:
            return zf.read(_REPORT_JSONL).decode("utf-8")
        except KeyError:
            return None


def iter_events(blob_zip: Path) -> Iterator[dict]:
    """Yield decoded events from ``report.jsonl`` inside a blob ZIP."""
    jsonl = read_report_jsonl(blob_zip)
    if jsonl is None:
        return
    yield from iter_jsonl_events(jsonl)
