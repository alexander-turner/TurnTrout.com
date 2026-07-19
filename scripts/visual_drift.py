#!/usr/bin/env python3
"""
Deterministic drift classification for the nightly visual-testing sentinel.

The nightly (``schedule``) visual-testing run re-renders ``main`` against the
R2 baselines. Whether a snapshot diff it reports is *environment drift* (runner
image or browser rotation) or a *real code change* is a deterministic fact: it
depends only on whether ``main``'s rendering-relevant source moved since the
baselines were last approved.

This module owns:

  * the R2 provenance object (``visual-baselines/.provenance.json``) that records
    the ``main`` commit the current baselines were approved against, and
  * composition of the gallery provenance note shown under the diff-gallery
    header, which states the drift verdict without hedging when provenance is
    available.

The provenance SHA is written by ``update-visual-baselines.yaml`` each time an
approval makes the baselines authoritative for a ``main`` commit, and read by
``visual-testing.yaml`` when it composes the sentinel note.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from collections.abc import Sequence
from pathlib import Path

try:
    from . import r2_baselines, r2_sync
except ImportError:  # pragma: no cover - script-style invocation
    import r2_baselines
    import r2_sync

# Object holding the approving commit, stored next to the baselines in R2.
PROVENANCE_KEY = f"{r2_baselines.R2_PREFIX}/.provenance.json"

# Paths whose changes can move rendered pixels. Kept in sync with the
# ``should-run`` ci-gate filter in ``.github/workflows/visual-testing.yaml``;
# the sentinel diffs the approving commit against ``main`` HEAD over exactly
# these paths to decide drift-vs-code.
RENDERING_RELEVANT_PATHS: tuple[str, ...] = (
    "quartz",
    "website_content",
    "config/quartz",
    "config/constants.json",
    "config/playwright",
    "tests/visual-baselines",
    "package.json",
    "pnpm-lock.yaml",
    ".github/actions",
)


def _remote_object() -> str:
    return f"r2:{r2_sync.R2_BUCKET}/{PROVENANCE_KEY}"


def read_provenance_sha() -> str | None:
    """
    Return the recorded approving commit SHA, or ``None`` when no provenance
    object exists yet (or it can't be read/parsed).

    A missing or unreadable object is not fatal: the sentinel degrades to its
    hedged note rather than failing the run. The reason is logged to stderr.
    """
    with r2_sync.rclone_config() as config:
        try:
            raw = r2_sync.rclone_output(["cat", _remote_object()], config)
        except subprocess.CalledProcessError:
            print(
                "No baseline provenance object in R2 (or it was unreadable); "
                "the sentinel note will hedge.",
                file=sys.stderr,
            )
            return None
    try:
        sha = json.loads(raw).get("sha")
    except (json.JSONDecodeError, AttributeError):
        print("Baseline provenance object is malformed JSON.", file=sys.stderr)
        return None
    if not isinstance(sha, str) or not sha:
        print("Baseline provenance object has no 'sha'.", file=sys.stderr)
        return None
    return sha


def write_provenance_sha(sha: str) -> None:
    """Record ``sha`` as the commit the current baselines were approved
    against."""
    if not sha:
        raise ValueError("Refusing to write empty provenance SHA")
    payload = json.dumps({"sha": sha}) + "\n"
    with (
        r2_sync.rclone_config() as config,
        tempfile.TemporaryDirectory() as tmp,
    ):
        local = Path(tmp) / "provenance.json"
        local.write_text(payload, encoding="utf-8")
        r2_sync.rclone(["copyto", str(local), _remote_object()], config)
    print(f"Recorded baseline provenance: {sha}")


def _sentinel_prefix(
    provenance_sha: str | None,
    changed_paths: Sequence[str] | None,
) -> str:
    """Build the drift verdict shown before the trigger line on nightly runs."""
    if provenance_sha is None:
        return (
            "nightly drift sentinel (no baseline-approval provenance recorded "
            "yet; diffs below are environment drift unless main changed since "
            "the last approval)"
        )
    short = provenance_sha[:8]
    if changed_paths is None:
        return (
            "nightly drift sentinel (couldn't resolve the baseline-approval "
            f"commit {short} in history; diffs below are environment drift "
            "unless main changed since the last approval)"
        )
    if not changed_paths:
        return (
            "nightly drift sentinel · main is unchanged in rendering-relevant "
            f"paths since baselines were approved at {short} — every diff "
            "below is environment drift, not a code change"
        )
    count = len(changed_paths)
    plural = "" if count == 1 else "s"
    return (
        "nightly drift sentinel · main changed since baselines were approved "
        f"at {short} ({count} rendering-relevant file{plural}, e.g. "
        f"{changed_paths[0]}) — some diffs below may be code changes, not drift"
    )


def compose_note(
    *,
    event_name: str,
    ref_name: str,
    environments: str,
    provenance_sha: str | None,
    changed_paths: Sequence[str] | None,
) -> str:
    """
    Build the gallery provenance note.

    ``changed_paths`` is the rendering-relevant diff between the approving
    commit and ``main`` HEAD: an empty sequence means "determined: nothing
    changed", while ``None`` means "couldn't determine" (no provenance, or the
    commit wasn't resolvable). On non-``schedule`` triggers the sentinel prefix
    is omitted entirely.
    """
    note = f"trigger: {event_name} on {ref_name}"
    if event_name == "schedule":
        note = f"{_sentinel_prefix(provenance_sha, changed_paths)} · {note}"
    if environments:
        note = f"{note} · {environments}"
    return note


def _cmd_read_provenance(_args: argparse.Namespace) -> None:
    sha = read_provenance_sha()
    if sha:
        print(sha)


def _cmd_write_provenance(args: argparse.Namespace) -> None:
    write_provenance_sha(args.sha)


def _cmd_render_paths(_args: argparse.Namespace) -> None:
    for path in RENDERING_RELEVANT_PATHS:
        print(path)


def _cmd_compose_note(args: argparse.Namespace) -> None:
    if args.changed_unknown:
        changed_paths: list[str] | None = None
    elif args.changed_paths_file is not None:
        text = Path(args.changed_paths_file).read_text(encoding="utf-8")
        changed_paths = [line for line in text.splitlines() if line]
    else:
        changed_paths = None
    print(
        compose_note(
            event_name=args.event_name,
            ref_name=args.ref_name,
            environments=args.environments,
            provenance_sha=args.provenance_sha or None,
            changed_paths=changed_paths,
        )
    )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    read_p = sub.add_parser(
        "read-provenance",
        help="Print the recorded approving commit SHA (empty line if none).",
    )
    read_p.set_defaults(func=_cmd_read_provenance)

    write_p = sub.add_parser(
        "write-provenance",
        help="Record the commit the current baselines were approved against.",
    )
    write_p.add_argument("--sha", required=True)
    write_p.set_defaults(func=_cmd_write_provenance)

    paths_p = sub.add_parser(
        "render-paths",
        help="Print the rendering-relevant path list, one per line.",
    )
    paths_p.set_defaults(func=_cmd_render_paths)

    note_p = sub.add_parser(
        "compose-note", help="Compose the gallery provenance note."
    )
    note_p.add_argument("--event-name", required=True)
    note_p.add_argument("--ref-name", required=True)
    note_p.add_argument("--environments", default="")
    note_p.add_argument("--provenance-sha", default="")
    note_p.add_argument(
        "--changed-paths-file",
        default=None,
        help="File of newline-separated changed paths (empty file = no "
        "rendering-relevant change).",
    )
    note_p.add_argument(
        "--changed-unknown",
        action="store_true",
        help="Mark the diff as undeterminable (overrides --changed-paths-file).",
    )
    note_p.set_defaults(func=_cmd_compose_note)
    return parser


def main(argv: Sequence[str] | None = None) -> None:
    """CLI entry point."""
    args = _build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":  # pragma: no cover
    main()
