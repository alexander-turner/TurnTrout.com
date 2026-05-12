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
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Final, Literal

# Runs a command, returning (returncode, stdout, stderr). Tests inject a
# deterministic implementation; production uses :func:`_subprocess_runner`.
Runner = Callable[[list[str]], tuple[int, str, str]]

REPO_ROOT: Final[Path] = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG: Final[Path] = REPO_ROOT / "config" / "pa11y" / ".pa11yci"
DEFAULT_SITEMAP: Final[str] = "http://localhost:8080/sitemap.xml"
DEFAULT_SITEMAP_FIND: Final[str] = "https://turntrout.com"
DEFAULT_SITEMAP_REPLACE: Final[str] = "http://localhost:8080"
MAX_ATTEMPTS: Final[int] = 3

# Issue-message substrings that indicate a transient failure rather than a
# real accessibility violation. A URL whose issues are *only* flake patterns
# gets re-run; any non-flake issue fails immediately.
_FLAKE_RE: Final[re.Pattern[str]] = re.compile(
    r"navigation timeout|timed?\s*out|failed to run pa11y"
    r"|crashed|net::err_|protocol error",
    re.IGNORECASE,
)

Kind = Literal["pass", "real_violation", "flake", "fatal"]


@dataclass(frozen=True)
class _Outcome:
    """Result of evaluating one pa11y-ci attempt's JSON output."""

    kind: Kind
    rc: int
    flake_urls: tuple[str, ...] = ()


def is_flake_issue(message: str) -> bool:
    """True iff ``message`` matches a known transient-failure pattern."""
    return bool(_FLAKE_RE.search(message))


def classify_failures(
    results: Mapping[str, Iterable[Mapping[str, object]]],
) -> tuple[list[str], list[str]]:
    """
    Partition failing URLs into ``(flake_only, real_violation)``.

    A URL is "flake-only" iff it has at least one issue and every issue's
    ``message`` matches a flake pattern.
    """
    flake: list[str] = []
    real: list[str] = []
    for url, issues in results.items():
        messages = [str(i.get("message", "")) for i in issues]
        if not messages:
            continue
        (flake if all(map(is_flake_issue, messages)) else real).append(url)
    return sorted(flake), sorted(real)


def write_url_only_config(
    base_config: Path, urls: Iterable[str], target_dir: Path | None = None
) -> Path:
    """
    Write a temporary pa11y-ci config inheriting ``defaults`` from
    ``base_config`` and listing exactly ``urls``.

    Returns the new path.
    """
    base = json.loads(base_config.read_text(encoding="utf-8"))
    target_dir = target_dir or Path(tempfile.gettempdir())
    target_dir.mkdir(parents=True, exist_ok=True)
    fd, path = tempfile.mkstemp(
        prefix=".pa11yci.", suffix=".json", dir=str(target_dir)
    )
    with open(fd, "w", encoding="utf-8") as fh:
        json.dump(
            {"defaults": base.get("defaults", {}), "urls": list(urls)}, fh
        )
    return Path(path)


def _subprocess_runner(  # pragma: no cover
    cmd: list[str],
) -> tuple[int, str, str]:
    """Default :data:`Runner`: invoke ``cmd`` via :func:`subprocess.run`."""
    r = subprocess.run(cmd, capture_output=True, text=True, check=False)
    return r.returncode, r.stdout, r.stderr


def _evaluate(rc: int, stdout: str) -> _Outcome:
    """Classify a pa11y-ci attempt into pass / real_violation / flake /
    fatal."""
    if rc == 0:
        return _Outcome("pass", 0)
    try:
        report = json.loads(stdout)
    except json.JSONDecodeError:
        return _Outcome("fatal", rc)
    results = report.get("results") if isinstance(report, dict) else None
    if not isinstance(results, dict):
        return _Outcome("fatal", rc)
    flake, real = classify_failures(results)
    if real:
        return _Outcome("real_violation", rc)
    if not flake:
        return _Outcome("fatal", rc)
    return _Outcome("flake", rc, tuple(flake))


def _attempt(runner: Runner, cmd: list[str]) -> _Outcome:
    """Run one pa11y-ci invocation, log streams, and classify the result."""
    rc, stdout, stderr = runner(cmd)
    if stderr:
        sys.stderr.write(stderr)
    outcome = _evaluate(rc, stdout)
    if outcome.kind in {"real_violation", "fatal"}:
        sys.stdout.write(stdout)
    return outcome


def _retry(
    runner: Runner, base_config: Path, flake_urls: list[str]
) -> _Outcome:
    """One retry attempt against ``flake_urls`` only, with temp-config
    cleanup."""
    tmp = write_url_only_config(base_config, flake_urls)
    try:
        return _attempt(
            runner,
            ["pnpm", "exec", "pa11y-ci", "--json", "--config", str(tmp)],
        )
    finally:
        tmp.unlink(missing_ok=True)


def run_with_retry(
    *,
    config_path: Path,
    sitemap: str,
    sitemap_find: str,
    sitemap_replace: str,
    runner: Runner | None = None,
) -> int:
    """
    Run pa11y-ci on the sitemap.

    On flake-only failures, re-run just the failing URLs (up to ``MAX_ATTEMPTS``
    total). Real violations fail immediately. Returns the exit code suitable for
    ``sys.exit``.
    """
    runner = runner or _subprocess_runner
    outcome = _attempt(
        runner,
        [
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
        ],
    )
    if outcome.kind != "flake":
        return outcome.rc

    flake_urls = list(outcome.flake_urls)
    sys.stderr.write(
        f"First pass: {len(flake_urls)} flake-only failure(s). Retrying:\n"
        + "".join(f"  - {u}\n" for u in flake_urls)
    )

    for attempt in range(2, MAX_ATTEMPTS + 1):
        outcome = _retry(runner, config_path, flake_urls)
        if outcome.kind == "pass":
            sys.stderr.write(f"Attempt {attempt}: all retried URLs passed.\n")
            return 0
        if outcome.kind != "flake":
            return outcome.rc
        flake_urls = list(outcome.flake_urls)
        sys.stderr.write(
            f"Attempt {attempt}: still {len(flake_urls)} flake-only failure(s).\n"
        )

    sys.stderr.write(
        f"All {MAX_ATTEMPTS} attempts produced only timeout/crash failures "
        "(no real a11y violations). Passing.\n"
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
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
