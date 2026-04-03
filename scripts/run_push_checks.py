#!/usr/bin/env python3
"""
Pretty-print progress bars for all pre-push checks.

Runs only tasks unique to local execution — auto-fixing formatters and
tasks that require local credentials or tools not available in CI.

Expected environment variables (used by scripts this orchestrates):
    - ACCESS_KEY_ID_TURNTROUT_MEDIA (for R2 upload via handle_local_assets.sh)
    - SECRET_ACCESS_TURNTROUT_MEDIA (for R2 upload via handle_local_assets.sh)
    - S3_ENDPOINT_ID_TURNTROUT_MEDIA (for R2 upload via handle_local_assets.sh)
"""

import argparse
import glob
import json
import os
import shutil
import subprocess
import sys
import threading
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Collection, Deque, Sequence, TextIO

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TaskID, TextColumn

console = Console()

# Compute git root once at module load time
_GIT_ROOT = Path(
    subprocess.check_output(
        [shutil.which("git") or "git", "rev-parse", "--show-toplevel"],
        text=True,
    ).strip()
)

# Store state in git root instead of /tmp so it persists across reboots
STATE_DIR = _GIT_ROOT / ".quartz_checks"
os.makedirs(STATE_DIR, exist_ok=True)
STATE_FILE_PATH = STATE_DIR / "progress.json"


def save_state(step_name: str) -> None:
    """Save the last successful step."""
    state = {"last_successful_step": step_name}
    with open(STATE_FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f)


def get_last_step(
    available_steps: Collection[str] | None = None,
) -> str | None:
    """
    Get the name of the last successful step.

    Args:
        available_steps: Optional collection of valid step names. If provided,
                         validates that the last step is in this collection.

    Returns:
        The name of the last successful step, or None if no state exists
        or validation fails.
    """
    # Create stderr console for error messages
    err_console = Console(stderr=True)

    if not STATE_FILE_PATH.exists():
        return None

    try:
        with open(STATE_FILE_PATH, encoding="utf-8") as f:
            state = json.load(f)

        last_step = state.get("last_successful_step")
        if last_step is None:
            error_msg = f"No 'last_successful_step' key in {STATE_FILE_PATH}"
            err_console.print(error_msg)
            return None

        if available_steps is not None and last_step not in available_steps:
            err_console.print(
                f"Last successful step '{last_step}' not in available steps"
            )
            return None

        return last_step
    except json.JSONDecodeError:
        err_console.print(f"Error parsing JSON in {STATE_FILE_PATH}")
    return None


# pylint: disable=missing-function-docstring
def reset_saved_progress() -> None:
    print("Clearing state")
    if STATE_FILE_PATH.exists():
        STATE_FILE_PATH.unlink()


@dataclass
class CheckStep:
    """A step in the pre-push check process."""

    name: str
    command: Sequence[str]
    shell: bool = False
    cwd: str | None = None
    interactive: bool = False
    requires: str | None = None
    """External tool that must be on PATH; step is skipped with a warning if
    missing."""


class CheckFailedError(Exception):
    """Raised when a check step fails during pre-push validation."""

    def __init__(
        self, step_name: str, stdout: str = "", stderr: str = ""
    ) -> None:
        self.step_name = step_name
        self.stdout = stdout
        self.stderr = stderr
        super().__init__(f"Check failed: {step_name}")


def run_checks(steps: Sequence[CheckStep], resume: bool = False) -> None:
    """
    Run a sequence of check steps and handle their output.

    Args:
        steps: Sequence of check steps to run
        resume: Whether to resume from last successful step
    """
    step_names = [step.name for step in steps]
    last_step = get_last_step(step_names if resume else None)
    should_skip = bool(resume and last_step)

    with Progress(
        SpinnerColumn(),
        TextColumn(" {task.description}"),
        console=console,
        expand=True,
    ) as progress:
        for step in steps:
            if should_skip:
                console.log(f"[grey]Skipping step: {step.name}[/grey]")
                if step.name == last_step:
                    should_skip = False
                continue

            if step.requires and not shutil.which(step.requires):
                console.print(
                    f"[yellow]⚠ Skipping {step.name}: "
                    f"{step.requires} not installed[/yellow]"
                )
                continue

            name_task = progress.add_task(f"[cyan]{step.name}...", total=None)
            output_task = progress.add_task("", total=None, visible=False)

            result = run_command(step, progress, output_task)
            progress.remove_task(name_task)
            progress.remove_task(output_task)

            if not result.success:
                console.print(f"[red]✗[/red] {step.name}")
                console.print("\n[bold red]Error output:[/bold red]")
                if result.stdout:
                    console.print("[yellow]stdout:[/yellow]")
                    console.print(result.stdout, markup=False, highlight=False)
                if result.stderr:
                    console.print("[yellow]stderr:[/yellow]")
                    console.print(result.stderr, markup=False, highlight=False)

                raise CheckFailedError(step.name, result.stdout, result.stderr)
            console.log(f"[green]✓[/green] {step.name}")
            commit_step_changes(_GIT_ROOT, step.name)
            save_state(step.name)


def stream_reader(
    stream: TextIO,
    lines_list: list[str],
    last_lines: Deque[str],
    progress: Progress,
    task_id: TaskID,
) -> None:
    """
    Read lines from a stream and update progress display.

    Args:
        stream: The stream to read from
        lines_list: List to append lines to
        last_lines: Deque to store recent lines for display
        progress: Progress bar instance
        task_id: Task ID for updating progress
    """
    for line in iter(stream.readline, ""):
        lines_list.append(line)
        last_lines.append(line.rstrip())
        progress.update(
            task_id,
            description="\n".join(last_lines),
            visible=True,
        )


@dataclass(slots=True, frozen=True)
class CommandResult:
    """Result of running a check command."""

    success: bool
    stdout: str
    stderr: str


def run_interactive_command(
    step: CheckStep, progress: Progress, task_id: TaskID
) -> CommandResult:
    """
    Run an interactive command that requires direct terminal access.

    Args:
        step: The command step to run
        progress: Progress bar instance
        task_id: Task ID for updating progress
    """
    # Hide progress display during interactive process
    progress.update(task_id, visible=False)
    cmd = " ".join(step.command) if step.shell else step.command
    # skipcq: BAN-B602
    subprocess.run(
        cmd,
        # skipcq: BAN-B602 (a local command, assume safe)
        shell=step.shell,
        cwd=step.cwd,
        check=True,
    )
    return CommandResult(success=True, stdout="", stderr="")


def run_non_interactive_command(
    step: CheckStep, progress: Progress, task_id: TaskID
) -> CommandResult:
    """
    Run a non-interactive command with output streaming.

    Args:
        step: The command step to run
        progress: Progress bar instance
        task_id: Task ID for updating progress

    Returns:
        CommandResult with success status and output
    """
    stdout_lines: list[str] = []
    stderr_lines: list[str] = []
    last_lines: Deque[str] = deque(maxlen=5)
    cmd = " ".join(step.command) if step.shell else step.command

    with subprocess.Popen(
        cmd,
        shell=step.shell,  # skipcq: BAN-B602
        cwd=step.cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    ) as process:
        stdout_thread = threading.Thread(
            target=stream_reader,
            args=(process.stdout, stdout_lines, last_lines, progress, task_id),
        )
        stderr_thread = threading.Thread(
            target=stream_reader,
            args=(process.stderr, stderr_lines, last_lines, progress, task_id),
        )
        # Start both threads before joining either to avoid deadlock:
        # if the subprocess fills the stderr pipe buffer while we're
        # blocked waiting for stdout to EOF, both sides block forever.
        stdout_thread.start()
        stderr_thread.start()
        stdout_thread.join()
        stderr_thread.join()

        return_code = process.wait()

    progress.update(task_id, visible=False)

    stdout = "".join(stdout_lines)
    stderr = "".join(stderr_lines)

    return CommandResult(success=return_code == 0, stdout=stdout, stderr=stderr)


def commit_step_changes(git_root_path: Path, step_name: str) -> None:
    """Commit any changes made by a step."""
    # Check if there are any changes
    git_path = shutil.which("git") or "git"
    result = subprocess.run(
        [git_path, "diff", "--name-only"],
        cwd=git_root_path,
        capture_output=True,
        text=True,
        check=True,
    )

    changed_files = result.stdout.strip().split("\n")
    filtered_changed_files = [f for f in changed_files if f]
    if not filtered_changed_files:
        return

    subprocess.run(
        [git_path, "add"] + filtered_changed_files,
        cwd=git_root_path,
        check=True,
        capture_output=True,
    )

    # Verify there are staged changes before attempting to commit
    staged_result = subprocess.run(
        [git_path, "diff", "--cached", "--name-only"],
        cwd=git_root_path,
        capture_output=True,
        text=True,
        check=True,
    )

    if not staged_result.stdout.strip():
        # No staged changes, nothing to commit
        return

    commit_message = f"chore: apply {step_name.lower()} fixes"
    subprocess.run(
        [git_path, "commit", "-m", commit_message],
        cwd=git_root_path,
        check=True,
        capture_output=True,
    )
    console.log(f"[green]Committed {step_name.lower()} fixes[/green]")


def run_command(
    step: CheckStep, progress: Progress, task_id: TaskID
) -> CommandResult:
    """
    Run a command and return success status and output.

    Shows real-time output for steps while suppressing server output.
    Returns:
        CommandResult with success status and output
    """
    try:
        if step.interactive:
            return run_interactive_command(step, progress, task_id)
        return run_non_interactive_command(step, progress, task_id)
    except subprocess.CalledProcessError as e:
        stdout = getattr(e, "stdout", "") or ""
        stderr = getattr(e, "stderr", "") or ""
        if not stderr:
            stderr = f"Command failed with exit code {e.returncode}"
        return CommandResult(success=False, stdout=stdout, stderr=stderr)


def get_check_steps(git_root_path: Path) -> list[CheckStep]:
    """
    Get the pre-push check steps to run locally.

    Includes cheap checks for fast feedback (type-checking, linting) and
    tasks unique to local execution: auto-fixing formatters, asset
    compression/upload, and alt-text scanning.

    Args:
        git_root_path: Path to the git repository root.
    """
    return [
        CheckStep(
            name="Linting Python",
            command=["uv", "run", "ruff", "check", str(git_root_path)],
        ),
        CheckStep(
            name="Linting TypeScript",
            command=[
                "pnpm",
                "exec",
                "eslint",
                "--fix",
                str(git_root_path),
                "--config",
                f"{git_root_path}/config/javascript/eslint.config.js",
            ],
        ),
        CheckStep(
            name="Formatting Python docstrings",
            command=[
                "uv",
                "run",
                "python",
                "-m",
                "docformatter",
                "--in-place",
                *glob.glob(f"{git_root_path}/scripts/**.py", recursive=True),
                "--config",
                f"{git_root_path}/config/python/pyproject.toml",
            ],
        ),
        CheckStep(
            name="Cleaning up SCSS",
            command=[
                "pnpm",
                "exec",
                "stylelint",
                "--config",
                f"{git_root_path}/config/stylelint/.stylelintrc.json",
                "--fix",
                f"{git_root_path}/quartz/**/*.scss",
            ],
        ),
        # skipcq: BAN-B604
        CheckStep(
            name="Compressing and uploading local assets",
            command=[
                "bash",
                f"{git_root_path}/scripts/handle_assets.sh",
            ],
            # skipcq: BAN-B604 (a local command, assume safe)
            shell=True,
            requires="rclone",
        ),
        CheckStep(
            name="Scanning for images without alt text",
            command=["alt-text-llm", "scan"],
            shell=True,  # skipcq: BAN-B604
            requires="alt-text-llm",
        ),
    ]


def main() -> int:
    """
    Run unique pre-push checks.

    Note: Stashing of uncommitted changes is handled by the calling
    pre-push hook (.hooks/pre-push), not here.
    """
    parser = argparse.ArgumentParser(
        description="Run pre-push checks with progress bars."
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from last successful check",
    )
    args = parser.parse_args()

    try:
        steps = get_check_steps(_GIT_ROOT)
        all_step_names = [step.name for step in steps]

        resume = args.resume
        if resume:
            last_step = get_last_step(all_step_names)
            if last_step is None:
                console.log(
                    "[yellow]No valid resume point found. "
                    "Starting from beginning.[/yellow]"
                )
                resume = False

        run_checks(steps, resume)

        console.log("\n[green]All checks passed successfully! 🎉[/green]")
        reset_saved_progress()
        return 0

    except CheckFailedError:
        # Error output already printed in run_checks, just return error code
        return 1
    except KeyboardInterrupt:
        console.log("\n[yellow]Process interrupted by user.[/yellow]")
        return 130  # Standard exit code for SIGINT


if __name__ == "__main__":
    sys.exit(main())
