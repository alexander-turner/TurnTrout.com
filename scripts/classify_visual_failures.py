#!/usr/bin/env python3
"""
Classify Playwright blob-report failures as snapshot-only or real.

A "snapshot failure" is a failed test whose attachments include at least
one ``*-actual.png`` — produced by ``toHaveScreenshot()`` for both
missing and pixel-diff outcomes. Other failed tests (timeouts, page
errors, exceptions before reaching ``toHaveScreenshot()``) are "real".

Reads one or more blob-report ZIPs and writes two flags suitable for
``$GITHUB_OUTPUT``:

- ``has_any_failures`` — at least one test ended unexpected
- ``has_real_failures`` — at least one of those was not snapshot-only

Snapshot-only shards stay green while the overall ``visual-testing``
status and ``publish-visual-report`` still surface a failure.
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from scripts.blob_report import iter_events

_ACTUAL_SUFFIX = "-actual.png"


@dataclass
class _TestState:
    expected_status: str = "passed"
    observed_statuses: list[str] = field(default_factory=list)
    has_snapshot_attachment: bool = False


@dataclass(frozen=True)
class Classification:
    """Aggregate counts across every blob report inspected."""

    snapshot_failures: int
    real_failures: int

    @property
    def has_any_failures(self) -> bool:
        """True iff any snapshot or real failure was observed."""
        return self.snapshot_failures > 0 or self.real_failures > 0

    @property
    def has_real_failures(self) -> bool:
        """True iff at least one non-snapshot failure was observed."""
        return self.real_failures > 0


def _record_test_end(tests: dict[str, _TestState], params: dict) -> None:
    test = params.get("test") or {}
    result = params.get("result") or {}
    test_id = test.get("testId")
    if not test_id:
        return
    state = tests[test_id]
    expected = test.get("expectedStatus")
    if expected:
        state.expected_status = expected
    status = result.get("status")
    if status:
        state.observed_statuses.append(status)


def _record_attachments(tests: dict[str, _TestState], params: dict) -> None:
    test_id = params.get("testId")
    if not test_id:
        return
    for attachment in params.get("attachments") or []:
        name = attachment.get("name") or ""
        if name.endswith(_ACTUAL_SUFFIX):
            tests[test_id].has_snapshot_attachment = True
            return


def _classify_blob(blob_zip: Path) -> tuple[int, int]:
    """Return ``(snapshot_failures, real_failures)`` for one blob ZIP."""
    tests: dict[str, _TestState] = defaultdict(_TestState)
    for event in iter_events(blob_zip):
        method = event.get("method")
        params = event.get("params") or {}
        if method == "onTestEnd":
            _record_test_end(tests, params)
        elif method == "onAttach":
            _record_attachments(tests, params)

    snapshot_failures = 0
    real_failures = 0
    for state in tests.values():
        # A test is an "unexpected" outcome only when no retry produced
        # its expected status. Flaky-but-eventually-passing tests are
        # not failures and don't block the shard.
        if state.expected_status in state.observed_statuses:
            continue
        if not state.observed_statuses:
            continue
        if state.has_snapshot_attachment:
            snapshot_failures += 1
        else:
            real_failures += 1
    return snapshot_failures, real_failures


def classify_directory(blob_reports_dir: Path) -> Classification:
    """Classify every ``*.zip`` blob report under ``blob_reports_dir``."""
    snapshot_total = 0
    real_total = 0
    for blob_zip in sorted(blob_reports_dir.rglob("*.zip")):
        snapshot, real = _classify_blob(blob_zip)
        snapshot_total += snapshot
        real_total += real
    return Classification(
        snapshot_failures=snapshot_total, real_failures=real_total
    )


def _write_flags(result: Classification, output_path: Path | None) -> None:
    lines = [
        f"has_any_failures={'true' if result.has_any_failures else 'false'}",
        f"has_real_failures={'true' if result.has_real_failures else 'false'}",
        f"snapshot_failures={result.snapshot_failures}",
        f"real_failures={result.real_failures}",
    ]
    text = "\n".join(lines) + "\n"
    if output_path is None:
        sys.stdout.write(text)
    else:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(text, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    """
    CLI entry point.

    Returns ``1`` iff real (non-snapshot) failures exist.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "blob_reports_dir",
        type=Path,
        help="Directory containing Playwright blob-report ZIPs.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Write flags here instead of stdout (e.g. $GITHUB_OUTPUT or a "
        "status artifact file).",
    )
    parser.add_argument(
        "--fail-on-real",
        action="store_true",
        help="Exit non-zero when real (non-snapshot) failures exist. "
        "Snapshot-only outcomes always exit 0.",
    )
    args = parser.parse_args(argv)

    if not args.blob_reports_dir.is_dir():
        raise NotADirectoryError(args.blob_reports_dir)

    result = classify_directory(args.blob_reports_dir)
    _write_flags(result, args.output)
    if args.fail_on_real and result.has_real_failures:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
