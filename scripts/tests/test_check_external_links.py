import subprocess
from collections.abc import Sequence
from pathlib import Path

import pytest

from scripts import check_external_links as checker

CSV_HEADER = (
    "urlname;parentname;base;result;warningstring;infostring;valid;url;"
    "line;column;name;dltime;size;checktime;cached;level;modified"
)


def csv_report(
    rows: Sequence[tuple[str, str, bool]],
    parent: str = "http://localhost:8080/page",
) -> str:
    """Build a linkchecker CSV report from (url, result, valid) rows."""
    body = [
        f"{url};{parent};;{result};;;{valid};{url};;-1;;1;0;0;"
        for url, result, valid in rows
    ]
    return "\n".join(
        ["# created by LinkChecker", CSV_HEADER, *body, "# Stopped checking"]
    )


class FakeLinkchecker:
    """Stands in for `subprocess.run`, writing one scripted report per call."""

    def __init__(self, reports: Sequence[tuple[int, str]]):
        self.reports = list(reports)
        self.commands: list[list[str]] = []

    def __call__(self, command: list[str], check: bool):
        assert check is False
        self.commands.append(command)
        returncode, report = self.reports.pop(0)
        output = command[command.index("--file-output") + 1]
        Path(output.removeprefix("csv/utf-8/")).write_text(
            report, encoding="utf-8"
        )
        return subprocess.CompletedProcess(command, returncode)


@pytest.fixture
def run_checker(monkeypatch, tmp_path):
    """Run the checker against scripted reports; return (passed, fake,
    sleeps)."""

    def run(reports, max_rechecks=3):
        fake = FakeLinkchecker(reports)
        monkeypatch.setattr(checker.subprocess, "run", fake)
        sleeps: list[float] = []
        passed = checker.check_external_links(
            tmp_path, max_rechecks, 10, sleeps.append
        )
        return passed, fake, sleeps

    return run


GH = "https://github.com/alexander-turner/TurnTrout.com/blob/main"
OK = (0, csv_report([(f"{GH}/a.md", "200 OK", True)]))


def unavailable(*names: str) -> tuple[int, str]:
    return (
        1,
        csv_report(
            [
                (f"{GH}/{name}", "503 Service Unavailable", False)
                for name in names
            ]
        ),
    )


def test_clean_crawl_passes_without_rechecks(run_checker):
    passed, fake, sleeps = run_checker([OK])
    assert passed
    assert len(fake.commands) == 1
    assert sleeps == []
    crawl = fake.commands[0]
    assert crawl[0] == "linkchecker"
    assert checker.SITE_URL in crawl
    assert checker.CHECKED_URLS in crawl


def test_rechecks_only_transient_urls_with_backoff(run_checker, capsys):
    passed, fake, sleeps = run_checker(
        [unavailable("a.md", "b.md", "a.md"), unavailable("b.md"), OK]
    )
    assert passed
    assert "Re-checking 2 URL(s) in 10s:" in capsys.readouterr().out
    assert sleeps == [10, 20]
    first_recheck = fake.commands[1]
    assert first_recheck[-4:] == [
        "--recursion-level",
        "0",
        f"{GH}/a.md",
        f"{GH}/b.md",
    ]
    assert fake.commands[2][-3:] == ["--recursion-level", "0", f"{GH}/b.md"]
    assert checker.SITE_URL not in first_recheck


def test_fails_when_transient_errors_outlast_the_rechecks(run_checker, capsys):
    recheck = (
        1,
        csv_report(
            [(f"{GH}/a.md", "503 Service Unavailable", False)], parent=""
        ),
    )
    passed, fake, sleeps = run_checker(
        [unavailable("a.md"), recheck, recheck], max_rechecks=2
    )
    assert not passed
    assert sleeps == [10, 20]
    assert len(fake.commands) == 3
    assert capsys.readouterr().out.endswith(
        "1 external link(s) failed:\n"
        f"  {GH}/a.md (503 Service Unavailable) linked from http://localhost:8080/page\n"
    )


@pytest.mark.parametrize("result", ["404 Not Found", "410 Gone"])
def test_client_error_fails_without_rechecking(run_checker, capsys, result):
    report = (
        1,
        csv_report(
            [
                (f"{GH}/gone.md", result, False),
                (f"{GH}/a.md", "503 Service Unavailable", False),
            ]
        ),
    )
    passed, fake, sleeps = run_checker([report])
    assert not passed
    assert sleeps == []
    assert len(fake.commands) == 1
    assert (
        f"{GH}/gone.md ({result}) linked from http://localhost:8080/page"
        in (capsys.readouterr().out)
    )


def test_permanent_failure_on_recheck_stops_rechecking(run_checker):
    gone = (1, csv_report([(f"{GH}/a.md", "404 Not Found", False)]))
    passed, fake, sleeps = run_checker([unavailable("a.md"), gone])
    assert not passed
    assert sleeps == [10]
    assert len(fake.commands) == 2


@pytest.mark.parametrize(
    "body", [unavailable("a.md")[1], csv_report([])], ids=["with-503", "empty"]
)
def test_internal_error_raises_even_with_transient_failures(run_checker, body):
    with pytest.raises(RuntimeError, match=r"internal error \(exit 2\)"):
        run_checker([(2, body)])


def test_exit_1_without_invalid_links_raises(run_checker):
    with pytest.raises(RuntimeError, match="failed on the warnings printed"):
        run_checker([(1, csv_report([("u", "200 OK", True)]))])


@pytest.mark.parametrize(
    ("result", "transient"),
    [
        ("503 Service Unavailable", True),
        ("500 Internal Server Error", True),
        ("ReadTimeout: HTTPSConnectionPool(host='github.com', port=443)", True),
        (
            "ConnectionError: ('Connection aborted.', RemoteDisconnected())",
            True,
        ),
        ("404 Not Found", False),
        ("410 Gone", False),
    ],
)
def test_transient_means_anything_but_a_4xx(result, transient):
    assert checker.LinkFailure("u", "p", result).transient is transient


@pytest.mark.parametrize(("passed", "status"), [(True, 0), (False, 1)])
def test_main_returns_exit_status(monkeypatch, passed, status):
    calls = []

    def fake_check(work_dir, max_rechecks, initial_delay):
        calls.append((work_dir.is_dir(), max_rechecks, initial_delay))
        return passed

    monkeypatch.setattr(checker, "check_external_links", fake_check)
    assert (
        checker.main(["--max-rechecks", "5", "--initial-delay", "1.5"])
        == status
    )
    assert calls == [(True, 5, 1.5)]
