#!/usr/bin/env python3
"""
Compute optimal GitHub Actions shard counts to minimize total worker-minutes.

Key insight: total worker-minutes = N_shards * setup_overhead + total_test_time.
Since total_test_time is constant regardless of shard count, fewer shards = fewer
total billed minutes. The only constraint is that wall-clock time per shard must
stay under the job timeout.

Usage:
    python scripts/optimize_ci_shards.py
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from frozendict import frozendict

# ---------------------------------------------------------------------------
# Test counts (from codebase analysis)
# ---------------------------------------------------------------------------
PLAYWRIGHT_TESTS = 207  # non-visual Playwright tests
VISUAL_TESTS = 39  # visual regression tests
VIEWPORTS = 3  # mobile, tablet, desktop

PLAYWRIGHT_EXECUTIONS_PER_BROWSER = PLAYWRIGHT_TESTS * VIEWPORTS  # 621
VISUAL_EXECUTIONS_PER_BROWSER = VISUAL_TESTS * VIEWPORTS  # 117

# Average seconds per test execution
AVG_PLAYWRIGHT_SEC = 8
AVG_VISUAL_SEC = 15

# Per-shard setup overhead (minutes): checkout, install browsers, download artifacts
SETUP_LINUX_MIN = 3
SETUP_MACOS_MIN = 4

# Job timeouts (minutes)
TIMEOUT_PLAYWRIGHT_LINUX = 20
TIMEOUT_PLAYWRIGHT_MACOS = 30
TIMEOUT_VISUAL_LINUX = 35
TIMEOUT_VISUAL_MACOS = 35

# GitHub Actions runner cost per minute (USD)
COST_LINUX = 0.008
COST_MACOS = 0.08

# Original shard counts (before optimization)
ORIGINAL_SHARDS = frozendict(
    {
        "Playwright Linux (main)": 30,
        "Playwright macOS (main)": 15,
        "Visual Linux (main)": 15,
        "Visual macOS (main)": 7,
        "Playwright Linux (PR)": 30,
        "Playwright macOS (PR)": 15,
        "Visual Linux (PR)": 15,
        "Visual macOS (PR)": 7,
    }
)


@dataclass
class WorkflowConfig:
    """A single workflow configuration to optimize."""

    name: str
    total_test_executions: int
    avg_test_sec: float
    setup_overhead_min: float
    timeout_min: float
    cost_per_min: float
    current_shards: int


def min_shards(cfg: WorkflowConfig) -> int:
    """
    Return the minimum number of shards that fits within the timeout.

    Each shard runs (total_test_time / N) seconds of tests plus setup_overhead
    minutes. We need:
        setup_overhead + (total_test_sec / N) / 60 <= timeout
    Solving for N:
        N >= total_test_sec / (60 * (timeout - setup_overhead))
    """
    total_test_sec = cfg.total_test_executions * cfg.avg_test_sec
    available_min = cfg.timeout_min - cfg.setup_overhead_min
    if available_min <= 0:
        raise ValueError(
            f"{cfg.name}: setup overhead ({cfg.setup_overhead_min}m) "
            f">= timeout ({cfg.timeout_min}m)"
        )
    needed = total_test_sec / 60.0 / available_min
    return max(1, math.ceil(needed))


def total_worker_minutes(cfg: WorkflowConfig, n_shards: int) -> float:
    """Total billed worker-minutes for a given shard count."""
    total_test_min = cfg.total_test_executions * cfg.avg_test_sec / 60.0
    return n_shards * cfg.setup_overhead_min + total_test_min


def wall_clock_minutes(cfg: WorkflowConfig, n_shards: int) -> float:
    """Wall-clock time of the slowest shard."""
    test_min_per_shard = (
        cfg.total_test_executions * cfg.avg_test_sec / 60.0 / n_shards
    )
    return cfg.setup_overhead_min + test_min_per_shard


def build_configs(
    context: str, browser_counts: dict[str, int]
) -> list[WorkflowConfig]:
    """
    Build WorkflowConfig list for a given context (main/PR).

    browser_counts: {"linux": N, "macos": N} -- number of browsers on each OS.
    """
    configs: list[WorkflowConfig] = []
    linux_browsers = browser_counts["linux"]
    macos_browsers = browser_counts["macos"]

    label = f"({context})"

    if linux_browsers > 0:
        configs.append(
            WorkflowConfig(
                name=f"Playwright Linux {label}",
                total_test_executions=PLAYWRIGHT_EXECUTIONS_PER_BROWSER
                * linux_browsers,
                avg_test_sec=AVG_PLAYWRIGHT_SEC,
                setup_overhead_min=SETUP_LINUX_MIN,
                timeout_min=TIMEOUT_PLAYWRIGHT_LINUX,
                cost_per_min=COST_LINUX,
                current_shards=ORIGINAL_SHARDS.get(
                    f"Playwright Linux {label}", 0
                ),
            )
        )
        configs.append(
            WorkflowConfig(
                name=f"Visual Linux {label}",
                total_test_executions=VISUAL_EXECUTIONS_PER_BROWSER
                * linux_browsers,
                avg_test_sec=AVG_VISUAL_SEC,
                setup_overhead_min=SETUP_LINUX_MIN,
                timeout_min=TIMEOUT_VISUAL_LINUX,
                cost_per_min=COST_LINUX,
                current_shards=ORIGINAL_SHARDS.get(f"Visual Linux {label}", 0),
            )
        )

    if macos_browsers > 0:
        configs.append(
            WorkflowConfig(
                name=f"Playwright macOS {label}",
                total_test_executions=PLAYWRIGHT_EXECUTIONS_PER_BROWSER
                * macos_browsers,
                avg_test_sec=AVG_PLAYWRIGHT_SEC,
                setup_overhead_min=SETUP_MACOS_MIN,
                timeout_min=TIMEOUT_PLAYWRIGHT_MACOS,
                cost_per_min=COST_MACOS,
                current_shards=ORIGINAL_SHARDS.get(
                    f"Playwright macOS {label}", 0
                ),
            )
        )
        configs.append(
            WorkflowConfig(
                name=f"Visual macOS {label}",
                total_test_executions=VISUAL_EXECUTIONS_PER_BROWSER
                * macos_browsers,
                avg_test_sec=AVG_VISUAL_SEC,
                setup_overhead_min=SETUP_MACOS_MIN,
                timeout_min=TIMEOUT_VISUAL_MACOS,
                cost_per_min=COST_MACOS,
                current_shards=ORIGINAL_SHARDS.get(f"Visual macOS {label}", 0),
            )
        )

    return configs


def print_table(
    title: str, configs: list[WorkflowConfig]
) -> tuple[float, float]:
    """Print optimization table and return (current_total_cost,
    optimal_total_cost)."""
    print(f"\n{'=' * 90}")
    print(f"  {title}")
    print(f"{'=' * 90}")

    header = (
        f"{'Workflow':<28} {'Cur':>4} {'Opt':>4} "
        f"{'Cur min':>8} {'Opt min':>8} {'Wall':>6} "
        f"{'Cur $':>8} {'Opt $':>8} {'Saved':>8}"
    )
    print(header)
    print("-" * 90)

    total_current_cost = 0.0
    total_optimal_cost = 0.0

    for cfg in configs:
        opt = min_shards(cfg)
        cur_wm = (
            total_worker_minutes(cfg, cfg.current_shards)
            if cfg.current_shards > 0
            else 0
        )
        opt_wm = total_worker_minutes(cfg, opt)
        wc = wall_clock_minutes(cfg, opt)
        cur_cost = cur_wm * cfg.cost_per_min
        opt_cost = opt_wm * cfg.cost_per_min
        saved = cur_cost - opt_cost

        total_current_cost += cur_cost
        total_optimal_cost += opt_cost

        has_current = cfg.current_shards > 0
        print(
            f"{cfg.name:<28} "
            f"{str(cfg.current_shards) if has_current else 'n/a':>4} {opt:>4} "
            f"{f'{cur_wm:.1f}' if has_current else 'n/a':>8} {opt_wm:>8.1f} {wc:>5.1f}m "
            f"{f'${cur_cost:.3f}' if has_current else 'n/a':>8} "
            f"${opt_cost:.3f} "
            f"{f'${saved:.3f}' if has_current else 'n/a':>8}"
        )

    print("-" * 90)
    saving = total_current_cost - total_optimal_cost
    print(
        f"{'TOTAL':<28} {'':>4} {'':>4} "
        f"{'':>8} {'':>8} {'':>6} "
        f"${total_current_cost:.3f} ${total_optimal_cost:.3f} ${saving:.3f}"
    )
    return total_current_cost, total_optimal_cost


def main() -> None:
    """Print optimized shard counts and cost comparisons."""
    print("Optimal CI Shard Calculator")
    print(
        f"\nInputs: {PLAYWRIGHT_TESTS} Playwright tests, {VISUAL_TESTS} visual tests, "
        f"{VIEWPORTS} viewports"
    )
    print(
        f"        {AVG_PLAYWRIGHT_SEC}s avg/Playwright test, "
        f"{AVG_VISUAL_SEC}s avg/visual test"
    )
    print(
        f"        Setup: {SETUP_LINUX_MIN}m (Linux), {SETUP_MACOS_MIN}m (macOS)"
    )
    print(
        f"        Cost:  ${COST_LINUX}/min (Linux), ${COST_MACOS}/min (macOS)"
    )

    # Current config: all browsers everywhere (main and PR identical)
    print("\n" + "#" * 90)
    print("#  CURRENT CONFIG: All 3 browsers on both main and PR")
    print("#" * 90)

    main_current = build_configs("main", {"linux": 2, "macos": 1})
    pr_current = build_configs("PR", {"linux": 2, "macos": 1})
    cur_main_cost, opt_main_cost = print_table(
        "Main push (Chromium+Firefox Linux, WebKit macOS)", main_current
    )
    cur_pr_cost, opt_pr_cost = print_table(
        "PR (Chromium+Firefox Linux, WebKit macOS) -- CURRENT", pr_current
    )

    # New config: PRs run only Chromium on Linux
    print("\n" + "#" * 90)
    print("#  NEW CONFIG: PRs run Chromium-only on Linux; main unchanged")
    print("#" * 90)

    # For PRs in new config, there are no current shard counts -- new workflow
    pr_new = build_configs("PR-new", {"linux": 1, "macos": 0})
    # Override current_shards to 0 since this is a new config
    for cfg in pr_new:
        cfg.current_shards = 0

    print_table(
        "Main push (unchanged: Chromium+Firefox Linux, WebKit macOS)",
        main_current,
    )
    _, opt_pr_new_cost = print_table("PR (Chromium-only Linux) -- NEW", pr_new)

    # Summary comparison
    print("\n" + "=" * 90)
    print("  SUMMARY: Per-run cost comparison")
    print("=" * 90)
    print(f"  {'':40} {'Current':>12} {'Optimal':>12}")
    print(
        f"  {'Main push (current browsers):':<40} ${cur_main_cost:>10.3f} ${opt_main_cost:>10.3f}"
    )
    print(
        f"  {'PR -- current (3 browsers):':<40} ${cur_pr_cost:>10.3f} ${opt_pr_cost:>10.3f}"
    )
    print(
        f"  {'PR -- new (Chromium only):':<40} {'n/a':>12} ${opt_pr_new_cost:>10.3f}"
    )
    print()

    # Estimate monthly savings assuming 60 main pushes and 120 PR runs per month
    main_per_month = 60
    pr_per_month = 120
    monthly_current = (
        main_per_month * cur_main_cost + pr_per_month * cur_pr_cost
    )
    monthly_optimal_same = (
        main_per_month * opt_main_cost + pr_per_month * opt_pr_cost
    )
    monthly_optimal_new = (
        main_per_month * opt_main_cost + pr_per_month * opt_pr_new_cost
    )

    print(
        f"  Estimated monthly costs ({main_per_month} main pushes, {pr_per_month} PRs):"
    )
    print(f"    Current config + current shards:  ${monthly_current:.2f}")
    print(f"    Current config + optimal shards:  ${monthly_optimal_same:.2f}")
    print(f"    New config     + optimal shards:  ${monthly_optimal_new:.2f}")
    print(
        f"    Monthly savings (new+optimal vs current): "
        f"${monthly_current - monthly_optimal_new:.2f} "
        f"({(1 - monthly_optimal_new / monthly_current) * 100:.0f}%)"
    )


if __name__ == "__main__":
    main()
