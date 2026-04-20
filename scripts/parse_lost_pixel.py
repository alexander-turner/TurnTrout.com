#!/usr/bin/env python3
"""
Parse Lost Pixel check-run output into structured counts.

The Lost Pixel GitHub App writes human-readable summaries whose format has
changed more than once (see commit e01c573 "fix(ci): parse Lost Pixel 'Label:
N' output format"). Rather than embedding a single fragile regex in a bash
pipeline, centralize parsing here with a fixture-backed test suite so format
drift fails at PR time instead of on main after a 6-hour delayed-approval
wait.

Used from .github/workflows/deploy.yaml::verify-test-results. Pure stdlib so
callers don't need uv set up.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class LostPixelCounts:
    """Structured counts extracted from a Lost Pixel summary."""

    changed: int
    added: int
    deleted: int

    @property
    def total(self) -> int:
        """Sum of all three count buckets."""
        return self.changed + self.added + self.deleted


# Per-kind ordered patterns. First match per kind wins. Patterns are
# case-insensitive. Add new patterns when Lost Pixel changes their summary
# format — and add a fixture to test_parse_lost_pixel.py at the same time so
# we never regress an old format by accident.
_COUNT_PATTERNS: dict[str, tuple[re.Pattern[str], ...]] = {
    "changed": (
        re.compile(r"(\d+)\s+changed", re.IGNORECASE),
        re.compile(r"(\d+)\s+visual\s+differences?", re.IGNORECASE),
        re.compile(r"differences?:\s*(\d+)", re.IGNORECASE),
        re.compile(r"(\d+)\s+differences?", re.IGNORECASE),
    ),
    "added": (
        re.compile(r"(\d+)\s+added", re.IGNORECASE),
        re.compile(r"(\d+)\s+new", re.IGNORECASE),
        re.compile(r"(\d+)\s+created", re.IGNORECASE),
        re.compile(r"additions?:\s*(\d+)", re.IGNORECASE),
    ),
    "deleted": (
        re.compile(r"(\d+)\s+deleted", re.IGNORECASE),
        re.compile(r"(\d+)\s+removed", re.IGNORECASE),
        re.compile(r"deletions?:\s*(\d+)", re.IGNORECASE),
    ),
}


def parse_counts(text: str | None) -> LostPixelCounts | None:
    """
    Extract changed/added/deleted counts from a Lost Pixel summary blob.

    Returns None when NO count field could be parsed. Callers must treat that as
    a format-drift failure, not as "zero changes" — silently defaulting to zero
    would auto-approve unseen visual regressions.
    """
    if not text:
        return None

    matched: dict[str, int] = {}
    for kind, patterns in _COUNT_PATTERNS.items():
        for pattern in patterns:
            match = pattern.search(text)
            if match:
                matched[kind] = int(match.group(1))
                break

    if not matched:
        return None

    return LostPixelCounts(
        changed=matched.get("changed", 0),
        added=matched.get("added", 0),
        deleted=matched.get("deleted", 0),
    )


def main() -> int:
    """CLI entry point invoked by the deploy workflow."""
    parser = argparse.ArgumentParser(
        description=(
            "Parse a Lost Pixel summary/text blob and emit counts as "
            "GitHub Actions output lines (changed, added, deleted, total)."
        )
    )
    parser.add_argument(
        "--text",
        required=True,
        help="Concatenated summary+text blob from the Lost Pixel check run.",
    )
    parser.add_argument(
        "--conclusion",
        default="",
        help=(
            "Optional Lost Pixel check conclusion. When no counts can be "
            "parsed and conclusion == 'success', we emit 0/0/0 rather "
            "than failing — LP sometimes posts an empty summary on a "
            "clean pass."
        ),
    )
    args = parser.parse_args()

    counts = parse_counts(args.text)
    if counts is None and args.conclusion == "success":
        counts = LostPixelCounts(0, 0, 0)

    if counts is None:
        sys.stderr.write(
            "Could not parse counts from Lost Pixel output.\n"
            f"Conclusion: {args.conclusion!r}\n"
            f"Raw text: {args.text!r}\n"
        )
        return 1

    print(f"changed={counts.changed}")
    print(f"added={counts.added}")
    print(f"deleted={counts.deleted}")
    print(f"total={counts.total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
