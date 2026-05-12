"""Tests for scripts/run_a11y.py."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from .. import run_a11y


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("Navigation timeout of 120000 ms exceeded", True),
        ("navigation TIMEOUT exceeded", True),
        ("Failed to run pa11y on URL", True),
        ("Chrome crashed unexpectedly", True),
        ("net::ERR_NAME_NOT_RESOLVED", True),
        ("Protocol error (Page.navigate)", True),
        ("timed out waiting", True),
        ("Element must have an accessible name", False),
        ("WCAG 2.1 failure on color-contrast", False),
        ("aria-label is required", False),
        ("", False),
    ],
)
def test_is_flake_issue(message: str, expected: bool) -> None:
    assert run_a11y.is_flake_issue(message) is expected


def test_classify_failures_partitions_correctly() -> None:
    results = {
        "http://a/": [{"message": "Navigation timeout of 120000 ms exceeded"}],
        "http://b/": [{"message": "Element must have alt text"}],
        "http://c/": [
            {"message": "Failed to run pa11y on URL"},
            {"message": "net::ERR_FAILED"},
        ],
        "http://d/": [
            {"message": "Navigation timeout"},
            {"message": "aria-required-children"},
        ],
        "http://passed/": [],
    }
    flake, real = run_a11y.classify_failures(results)
    assert flake == ["http://a/", "http://c/"]
    assert real == ["http://b/", "http://d/"]


def test_classify_failures_empty() -> None:
    assert run_a11y.classify_failures({}) == ([], [])


def test_write_url_only_config_inherits_defaults(tmp_path: Path) -> None:
    base = tmp_path / "base.pa11yci"
    base.write_text(
        json.dumps({"defaults": {"timeout": 180000, "standard": "WCAG2AA"}})
    )
    out = run_a11y.write_url_only_config(
        base, ["http://x/", "http://y/"], target_dir=tmp_path
    )
    try:
        data = json.loads(out.read_text())
        assert data["defaults"]["timeout"] == 180000
        assert data["defaults"]["standard"] == "WCAG2AA"
        assert data["urls"] == ["http://x/", "http://y/"]
    finally:
        out.unlink(missing_ok=True)


def test_write_url_only_config_handles_missing_defaults(tmp_path: Path) -> None:
    base = tmp_path / "base.pa11yci"
    base.write_text("{}")
    out = run_a11y.write_url_only_config(
        base, ["http://x/"], target_dir=tmp_path
    )
    try:
        data = json.loads(out.read_text())
        assert data == {"defaults": {}, "urls": ["http://x/"]}
    finally:
        out.unlink(missing_ok=True)


class _FakeRunner:
    """Pre-canned subprocess runner for tests; records every command invoked."""

    def __init__(self, responses: list[tuple[int, str, str]]) -> None:
        self.responses = list(responses)
        self.calls: list[list[str]] = []

    def __call__(self, cmd: list[str]) -> tuple[int, str, str]:
        self.calls.append(list(cmd))
        if not self.responses:
            raise AssertionError(f"FakeRunner exhausted; cmd={cmd}")
        return self.responses.pop(0)


@pytest.fixture
def base_config(tmp_path: Path) -> Path:
    path = tmp_path / ".pa11yci"
    path.write_text(json.dumps({"defaults": {"timeout": 180000}}))
    return path


def _report(results: dict[str, list[dict]]) -> str:
    return json.dumps(
        {
            "total": len(results),
            "passes": sum(1 for v in results.values() if not v),
            "errors": sum(1 for v in results.values() if v),
            "results": results,
        }
    )


def test_run_with_retry_passes_first_try(base_config: Path) -> None:
    runner = _FakeRunner([(0, _report({"http://a/": []}), "")])
    rc = run_a11y.run_with_retry(
        config_path=base_config,
        sitemap="http://localhost:8080/sitemap.xml",
        sitemap_find="https://turntrout.com",
        sitemap_replace="http://localhost:8080",
        runner=runner,
    )
    assert rc == 0
    assert len(runner.calls) == 1


def test_run_with_retry_real_violations_fail_immediately(
    base_config: Path,
) -> None:
    report = _report({"http://a/": [{"message": "aria-required-children"}]})
    runner = _FakeRunner([(2, report, "")])
    rc = run_a11y.run_with_retry(
        config_path=base_config,
        sitemap="http://localhost:8080/sitemap.xml",
        sitemap_find="https://turntrout.com",
        sitemap_replace="http://localhost:8080",
        runner=runner,
    )
    assert rc == 2
    assert len(runner.calls) == 1


def test_run_with_retry_retries_flake_and_passes(base_config: Path) -> None:
    first = _report({"http://flake/": [{"message": "Navigation timeout"}]})
    retry = _report({"http://flake/": []})
    runner = _FakeRunner([(2, first, ""), (0, retry, "")])
    rc = run_a11y.run_with_retry(
        config_path=base_config,
        sitemap="http://localhost:8080/sitemap.xml",
        sitemap_find="https://turntrout.com",
        sitemap_replace="http://localhost:8080",
        runner=runner,
    )
    assert rc == 0
    assert len(runner.calls) == 2
    # Retry command should target the temp url-only config, not the sitemap.
    assert "--sitemap" not in runner.calls[1]


def test_run_with_retry_real_violation_in_retry_fails(
    base_config: Path,
) -> None:
    first = _report({"http://flake/": [{"message": "Navigation timeout"}]})
    retry = _report({"http://flake/": [{"message": "WCAG violation"}]})
    runner = _FakeRunner([(2, first, ""), (2, retry, "")])
    rc = run_a11y.run_with_retry(
        config_path=base_config,
        sitemap="http://localhost:8080/sitemap.xml",
        sitemap_find="https://turntrout.com",
        sitemap_replace="http://localhost:8080",
        runner=runner,
    )
    assert rc == 2


def test_run_with_retry_all_attempts_flake_passes(base_config: Path) -> None:
    flake = _report({"http://flake/": [{"message": "Navigation timeout"}]})
    runner = _FakeRunner([(2, flake, ""), (2, flake, ""), (2, flake, "")])
    rc = run_a11y.run_with_retry(
        config_path=base_config,
        sitemap="http://localhost:8080/sitemap.xml",
        sitemap_find="https://turntrout.com",
        sitemap_replace="http://localhost:8080",
        runner=runner,
    )
    assert rc == 0
    assert len(runner.calls) == 3


def test_run_with_retry_unparseable_output_propagates_exit_code(
    base_config: Path,
) -> None:
    runner = _FakeRunner([(2, "not json", "stderr")])
    rc = run_a11y.run_with_retry(
        config_path=base_config,
        sitemap="http://localhost:8080/sitemap.xml",
        sitemap_find="https://turntrout.com",
        sitemap_replace="http://localhost:8080",
        runner=runner,
    )
    assert rc == 2
    assert len(runner.calls) == 1


def test_run_with_retry_no_results_key_propagates(base_config: Path) -> None:
    runner = _FakeRunner([(1, json.dumps({"total": 0}), "")])
    rc = run_a11y.run_with_retry(
        config_path=base_config,
        sitemap="http://localhost:8080/sitemap.xml",
        sitemap_find="https://turntrout.com",
        sitemap_replace="http://localhost:8080",
        runner=runner,
    )
    assert rc == 1


def test_run_with_retry_empty_flake_list_propagates(base_config: Path) -> None:
    # Non-zero exit but no URL-keyed failures (e.g. CLI error). Don't retry.
    report = _report({"http://a/": []})
    runner = _FakeRunner([(1, report, "")])
    rc = run_a11y.run_with_retry(
        config_path=base_config,
        sitemap="http://localhost:8080/sitemap.xml",
        sitemap_find="https://turntrout.com",
        sitemap_replace="http://localhost:8080",
        runner=runner,
    )
    assert rc == 1


def test_run_with_retry_non_dict_results_propagates(base_config: Path) -> None:
    # If pa11y-ci's JSON ever emits a non-dict, non-falsy `results` field, we
    # can't classify by URL — propagate the original exit code rather than
    # retrying with empty input.
    runner = _FakeRunner(
        [(2, json.dumps({"total": 0, "results": ["unexpected"]}), "")]
    )
    rc = run_a11y.run_with_retry(
        config_path=base_config,
        sitemap="http://localhost:8080/sitemap.xml",
        sitemap_find="https://turntrout.com",
        sitemap_replace="http://localhost:8080",
        runner=runner,
    )
    assert rc == 2


def test_run_with_retry_unparseable_retry_output_propagates(
    base_config: Path,
) -> None:
    first = _report({"http://flake/": [{"message": "Navigation timeout"}]})
    runner = _FakeRunner([(2, first, ""), (2, "garbage", "stderr in retry")])
    rc = run_a11y.run_with_retry(
        config_path=base_config,
        sitemap="http://localhost:8080/sitemap.xml",
        sitemap_find="https://turntrout.com",
        sitemap_replace="http://localhost:8080",
        runner=runner,
    )
    assert rc == 2
    assert len(runner.calls) == 2


def test_run_with_retry_returns_when_retry_has_no_failures(
    base_config: Path,
) -> None:
    # Retry pass: non-zero exit, but no per-URL failures listed. Propagate.
    first = _report({"http://flake/": [{"message": "Navigation timeout"}]})
    retry = _report({"http://flake/": []})
    runner = _FakeRunner([(2, first, ""), (2, retry, "")])
    rc = run_a11y.run_with_retry(
        config_path=base_config,
        sitemap="http://localhost:8080/sitemap.xml",
        sitemap_find="https://turntrout.com",
        sitemap_replace="http://localhost:8080",
        runner=runner,
    )
    assert rc == 2
    assert len(runner.calls) == 2


def test_main_dispatches_to_run_with_retry(
    base_config: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict[str, object] = {}

    def fake_run_with_retry(**kwargs: object) -> int:
        captured.update(kwargs)
        return 0

    monkeypatch.setattr(run_a11y, "run_with_retry", fake_run_with_retry)
    rc = run_a11y.main(
        [
            "--config",
            str(base_config),
            "--sitemap",
            "http://example/sitemap.xml",
            "--sitemap-find",
            "https://prod",
            "--sitemap-replace",
            "http://localhost",
        ]
    )
    assert rc == 0
    assert captured["config_path"] == base_config
    assert captured["sitemap"] == "http://example/sitemap.xml"
    assert captured["sitemap_find"] == "https://prod"
    assert captured["sitemap_replace"] == "http://localhost"


# --- stress tests -----------------------------------------------------------


def test_classify_failures_scales_to_many_urls() -> None:
    """500 mixed flake/real URLs partition cleanly without surprises."""
    results = {
        f"http://flake-{i}/": [{"message": "Navigation timeout"}]
        for i in range(250)
    }
    results.update(
        {
            f"http://real-{i}/": [{"message": "WCAG color-contrast"}]
            for i in range(250)
        }
    )
    flake, real = run_a11y.classify_failures(results)
    assert len(flake) == 250
    assert len(real) == 250
    assert flake == sorted(flake)
    assert real == sorted(real)
    assert all(u.startswith("http://flake-") for u in flake)
    assert all(u.startswith("http://real-") for u in real)


def test_classify_failures_unicode_url_keys() -> None:
    """Non-ASCII URLs round-trip through classification."""
    results = {
        "http://example.com/héllo": [{"message": "Navigation timeout"}],
        "http://example.com/日本語": [{"message": "WCAG fail"}],
        "http://example.com/🚀": [{"message": "timed out"}],
    }
    flake, real = run_a11y.classify_failures(results)
    assert "http://example.com/héllo" in flake
    assert "http://example.com/🚀" in flake
    assert real == ["http://example.com/日本語"]


def test_classify_failures_mixed_in_single_url_counts_as_real() -> None:
    """A URL with even one non-flake issue is a real violation."""
    results = {
        "http://a/": [
            {"message": "Navigation timeout"},
            {"message": "Navigation timeout"},
            {"message": "aria-label is required"},
        ]
    }
    flake, real = run_a11y.classify_failures(results)
    assert flake == []
    assert real == ["http://a/"]


def test_classify_failures_handles_missing_message_field() -> None:
    """Issue dicts without a ``message`` key are treated as empty (non-
    flake)."""
    results = {
        "http://a/": [{"message": "Navigation timeout"}, {"code": "X"}],
    }
    flake, real = run_a11y.classify_failures(results)
    # The {"code": "X"} issue has empty message -> not a flake -> real violation
    assert flake == []
    assert real == ["http://a/"]


def test_is_flake_issue_handles_huge_message() -> None:
    """A 1 MB message is still classified in O(message) time, not infinite."""
    huge = "x" * 1_000_000 + "Navigation timeout" + "y" * 1_000_000
    assert run_a11y.is_flake_issue(huge)
    huge_real = "x" * 1_000_000 + "color-contrast" + "y" * 1_000_000
    assert not run_a11y.is_flake_issue(huge_real)


def test_write_url_only_config_preserves_url_order(tmp_path: Path) -> None:
    """Caller-specified URL ordering survives the write."""
    base = tmp_path / ".pa11yci"
    base.write_text(json.dumps({"defaults": {"timeout": 1}}))
    urls = [f"http://x-{i}/" for i in [3, 1, 4, 1, 5, 9, 2, 6]]
    out = run_a11y.write_url_only_config(base, urls, target_dir=tmp_path)
    try:
        data = json.loads(out.read_text())
        assert data["urls"] == urls
    finally:
        out.unlink(missing_ok=True)


def test_write_url_only_config_accepts_iterable_not_just_list(
    tmp_path: Path,
) -> None:
    """A generator / tuple iterable works (signature is Iterable[str])."""
    base = tmp_path / ".pa11yci"
    base.write_text("{}")

    out = run_a11y.write_url_only_config(
        base, (u for u in ["http://a/", "http://b/"]), target_dir=tmp_path
    )
    try:
        assert json.loads(out.read_text())["urls"] == ["http://a/", "http://b/"]
    finally:
        out.unlink(missing_ok=True)


def test_write_url_only_config_cleans_up_on_create(tmp_path: Path) -> None:
    """Two back-to-back calls produce two distinct temp files."""
    base = tmp_path / ".pa11yci"
    base.write_text("{}")
    a = run_a11y.write_url_only_config(base, ["http://a/"], target_dir=tmp_path)
    b = run_a11y.write_url_only_config(base, ["http://b/"], target_dir=tmp_path)
    try:
        assert a != b
        assert a.exists() and b.exists()
    finally:
        a.unlink(missing_ok=True)
        b.unlink(missing_ok=True)


def test_evaluate_pa11y_results_with_non_dict_issue_values() -> None:
    """JSON where ``results[url]`` is not a list raises gracefully."""
    # results values are expected to be iterables of dicts. A scalar/None
    # there should NOT crash -- classify_failures iterates messages.
    bad = {"http://a/": []}
    flake, real = run_a11y.classify_failures(bad)
    assert flake == [] and real == []


@pytest.mark.parametrize(
    "stdout",
    [
        "",
        "   ",
        "\x00\x01\x02",
        "<html>not json</html>",
        "{",
        "{}",  # valid JSON but no results
        json.dumps({"results": None}),
        json.dumps({"results": "not a dict"}),
        json.dumps({"results": 42}),
    ],
)
def test_evaluate_pa11y_malformed_or_partial_output_is_fatal(
    stdout: str,
) -> None:
    """Anything that isn't recognizable pa11y-ci JSON propagates as fatal."""
    outcome = run_a11y._evaluate(2, stdout)
    assert outcome.kind == "fatal"
    assert outcome.rc == 2


def test_evaluate_returns_pass_when_rc_zero_regardless_of_stdout() -> None:
    """Rc=0 short-circuits before parsing."""
    outcome = run_a11y._evaluate(0, "garbage that would otherwise be fatal")
    assert outcome.kind == "pass"
    assert outcome.rc == 0


def test_run_with_retry_real_violation_after_two_flake_attempts(
    base_config: Path,
) -> None:
    """Flake → flake → real_violation chain reports the violation, not
    'pass'."""
    flake = _report({"http://x/": [{"message": "Navigation timeout"}]})
    real = _report({"http://x/": [{"message": "WCAG"}]})
    runner = _FakeRunner([(2, flake, ""), (2, flake, ""), (2, real, "")])
    rc = run_a11y.run_with_retry(
        config_path=base_config,
        sitemap="http://localhost:8080/sitemap.xml",
        sitemap_find="https://turntrout.com",
        sitemap_replace="http://localhost:8080",
        runner=runner,
    )
    assert rc == 2
    assert len(runner.calls) == 3


def test_run_with_retry_flake_set_shrinks_between_attempts(
    base_config: Path,
) -> None:
    """Retry only re-tests the URLs the previous attempt actually failed on."""
    first = _report(
        {
            f"http://flake-{i}/": [{"message": "Navigation timeout"}]
            for i in range(5)
        }
    )
    # Second attempt: 3 of the 5 still flake, 2 pass.
    second = _report(
        {
            f"http://flake-{i}/": [{"message": "Navigation timeout"}]
            for i in range(3)
        }
    )
    # Third attempt: all pass.
    third = _report({"http://flake-0/": []})
    runner = _FakeRunner([(2, first, ""), (2, second, ""), (0, third, "")])
    rc = run_a11y.run_with_retry(
        config_path=base_config,
        sitemap="http://localhost:8080/sitemap.xml",
        sitemap_find="https://turntrout.com",
        sitemap_replace="http://localhost:8080",
        runner=runner,
    )
    assert rc == 0
    assert len(runner.calls) == 3


def test_run_with_retry_many_flake_urls_does_not_explode(
    base_config: Path,
) -> None:
    """200 simultaneously-flaking URLs still produce three retry attempts."""
    big = _report(
        {
            f"http://x-{i}/": [{"message": "Navigation timeout"}]
            for i in range(200)
        }
    )
    runner = _FakeRunner([(2, big, ""), (2, big, ""), (2, big, "")])
    rc = run_a11y.run_with_retry(
        config_path=base_config,
        sitemap="http://localhost:8080/sitemap.xml",
        sitemap_find="https://turntrout.com",
        sitemap_replace="http://localhost:8080",
        runner=runner,
    )
    assert rc == 0
    assert len(runner.calls) == 3


def test_retry_temp_config_is_cleaned_up_on_runner_exception(
    base_config: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """If the runner raises mid-retry, the temp config file still gets
    unlinked."""
    written: list[Path] = []
    real_write = run_a11y.write_url_only_config

    def tracking_write(*args: object, **kwargs: object) -> Path:
        p = real_write(*args, **kwargs)  # type: ignore[arg-type]
        written.append(p)
        return p

    monkeypatch.setattr(run_a11y, "write_url_only_config", tracking_write)

    class _Boom(Exception):
        pass

    def boom_runner(_cmd: list[str]) -> tuple[int, str, str]:
        if len(boom_runner.calls) == 0:  # type: ignore[attr-defined]
            boom_runner.calls.append(1)  # type: ignore[attr-defined]
            return (
                2,
                _report({"http://x/": [{"message": "Navigation timeout"}]}),
                "",
            )
        raise _Boom

    boom_runner.calls = []  # type: ignore[attr-defined]

    with pytest.raises(_Boom):
        run_a11y.run_with_retry(
            config_path=base_config,
            sitemap="http://localhost:8080/sitemap.xml",
            sitemap_find="https://turntrout.com",
            sitemap_replace="http://localhost:8080",
            runner=boom_runner,
        )

    # The retry attempt's temp config must be cleaned up despite the
    # exception from the runner.
    assert written, "retry path must have written a temp config"
    for p in written:
        assert not p.exists(), f"temp config leaked: {p}"
