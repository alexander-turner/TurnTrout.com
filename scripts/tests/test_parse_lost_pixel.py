"""
Smoke tests for the Lost Pixel summary parser.

Each fixture here is a real (or realistic) LP summary format we've seen. When LP
changes their format, add the new string as a fixture BEFORE updating
parse_lost_pixel.py so the test catches the regression first.
"""

import subprocess
import sys
from pathlib import Path

import pytest

from scripts.parse_lost_pixel import LostPixelCounts, parse_counts

_SCRIPT = Path(__file__).resolve().parents[1] / "parse_lost_pixel.py"


@pytest.mark.parametrize(
    "text, expected",
    [
        # Classic count format
        ("3 changed, 1 added, 0 deleted", LostPixelCounts(3, 1, 0)),
        # "Label: N" style referenced in commit e01c573
        (
            "Differences: 4, Additions: 2, Deletions: 1",
            LostPixelCounts(4, 2, 1),
        ),
        # Singular "difference"
        ("1 visual difference", LostPixelCounts(1, 0, 0)),
        # Plural "differences"
        ("2 visual differences", LostPixelCounts(2, 0, 0)),
        # All zeros — the "clean pass" shape
        ("0 changed, 0 added, 0 deleted", LostPixelCounts(0, 0, 0)),
        # Mixed casing and whitespace
        ("  7  CHANGED  and 3 NEW images", LostPixelCounts(7, 3, 0)),
        # 'removed' synonym for deleted
        ("5 changed, 2 removed", LostPixelCounts(5, 0, 2)),
        # 'created' synonym for added
        ("4 created", LostPixelCounts(0, 4, 0)),
    ],
)
def test_parse_counts_known_formats(text, expected):
    assert parse_counts(text) == expected


@pytest.mark.parametrize(
    "text",
    [
        "",
        None,
        # Humans-only "all good" message — no numbers → can't parse →
        # must return None so caller fails loudly instead of silently
        # treating as zero (which would auto-approve unseen regressions).
        "Build complete, no issues to report",
    ],
)
def test_parse_counts_returns_none_when_unparseable(text):
    assert parse_counts(text) is None


def test_total_property():
    counts = LostPixelCounts(changed=3, added=2, deleted=1)
    assert counts.total == 6


def test_cli_emits_github_outputs():
    """End-to-end: CLI wrapper prints the four output= lines."""
    result = subprocess.run(
        [
            sys.executable,
            str(_SCRIPT),
            "--text",
            "3 changed, 1 added, 2 deleted",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    lines = result.stdout.strip().splitlines()
    assert lines == ["changed=3", "added=1", "deleted=2", "total=6"]


def test_cli_accepts_success_conclusion_with_empty_text():
    """LP sometimes posts an empty summary on a clean pass — treat that as 0/0/0
    only when the check conclusion is explicitly 'success'."""
    result = subprocess.run(
        [
            sys.executable,
            str(_SCRIPT),
            "--text",
            "",
            "--conclusion",
            "success",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    assert "total=0" in result.stdout


def test_cli_fails_loudly_on_unparseable_without_success():
    """
    With no counts parseable AND no success conclusion, exit non-zero — don't
    guess.

    This is the guard that turns LP format drift into a loud PR-time failure
    instead of a silent production auto-approval.
    """
    result = subprocess.run(
        [
            sys.executable,
            str(_SCRIPT),
            "--text",
            "inscrutable new format",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode != 0
    assert "Could not parse" in result.stderr
