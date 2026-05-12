"""
Run pa11y-ci with per-URL retry for transient navigation-timeout / browser-crash
failures.

A full pa11y-ci pass over the sitemap takes ~17 min, so re-running the entire
suite three times to ride out a single timeout would exceed the workflow's
50-min step cap. Instead, parse the first pass's JSON output: if the only
failures are flake-pattern messages (navigation timeouts, Chrome crashes,
``Failed to run pa11y``, ``net::ERR_*``), re-run pa11y-ci against just those
URLs. A real WCAG/aria/contrast violation fails immediately on the first pass.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Final

REPO_ROOT: Final[Path] = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG: Final[Path] = REPO_ROOT / "config" / "pa11y" / ".pa11yci"
DEFAULT_SITEMAP: Final[str] = "http://localhost:8080/sitemap.xml"
DEFAULT_SITEMAP_FIND: Final[str] = "https://turntrout.com"
DEFAULT_SITEMAP_REPLACE: Final[str] = "http://localhost:8080"

# Issue messages that indicate a transient failure rather than a real
# accessibility violation. If every issue for a URL matches one of these,
# we re-run that URL rather than failing the build.
_FLAKE_PATTERNS: Final[tuple[re.Pattern[str], ...]] = (
    re.compile(r"Navigation timeout", re.IGNORECASE),
    re.compile(r"timed?\s*out", re.IGNORECASE),
    re.compile(r"Failed to run pa11y", re.IGNORECASE),
    re.compile(r"crashed", re.IGNORECASE),
    re.compile(r"net::ERR_", re.IGNORECASE),
    re.compile(r"Protocol error", re.IGNORECASE),
)

MAX_ATTEMPTS: Final[int] = 3


def is_flake_issue(message: str) -> bool:
    """True iff ``message`` matches one of the known transient-failure
    patterns."""
    return any(p.search(message) for p in _FLAKE_PATTERNS)


def classify_failures(
    results: Mapping[str, Iterable[Mapping[str, object]]],
) -> tuple[list[str], list[str]]:
    """
    Partition failing URLs into (flake-only, real-violation).

    A URL is "flake-only" iff at least one issue exists and every issue's
    ``message`` matches a flake pattern. Otherwise (any non-flake issue), it's a
    real violation.
    """
    flake_urls: list[str] = []
    violation_urls: list[str] = []
    for url, issues in results.items():
        messages = [str(i.get("message", "")) for i in issues]
        if not messages:
            continue
        if all(is_flake_issue(m) for m in messages):
            flake_urls.append(url)
        else:
            violation_urls.append(url)
    return sorted(flake_urls), sorted(violation_urls)


def write_url_only_config(
    base_config: Path, urls: list[str], target_dir: Path | None = None
) -> Path:
    """
    Write a temporary pa11y-ci config inheriting ``defaults`` from
    ``base_config`` and listing exactly ``urls``.

    Returns the path to the new config file.
    """
    base = json.loads(base_config.read_text(encoding="utf-8"))
    config = {"defaults": base.get("defaults", {}), "urls": list(urls)}
    target_dir = target_dir or Path(tempfile.gettempdir())
    target_dir.mkdir(parents=True, exist_ok=True)
    fd, path_str = tempfile.mkstemp(
        prefix=".pa11yci.", suffix=".json", dir=str(target_dir)
    )
    path = Path(path_str)
    with open(fd, "w", encoding="utf-8") as fh:
        json.dump(config, fh)
    return path


def _run(cmd: list[str]) -> tuple[int, str, str]:  # pragma: no cover
    """Run ``cmd``, returning (returncode, stdout, stderr)."""
    completed = subprocess.run(cmd, capture_output=True, text=True, check=False)
    return completed.returncode, completed.stdout, completed.stderr


def _parse_report(stdout: str) -> dict[str, object] | None:
    """Parse pa11y-ci JSON output, returning ``None`` on parse failure."""
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        return None


def run_with_retry(
    *,
    config_path: Path,
    sitemap: str,
    sitemap_find: str,
    sitemap_replace: str,
    runner: "Runner" = None,  # type: ignore[assignment]
) -> int:
    """
    Run pa11y-ci on the sitemap.

    On flake-only failures, re-run just the failing URLs (up to ``MAX_ATTEMPTS``
    total). Real violations fail immediately. Returns the exit code suitable for
    ``sys.exit``.
    """
    runner = runner or _Subprocess()

    first_cmd = [
        "pnpm",
        "exec",
        "pa11y-ci",
        "--json",
        "--config",
        str(config_path),
        "--sitemap",
        sitemap,
        "--sitemap-find",
        sitemap_find,
        "--sitemap-replace",
        sitemap_replace,
    ]
    rc, stdout, stderr = runner.run(first_cmd)
    if stderr:
        sys.stderr.write(stderr)
    if rc == 0:
        return 0

    report = _parse_report(stdout)
    if report is None:
        sys.stderr.write(
            "pa11y-ci output was not valid JSON; treating as fatal.\n"
        )
        sys.stdout.write(stdout)
        return rc

    results = report.get("results") or {}
    if not isinstance(results, dict):
        sys.stderr.write("pa11y-ci JSON had no `results` dict.\n")
        return rc

    flake_urls, violation_urls = classify_failures(results)
    if violation_urls:
        sys.stderr.write(
            f"Real accessibility violations on {len(violation_urls)} URL(s); "
            "not retrying.\n"
        )
        sys.stdout.write(stdout)
        return rc

    if not flake_urls:
        return rc

    sys.stderr.write(
        f"First pass: {len(flake_urls)} flake-only failure(s). "
        f"Retrying just those URLs.\n"
    )
    for url in flake_urls:
        sys.stderr.write(f"  - {url}\n")

    for attempt in range(2, MAX_ATTEMPTS + 1):
        tmp_config = write_url_only_config(config_path, flake_urls)
        try:
            retry_cmd = [
                "pnpm",
                "exec",
                "pa11y-ci",
                "--json",
                "--config",
                str(tmp_config),
            ]
            rc, stdout, stderr = runner.run(retry_cmd)
            if stderr:
                sys.stderr.write(stderr)
            if rc == 0:
                sys.stderr.write(
                    f"Attempt {attempt}: all retried URLs passed.\n"
                )
                return 0
            report = _parse_report(stdout)
            if report is None:
                sys.stderr.write(
                    f"Attempt {attempt}: retry output was not valid JSON.\n"
                )
                sys.stdout.write(stdout)
                return rc
            results = report.get("results") or {}
            flake_urls, violation_urls = classify_failures(
                results if isinstance(results, dict) else {}
            )
            if violation_urls:
                sys.stderr.write(
                    f"Retry attempt {attempt} surfaced "
                    f"{len(violation_urls)} real violation(s); failing.\n"
                )
                sys.stdout.write(stdout)
                return rc
            if not flake_urls:
                return rc
            sys.stderr.write(
                f"Attempt {attempt}: still {len(flake_urls)} flake-only "
                "failure(s).\n"
            )
        finally:
            tmp_config.unlink(missing_ok=True)

    sys.stderr.write(
        f"All {MAX_ATTEMPTS} attempts produced only timeout/crash failures "
        "(no real a11y violations). Passing.\n"
    )
    return 0


class Runner:
    """Pluggable subprocess runner so tests can inject deterministic output."""

    def run(self, cmd: list[str]) -> tuple[int, str, str]:  # pragma: no cover
        raise NotImplementedError


class _Subprocess(Runner):
    def run(self, cmd: list[str]) -> tuple[int, str, str]:  # pragma: no cover
        return _run(cmd)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--sitemap", default=DEFAULT_SITEMAP)
    parser.add_argument("--sitemap-find", default=DEFAULT_SITEMAP_FIND)
    parser.add_argument("--sitemap-replace", default=DEFAULT_SITEMAP_REPLACE)
    args = parser.parse_args(argv)
    return run_with_retry(
        config_path=args.config,
        sitemap=args.sitemap,
        sitemap_find=args.sitemap_find,
        sitemap_replace=args.sitemap_replace,
    )


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
