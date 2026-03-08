#!/usr/bin/env python3
"""Stop hook: verifies local and remote CI checks pass before completing.

Outputs JSON to stdout:
  {"decision": "approve"}               — all checks passed (or retries exhausted)
  {"decision": "block", "reason": "…"}  — checks failed, Claude should keep fixing

Checks:
  1. Local: pnpm test/lint/check, ruff, pytest
  2. Remote: GitHub Actions status for the last pushed commit (if any)

Tracks retry attempts via a temp file keyed on the project directory hash.
Gives up after MAX_STOP_RETRIES (default 3) to prevent infinite token burn.
The retry counter is reset on each new session by session-setup.sh.
"""

from __future__ import annotations

import json
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
from hashlib import sha256
from pathlib import Path


def _get_max_retries() -> int:
    return int(os.environ.get("MAX_STOP_RETRIES", "3"))


def _retry_file(project_dir: str) -> Path:
    """Return a stable path for the retry counter, keyed on project dir."""
    dir_hash = sha256(project_dir.encode()).hexdigest()[:16]
    return Path(tempfile.gettempdir()) / f"claude-stop-attempts-{dir_hash}"


def _has_script(pkg: dict, name: str) -> bool:
    """Check if a package.json script exists and isn't a placeholder."""
    script = pkg.get("scripts", {}).get(name, "")
    return bool(script) and "ERROR: Configure" not in script


def _run_check(name: str, cmd: str) -> tuple[bool, str]:
    """
    Run a check command.

    Returns (passed, output).
    """
    result = subprocess.run(
        shlex.split(cmd), capture_output=True, text=True, check=False
    )
    if result.returncode == 0:
        return True, ""
    output = result.stdout + result.stderr
    return False, f"=== {name} FAILED ===\n{output}\n"


def _pluralize(n: int, word: str) -> str:
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


def _check_nodejs(check_fn) -> None:
    """Run Node.js checks (test, lint, typecheck)."""
    pkg_path = Path("package.json")
    if not pkg_path.exists():
        return
    pkg = json.loads(pkg_path.read_text())
    checks = [("test", "tests"), ("lint", "lint"), ("check", "typecheck")]
    for script, label in checks:
        if _has_script(pkg, script):
            check_fn(label, f"pnpm {script}")


def _check_python(check_fn) -> None:
    """Run Python checks (ruff, pytest)."""
    has_pyproject = Path("pyproject.toml").exists()
    has_uvlock = Path("uv.lock").exists()
    if not (has_pyproject or has_uvlock):
        return

    prefix = "uv run " if has_uvlock and shutil.which("uv") else ""
    if prefix or shutil.which("ruff"):
        check_fn("ruff", f"{prefix}ruff check .")
    elif has_pyproject:
        print("Warning: ruff not found, skipping lint", file=sys.stderr)

    if Path("tests").is_dir() and (prefix or shutil.which("pytest")):
        check_fn("pytest", f"{prefix}pytest")


def _read_push_marker() -> tuple[str, str] | None:
    """
    Read commit SHA and branch from the push marker file.

    Returns (commit, branch) or None if the marker is missing/empty.
    """
    push_file = Path(tempfile.gettempdir()) / "claude-last-push-commit"
    if not push_file.exists():
        return None

    lines = push_file.read_text().strip().splitlines()
    if not lines or not lines[0]:
        return None
    return lines[0], lines[1] if len(lines) > 1 else ""


def _resolve_branch(branch: str) -> str:
    """Resolve the current git branch if not already known."""
    if branch:
        return branch
    git_path = shutil.which("git") or "git"
    result = subprocess.run(
        [git_path, "rev-parse", "--abbrev-ref", "HEAD"],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout.strip()


def _fetch_workflow_runs(
    gh_path: str, repo_args: list[str], branch: str, commit: str
) -> list[dict] | None:
    """
    Fetch GitHub Actions workflow runs for a commit.

    Returns None on error.
    """
    result = subprocess.run(
        [
            gh_path,
            "run",
            "list",
            *repo_args,
            "--branch",
            branch,
            "--commit",
            commit,
            "--json",
            "name,status,conclusion",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        print(f"Warning: gh run list failed: {result.stderr}", file=sys.stderr)
        return None
    try:
        return json.loads(result.stdout) or None
    except json.JSONDecodeError:
        return None


def _build_repo_args() -> list[str]:
    """Build ``--repo`` flag from ``GH_REPO`` env var (set by session-
    setup.sh)."""
    gh_repo = os.environ.get("GH_REPO", "")
    return ["--repo", gh_repo] if gh_repo else []


def _evaluate_runs(
    runs: list[dict], failures: list[str], outputs: list[str]
) -> None:
    """Evaluate workflow runs and append failures if any are incomplete or
    failed."""
    in_progress = [r for r in runs if r.get("status") != "completed"]
    if in_progress:
        names = ", ".join(r["name"] for r in in_progress)
        failures.append("remote-ci")
        outputs.append(
            f"=== remote-ci FAILED ===\n"
            f"GitHub Actions still running: {names}\n"
        )
        return

    failed = [
        r for r in runs if r.get("conclusion") not in ("success", "skipped")
    ]
    if failed:
        names = ", ".join(r["name"] for r in failed)
        failures.append("remote-ci")
        outputs.append(
            f"=== remote-ci FAILED ===\n" f"GitHub Actions failed: {names}\n"
        )


def _check_remote_ci(failures: list[str], outputs: list[str]) -> None:
    """
    Check GitHub Actions status for the last pushed commit.

    The PostToolUse hook (post-push-ci-watch.sh) writes the pushed commit SHA
    and branch to /tmp/claude-last-push-commit. If that file exists, we check
    whether all workflow runs for that commit have passed.

    NOTE: This appends directly to failures/outputs instead of using check_fn,
    because _run_check uses subprocess without shell=True — shell operators
    like && don't work, so "echo ... && exit 1" would always succeed.
    """
    marker = _read_push_marker()
    if not marker:
        return
    commit, branch = marker

    if not shutil.which("gh"):
        print(
            "Warning: gh CLI not found, skipping remote CI check",
            file=sys.stderr,
        )
        return

    branch = _resolve_branch(branch)
    if not branch or branch == "HEAD":
        return

    gh_path = shutil.which("gh") or "gh"
    runs = _fetch_workflow_runs(gh_path, _build_repo_args(), branch, commit)
    if not runs:
        return

    _evaluate_runs(runs, failures, outputs)


def main() -> None:
    max_retries = _get_max_retries()
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
    os.chdir(project_dir)

    # --- Retry tracking ---
    retry_file = _retry_file(project_dir)
    attempt = 1
    if retry_file.exists():
        try:
            attempt = int(retry_file.read_text().strip()) + 1
        except (ValueError, OSError):
            attempt = 1
    retry_file.write_text(str(attempt))

    # --- Collect checks to run ---
    failures: list[str] = []
    outputs: list[str] = []

    def check(name: str, cmd: str) -> None:
        passed, output = _run_check(name, cmd)
        if not passed:
            failures.append(name)
            outputs.append(output)

    _check_nodejs(check)
    _check_python(check)
    _check_remote_ci(failures, outputs)

    # --- Produce result ---
    if not failures:
        retry_file.unlink(missing_ok=True)
        print(json.dumps({"decision": "approve"}))
        return

    failed_str = ", ".join(failures)

    if attempt >= max_retries:
        retry_file.unlink(missing_ok=True)
        attempts = _pluralize(attempt, "attempt")
        print(
            f"WARNING: Giving up after {attempts}. Failures remain: {failed_str}",
            file=sys.stderr,
        )
        print(
            json.dumps(
                {
                    "decision": "approve",
                    "reason": (
                        f"Approved despite failures after {attempts}. "
                        f"Remaining: {failed_str}\nHuman review needed."
                    ),
                }
            )
        )
        return

    output_text = "\n".join(outputs)
    print(
        json.dumps(
            {
                "decision": "block",
                "reason": (
                    f"CI failed (attempt {attempt}/{max_retries}): "
                    f"{', '.join(f'{f} failed' for f in failures)}."
                    f"\n\n{output_text}"
                ),
            }
        )
    )


if __name__ == "__main__":
    main()
