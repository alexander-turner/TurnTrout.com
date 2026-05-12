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


class _FakeRunner(run_a11y.Runner):
    """Pre-canned subprocess runner for tests; records every command invoked."""

    def __init__(self, responses: list[tuple[int, str, str]]) -> None:
        self.responses = list(responses)
        self.calls: list[list[str]] = []

    def run(self, cmd: list[str]) -> tuple[int, str, str]:
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
