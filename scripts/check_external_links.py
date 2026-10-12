"""
Check the served site's external links, re-checking only transient failures.

A crawl of the site fetches several hundred GitHub URLs, and GitHub answers a
few of them with a 5xx (or times out) on most runs. Re-running the whole crawl
would draw a fresh handful of such errors each time, so instead the failed URLs
are re-checked on their own, with backoff, until they pass or the attempts run
out. The crawl only fetches hosts we control, so the one failure a re-check
cannot clear, a 4xx such as a 404, fails immediately.
"""

import argparse
import csv
import re
import subprocess
import sys
import tempfile
import time
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import NamedTuple

SITE_URL = "http://localhost:8080"

# Crawl localhost, but only fetch external URLs on the hosts we control.
CHECKED_URLS = (
    r"!^(http://localhost:8080|https://assets\.turntrout\.com"
    r"|https://github\.com/alexander-turner/TurnTrout\.com)"
)

COMMON_ARGS: tuple[str, ...] = (
    "--config",
    "config/linkchecker/linkcheckerrc",
    "--check-extern",
    "--user-agent",
    "linkchecker",
    "--timeout",
    "40",
)

# linkchecker's CSV `result` column starts with the HTTP status code for an
# HTTP error, or names the exception (a timeout, a dropped connection).
_CLIENT_ERROR_RESULT = re.compile(r"^4\d\d\b")


class LinkFailure(NamedTuple):
    """One invalid link from linkchecker's CSV output."""

    url: str
    parent: str
    result: str

    @property
    def transient(self) -> bool:
        """Whether a re-check may clear the failure: anything but a 4xx."""
        return not _CLIENT_ERROR_RESULT.match(self.result)


def read_failures(csv_path: Path) -> list[LinkFailure]:
    """Return the invalid links in a linkchecker CSV report."""
    lines = [
        line
        for line in csv_path.read_text(encoding="utf-8").splitlines()
        if not line.startswith("#")
    ]
    return [
        LinkFailure(
            url=row["url"], parent=row["parentname"], result=row["result"]
        )
        for row in csv.DictReader(lines, delimiter=";")
        if row["valid"] != "True"
    ]


def run_linkchecker(args: Sequence[str], csv_path: Path) -> list[LinkFailure]:
    """
    Run linkchecker with a CSV report and return the links it found invalid.

    Raises:
        RuntimeError: if linkchecker hit an internal error (exit 2), or failed
            (exit 1) on printed warnings without reporting an invalid link.
    """
    command = [
        "linkchecker",
        *COMMON_ARGS,
        "--file-output",
        f"csv/utf-8/{csv_path}",
        *args,
    ]
    returncode = subprocess.run(command, check=False).returncode
    failures = read_failures(csv_path)
    if returncode not in (0, 1):
        raise RuntimeError(
            f"linkchecker hit an internal error (exit {returncode})"
        )
    if returncode == 1 and not failures:
        raise RuntimeError("linkchecker failed on the warnings printed above")
    return failures


def report(failures: Sequence[LinkFailure], heading: str) -> None:
    """Print each failure under a heading."""
    print(heading)
    for failure in failures:
        print(
            f"  {failure.url} ({failure.result}) linked from {failure.parent}"
        )


def check_external_links(
    work_dir: Path,
    max_rechecks: int,
    initial_delay: float,
    sleep: Callable[[float], None] = time.sleep,
) -> bool:
    """
    Crawl the site, then re-check its transiently failing URLs with backoff.

    Returns:
        Whether every external link ended up valid.
    """
    failures = run_linkchecker(
        [SITE_URL, "--ignore-url", CHECKED_URLS, "--threads", "30"],
        work_dir / "crawl.csv",
    )
    # A re-check starts from the URL itself, so its report names no parent.
    parents = {failure.url: failure.parent for failure in failures}
    delay = initial_delay
    for attempt in range(1, max_rechecks + 1):
        permanent = [failure for failure in failures if not failure.transient]
        if permanent or not failures:
            break
        urls = dict.fromkeys(failure.url for failure in failures)
        report(failures, f"Re-checking {len(urls)} URL(s) in {delay:g}s:")
        sleep(delay)
        delay *= 2
        failures = [
            failure._replace(parent=parents.get(failure.url, failure.parent))
            for failure in run_linkchecker(
                ["--recursion-level", "0", *urls],
                work_dir / f"recheck-{attempt}.csv",
            )
        ]
    if failures:
        report(failures, f"{len(failures)} external link(s) failed:")
        return False
    return True


def main(argv: Sequence[str] | None = None) -> int:
    """Check external links and return the process exit status."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-rechecks", type=int, default=3)
    parser.add_argument("--initial-delay", type=float, default=10)
    args = parser.parse_args(argv)
    with tempfile.TemporaryDirectory() as work_dir:
        passed = check_external_links(
            Path(work_dir), args.max_rechecks, args.initial_delay
        )
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
