#!/usr/bin/env python3
"""
Promote `*-actual.png` files from a Playwright test-results tree into R2 as new
visual baselines.

Used by the comment-triggered approve flow: instead of regenerating screenshots
from scratch (rebuild site, run all browsers again), we just adopt the
screenshots the failing visual-testing run already produced.

Mapping: each `<test-results-dir>/<arg>-actual.png` becomes `tests/visual-
baselines/<arg>.png` locally, then `r2_baselines.upload` mirrors the directory
to R2.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

# pylint: disable=wrong-import-position
# skipcq: FLK-E402
from scripts import r2_baselines  # noqa: E402


def collect(traces_dir: Path, staging_dir: Path) -> int:
    """Copy every `*-actual.png` in traces_dir into staging_dir, renamed."""
    staging_dir.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    count = 0

    for actual in sorted(traces_dir.rglob("*-actual.png")):
        if "-retry" in actual.parent.name:
            continue
        baseline_name = actual.name.removesuffix("-actual.png") + ".png"
        if baseline_name in seen:
            continue
        seen.add(baseline_name)
        shutil.copy(actual, staging_dir / baseline_name)
        count += 1

    return count


def main(argv: list[str] | None = None) -> int:
    """Stage `*-actual.png` artifacts as baselines and push them to R2."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "traces_dir",
        type=Path,
        help="Directory containing downloaded playwright-traces-* artifacts.",
    )
    parser.add_argument(
        "--staging-dir",
        type=Path,
        default=Path("tests/visual-baselines"),
        help="Where to assemble the renamed PNGs before upload.",
    )
    args = parser.parse_args(argv)

    if not args.traces_dir.is_dir():
        print(f"Not a directory: {args.traces_dir}", file=sys.stderr)
        return 2

    count = collect(args.traces_dir, args.staging_dir)
    if count == 0:
        print(
            "No *-actual.png files found; nothing to upload.", file=sys.stderr
        )
        return 1
    print(
        f"Staged {count} baseline(s) from {args.traces_dir} -> {args.staging_dir}"
    )

    r2_baselines.upload(args.staging_dir)
    print(f"Uploaded {count} baseline(s) to R2")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
