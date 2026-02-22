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
from hashlib import sha256
from pathlib import Path


def _get_max_retries() -> int:
    return int(os.environ.get("MAX_STOP_RETRIES", "3"))


def _retry_file(project_dir: str) -> Path:
    """Return a stable path for the retry counter, keyed on project dir."""
    dir_hash = sha256(project_dir.encode()).hexdigest()[:16]
    return Path(f"/tmp/claude-stop-attempts-{dir_hash}")


def _has_script(pkg: dict, name: str) -> bool:
    """Check if a package.json script exists and isn't a placeholder."""
    script = pkg.get("scripts", {}).get(name, "")
    return bool(script) and "ERROR: Configure" not in script


def _run_check(name: str, cmd: str) -> tuple[bool, str]:
    """Run a check command. Returns (passed, output)."""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode == 0:
        return True, ""
    output = result.stdout + result.stderr
    return False, f"=== {name} FAILED ===\n{output}\n"


def _pluralize(n: int, word: str) -> str:
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


def main() -> None:
    max_retries = _get_max_retries()
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
    os.chdir(project_dir)

    # --- Retry tracking ---
    retry_file = _retry_file(project_dir)
    attempt = 1
    if retry_file.exists():
        try:
            attempt = int(retry_file.read_text(encoding="utf-8").strip()) + 1
        except (ValueError, OSError):
            attempt = 1
    retry_file.write_text(str(attempt), encoding="utf-8")

    # --- Collect checks to run ---
    failures: list[str] = []
    outputs: list[str] = []

    def check(name: str, cmd: str) -> None:
        passed, output = _run_check(name, cmd)
        if not passed:
            failures.append(name)
            outputs.append(output)

    # Node.js checks
    pkg_path = Path("package.json")
    if pkg_path.exists():
        pkg = json.loads(pkg_path.read_text())
        checks = [("test", "tests"), ("lint", "lint"), ("check", "typecheck")]
        for script, label in checks:
            if _has_script(pkg, script):
                check(label, f"pnpm {script}")

    # Python checks
    has_pyproject = Path("pyproject.toml").exists()
    has_uvlock = Path("uv.lock").exists()
    if has_pyproject or has_uvlock:
        prefix = "uv run " if has_uvlock and shutil.which("uv") else ""
        if prefix or shutil.which("ruff"):
            check("ruff", f"{prefix}ruff check .")
        elif has_pyproject:
            print("Warning: ruff not found, skipping lint", file=sys.stderr)
        if Path("tests").is_dir() and (prefix or shutil.which("pytest")):
            check("pytest", f"{prefix}pytest")

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
