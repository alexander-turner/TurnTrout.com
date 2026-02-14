#!/usr/bin/env python3
"""Stop hook: verifies CI checks pass before allowing Claude to complete.

Outputs JSON to stdout:
  {"decision": "approve"}               — all checks passed (or retries exhausted)
  {"decision": "block", "reason": "…"}  — checks failed, Claude should keep fixing

Tracks retry attempts via a temp file keyed on the project directory hash.
Gives up after MAX_STOP_RETRIES (default 3) to prevent infinite token burn.
The retry counter is reset on each new session by session-setup.sh.
"""

from __future__ import annotations

import json
import os
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


def _run_check(name: str, cmd: list[str]) -> tuple[bool, str]:
    """
    Run a check command.

    Returns (passed, output).
    """
    print(f"Running {name}...", file=sys.stderr)
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode == 0:
        return True, ""
    output = result.stdout + result.stderr
    return False, f"=== {name} ===\n{output}\n"


def _pluralize(n: int, word: str) -> str:
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


def _read_attempt(retry_file: Path) -> int:
    """Read and increment the attempt counter from the retry file."""
    attempt = 1
    if retry_file.exists():
        try:
            attempt = int(retry_file.read_text(encoding="utf-8").strip()) + 1
        except (ValueError, OSError):
            attempt = 1
    retry_file.write_text(str(attempt), encoding="utf-8")
    return attempt


def _collect_node_checks(failures: list[str], outputs: list[str]) -> None:
    """Run Node.js checks if package.json exists."""
    pkg_path = Path("package.json")
    if not pkg_path.exists():
        return
    pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
    checks = [("test", "tests"), ("lint", "lint"), ("check", "typecheck")]
    for script, label in checks:
        if _has_script(pkg, script):
            passed, output = _run_check(label, ["pnpm", script])
            if not passed:
                failures.append(label)
                outputs.append(output)


def _collect_python_checks(failures: list[str], outputs: list[str]) -> None:
    """Run Python checks if pyproject.toml or uv.lock exists."""
    has_pyproject = Path("pyproject.toml").exists()
    has_uvlock = Path("uv.lock").exists()
    if not (has_pyproject or has_uvlock):
        return
    prefix = ["uv", "run"] if has_uvlock and shutil.which("uv") else []
    if prefix or shutil.which("ruff"):
        passed, output = _run_check("ruff", [*prefix, "ruff", "check", "."])
        if not passed:
            failures.append("ruff")
            outputs.append(output)
    elif has_pyproject:
        print("Warning: ruff not found, skipping lint", file=sys.stderr)
    if Path("tests").is_dir() and (prefix or shutil.which("pytest")):
        passed, output = _run_check("pytest", [*prefix, "pytest"])
        if not passed:
            failures.append("pytest")
            outputs.append(output)


def _emit_result(
    failures: list[str],
    outputs: list[str],
    attempt: int,
    max_retries: int,
    retry_file: Path,
) -> None:
    """Print the JSON decision to stdout."""
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


def main() -> None:
    """Run CI checks and emit a JSON decision to stdout."""
    max_retries = _get_max_retries()
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
    os.chdir(project_dir)

    retry_file = _retry_file(project_dir)
    attempt = _read_attempt(retry_file)

    failures: list[str] = []
    outputs: list[str] = []
    _collect_node_checks(failures, outputs)
    _collect_python_checks(failures, outputs)
    _emit_result(failures, outputs, attempt, max_retries, retry_file)


if __name__ == "__main__":
    main()
