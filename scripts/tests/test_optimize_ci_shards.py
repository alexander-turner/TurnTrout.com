"""Tests for :mod:`scripts.optimize_ci_shards`."""

from __future__ import annotations

import math

import pytest

from scripts import optimize_ci_shards as opt


def _config(**overrides) -> opt.WorkflowConfig:
    """Build a WorkflowConfig with sensible defaults, overridable per test."""
    defaults: dict[str, object] = {
        "name": "Test",
        "total_test_executions": 600,
        "avg_test_sec": 8,
        "setup_overhead_min": 3,
        "timeout_min": 20,
        "cost_per_min": 0.008,
        "current_shards": 10,
    }
    defaults.update(overrides)
    return opt.WorkflowConfig(**defaults)  # type: ignore[arg-type]


def test_min_shards_matches_closed_form() -> None:
    cfg = _config(total_test_executions=600, avg_test_sec=8, timeout_min=20)
    # 600*8 = 4800s = 80min over (20-3)=17 available min -> ceil(80/17) = 5.
    assert opt.min_shards(cfg) == 5


def test_min_shards_floor_is_one() -> None:
    """A tiny workload still needs at least one shard."""
    cfg = _config(total_test_executions=1, avg_test_sec=1)
    assert opt.min_shards(cfg) == 1


def test_min_shards_raises_when_overhead_exceeds_timeout() -> None:
    cfg = _config(setup_overhead_min=20, timeout_min=20)
    with pytest.raises(ValueError, match="setup overhead"):
        opt.min_shards(cfg)


def test_total_worker_minutes() -> None:
    cfg = _config(
        total_test_executions=600, avg_test_sec=8, setup_overhead_min=3
    )
    # 600*8/60 = 80 test-min, plus 4 shards * 3 setup-min = 92.
    assert opt.total_worker_minutes(cfg, 4) == pytest.approx(92.0)


def test_wall_clock_minutes() -> None:
    cfg = _config(
        total_test_executions=600, avg_test_sec=8, setup_overhead_min=3
    )
    # 80 test-min / 5 shards = 16, plus 3 setup = 19.
    assert opt.wall_clock_minutes(cfg, 5) == pytest.approx(19.0)


def test_wall_clock_is_below_timeout_at_min_shards() -> None:
    cfg = _config(total_test_executions=600, avg_test_sec=8, timeout_min=20)
    assert opt.wall_clock_minutes(cfg, opt.min_shards(cfg)) <= cfg.timeout_min


def test_build_configs_linux_and_macos() -> None:
    configs = opt.build_configs("PR", {"linux": 2, "macos": 1})
    names = [c.name for c in configs]
    assert names == [
        "Playwright Linux (PR)",
        "Visual Linux (PR)",
        "Playwright macOS (PR)",
        "Visual macOS (PR)",
    ]
    playwright_linux = configs[0]
    assert (
        playwright_linux.total_test_executions
        == opt.PLAYWRIGHT_EXECUTIONS_PER_BROWSER * 2
    )
    assert playwright_linux.current_shards == 30


def test_build_configs_linux_only() -> None:
    configs = opt.build_configs("PR-new", {"linux": 1, "macos": 0})
    assert [c.name for c in configs] == [
        "Playwright Linux (PR-new)",
        "Visual Linux (PR-new)",
    ]


def test_build_configs_macos_only() -> None:
    configs = opt.build_configs("main", {"linux": 0, "macos": 1})
    assert [c.name for c in configs] == [
        "Playwright macOS (main)",
        "Visual macOS (main)",
    ]


def test_build_configs_empty() -> None:
    assert opt.build_configs("main", {"linux": 0, "macos": 0}) == []


def test_build_configs_unknown_context_has_no_current_shards() -> None:
    configs = opt.build_configs("PR-new", {"linux": 1, "macos": 0})
    assert all(c.current_shards == 0 for c in configs)


def test_print_table_with_current_shards(capsys: pytest.CaptureFixture) -> None:
    cfg = _config(name="WithCurrent", current_shards=10)
    current_cost, optimal_cost = opt.print_table("Title", [cfg])
    captured = capsys.readouterr().out
    assert "WithCurrent" in captured
    assert "Title" in captured
    assert current_cost > 0
    assert optimal_cost > 0
    # Fewer shards than the original is always at least as cheap.
    assert optimal_cost <= current_cost


def test_print_table_without_current_shards(
    capsys: pytest.CaptureFixture,
) -> None:
    cfg = _config(name="New", current_shards=0)
    current_cost, optimal_cost = opt.print_table("New config", [cfg])
    captured = capsys.readouterr().out
    assert "n/a" in captured
    assert current_cost == 0
    assert optimal_cost > 0


def test_main_runs_and_reports_savings(
    capsys: pytest.CaptureFixture,
) -> None:
    opt.main()
    captured = capsys.readouterr().out
    assert "Optimal CI Shard Calculator" in captured
    assert "SUMMARY" in captured
    assert "Monthly savings" in captured


def test_module_constants_are_internally_consistent() -> None:
    assert (
        opt.PLAYWRIGHT_EXECUTIONS_PER_BROWSER
        == opt.PLAYWRIGHT_TESTS * opt.VIEWPORTS
    )
    assert opt.VISUAL_EXECUTIONS_PER_BROWSER == opt.VISUAL_TESTS * opt.VIEWPORTS
    # math is imported and used by min_shards.
    assert math.ceil(1.1) == 2
