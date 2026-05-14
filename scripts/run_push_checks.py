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
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Collection, Deque, Sequence, TextIO

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TaskID, TextColumn

# Allow direct invocation as `python scripts/run_push_checks.py`.
sys.path.append(str(Path(__file__).resolve().parent.parent))
# pylint: disable=wrong-import-position
from scripts import utils as script_utils  # noqa: E402

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
        available_steps: Collection of valid step names, or None. If provided,
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

    parallel_group: str | None = None
    """
    When set, consecutive steps with the same value run concurrently.

    None runs sequentially. Only safe for read-only checks (no autofixers).
    """


class CheckFailedError(Exception):
    """Raised when a check step fails during pre-push validation."""

    def __init__(
        self, step_name: str, stdout: str = "", stderr: str = ""
    ) -> None:
        self.step_name = step_name
        self.stdout = stdout
        self.stderr = stderr
        super().__init__(f"Check failed: {step_name}")


def _group_consecutive(steps: Sequence[CheckStep]) -> list[list[CheckStep]]:
    """
    Group consecutive steps that share the same non-None parallel_group.

    Steps with parallel_group=None each become a singleton group. Used by
    run_checks to dispatch read-only verification batches concurrently while
    keeping autofixers strictly sequential.
    """
    groups: list[list[CheckStep]] = []
    for step in steps:
        if (
            step.parallel_group is not None
            and groups
            and groups[-1][-1].parallel_group == step.parallel_group
        ):
            groups[-1].append(step)
        else:
            groups.append([step])
    return groups


def _print_failure(step_name: str, result: "CommandResult") -> None:
    """Render a failed step's stdout/stderr to the console."""
    console.print(f"[red]✗[/red] {step_name}")
    console.print("\n[bold red]Error output:[/bold red]")
    if result.stdout:
        console.print("[yellow]stdout:[/yellow]")
        console.print(result.stdout, markup=False, highlight=False)
    if result.stderr:
        console.print("[yellow]stderr:[/yellow]")
        console.print(result.stderr, markup=False, highlight=False)


def _execute_step(
    step: CheckStep, progress: Progress
) -> "CommandResult | None":
    """
    Run one CheckStep.

    Returns None if skipped (missing required tool).
    """
    if step.requires and not shutil.which(step.requires):
        console.print(
            f"[yellow]⚠ Skipping {step.name}: "
            f"{step.requires} not installed[/yellow]"
        )
        return None

    name_task = progress.add_task(f"[cyan]{step.name}...", total=None)
    output_task = progress.add_task("", total=None, visible=False)
    try:
        return run_command(step, progress, output_task)
    finally:
        progress.remove_task(name_task)
        progress.remove_task(output_task)


def _run_parallel_group(
    group: Sequence[CheckStep],
    progress: Progress,
    auto_commit: bool,
    continue_on_failure: bool,
) -> None:
    """
    Run a group of read-only check steps concurrently.

    Failures are collected so that all steps complete before raising. The first
    failure is re-raised after the group finishes (or all are logged if
    continue_on_failure is set).
    """
    console.log(
        f"[cyan]Running {len(group)} checks in parallel: "
        f"{', '.join(s.name for s in group)}[/cyan]"
    )
    results: dict[str, CommandResult | None] = {}
    with ThreadPoolExecutor(max_workers=len(group)) as pool:
        futures = {
            pool.submit(_execute_step, step, progress): step for step in group
        }
        for future in as_completed(futures):
            step = futures[future]
            results[step.name] = future.result()

    first_failure: tuple[str, CommandResult] | None = None
    for step in group:
        result = results[step.name]
        if result is None:
            continue  # Skipped (missing requires).
        if result.success:
            console.log(f"[green]✓[/green] {step.name}")
            if auto_commit:
                commit_step_changes(_GIT_ROOT, step.name)
        else:
            _print_failure(step.name, result)
            if first_failure is None:
                first_failure = (step.name, result)

    # Save state at the last step so resume picks up after the whole group.
    save_state(group[-1].name)

    if first_failure is not None and not continue_on_failure:
        name, result = first_failure
        raise CheckFailedError(name, result.stdout, result.stderr)


def run_checks(
    steps: Sequence[CheckStep],
    resume: bool = False,
    auto_commit: bool = True,
    continue_on_failure: bool = False,
) -> None:
    """
    Run a sequence of check steps and handle their output.

    Args:
        steps: Sequence of check steps to run
        resume: Whether to resume from last successful step
        auto_commit: Whether to commit any changes a step made after it
            succeeds. Disable from CI contexts that batch their own commit.
        continue_on_failure: If true, log a step failure and keep going
            instead of raising. CI autofix passes this so one unfixable
            ruff issue doesn't block Prettier/Stylelint fixes from landing.
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
        for group in _group_consecutive(steps):
            if should_skip:
                for step in group:
                    console.log(f"[grey]Skipping step: {step.name}[/grey]")
                    if step.name == last_step:
                        should_skip = False
                continue

            if len(group) > 1:
                _run_parallel_group(
                    group, progress, auto_commit, continue_on_failure
                )
                continue

            step = group[0]
            result = _execute_step(step, progress)
            if result is None:
                continue

            if not result.success:
                _print_failure(step.name, result)
                if continue_on_failure:
                    console.log(
                        f"[yellow]continuing past failure in {step.name}[/yellow]"
                    )
                    continue
                raise CheckFailedError(step.name, result.stdout, result.stderr)
            console.log(f"[green]✓[/green] {step.name}")
            if auto_commit:
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


def get_formatter_steps(git_root_path: Path) -> list[CheckStep]:
    """
    Return deterministic autofixers shared by the pre-push hook and CI.

    These are the single source of truth for "things the linter should
    fix automatically" and are invoked unchanged both by the local
    pre-push flow and by `.github/workflows/lint-and-validate.yaml`'s
    autofix job (via `--autofix-only`). Keep them idempotent and safe
    to run on a clean tree — running twice must be a no-op.

    Args:
        git_root_path: Path to the git repository root.
    """
    prettier_args = [
        "pnpm",
        "exec",
        "prettier",
        "--write",
        "--config",
        f"{git_root_path}/config/prettier/.prettierrc",
        "--ignore-path",
        f"{git_root_path}/config/prettier/.prettierignore",
    ]
    py_targets = [
        str(git_root_path / "scripts"),
        str(git_root_path / ".github" / "scripts"),
    ]
    # NB: no `ruff format` step. The pre-commit lint-staged pipeline runs
    # `black` on Python files (see package.json) and ruff's formatter
    # produces subtly different output. Running both creates an infinite
    # loop of empty autofix commits as each reformat fights the other.
    # `ruff check --fix` only touches lint issues, not layout.
    return [
        CheckStep(
            name="Linting Python",
            command=["uv", "run", "ruff", "check", "--fix", *py_targets],
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
                *glob.glob(
                    f"{git_root_path}/.github/scripts/**.py", recursive=True
                ),
                "--config",
                f"{git_root_path}/config/python/pyproject.toml",
            ],
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
        CheckStep(
            name="Formatting SCSS",
            command=[*prettier_args, f"{git_root_path}/quartz/**/*.scss"],
        ),
        CheckStep(
            name="Formatting TypeScript",
            command=[
                *prettier_args,
                f"{git_root_path}/quartz/**/*.{{js,jsx,ts,tsx}}",
            ],
        ),
        CheckStep(
            name="Formatting markdown",
            command=[
                *prettier_args,
                f"{git_root_path}/{script_utils.CONTENT_DIR_NAME}/**/*.md",
            ],
        ),
    ]


def get_check_steps(git_root_path: Path) -> list[CheckStep]:
    """
    Get the pre-push check steps to run locally.

    Includes shared autofixers from `get_formatter_steps` plus a parallel
    "verify" group of read-only checks (pylint, mypy, source-file checks,
    spellcheck+vale) that mirror CI's lint-and-validate gates so failures
    surface before main goes red. Sequential tail steps handle local-only
    work: asset compression/upload (R2) and alt-text scanning.

    Args:
        git_root_path: Path to the git repository root.
    """
    mypy_files = glob.glob(f"{git_root_path}/scripts/*.py")
    if not mypy_files and (git_root_path / "scripts").is_dir():
        raise FileNotFoundError(
            f"No Python files found in {git_root_path}/scripts/ for Mypy"
        )

    return [
        *get_formatter_steps(git_root_path),
        # source_file_checks.py imports the generated variables.scss when
        # validating font references; mirror lint-and-validate.yaml's
        # generate-variables step so the verify group has what it needs.
        CheckStep(
            name="Generate SCSS variables",
            command=[
                "pnpm",
                "exec",
                "tsx",
                "quartz/styles/generate-variables.ts",
            ],
            cwd=str(git_root_path),
        ),
        # Match python-lint.yaml CI invocation: run on `.` so the
        # ignore-paths in .pylintrc apply consistently. Listing
        # .github/scripts explicitly fails because it lacks __init__.py.
        CheckStep(
            name="Pylint",
            command=[
                "uv",
                "run",
                "python",
                "-m",
                "pylint",
                "--rcfile",
                f"{git_root_path}/config/python/.pylintrc",
                ".",
            ],
            cwd=str(git_root_path),
            parallel_group="verify",
        ),
        CheckStep(
            name="Mypy",
            command=[
                "uv",
                "run",
                "python",
                "-m",
                "mypy",
                "--config-file",
                f"{git_root_path}/config/python/mypy.ini",
                *mypy_files,
            ],
            parallel_group="verify",
        ),
        CheckStep(
            name="Source file checks",
            command=[
                "uv",
                "run",
                "python",
                "scripts/source_file_checks.py",
            ],
            cwd=str(git_root_path),
            parallel_group="verify",
        ),
        CheckStep(
            name="Spellcheck and Vale",
            command=[
                "bash",
                f"{git_root_path}/scripts/run_spellcheck_and_vale.sh",
            ],
            requires="vale",
            parallel_group="verify",
        ),
        CheckStep(
            name="Compressing and uploading local assets",
            command=[
                "bash",
                f"{git_root_path}/scripts/handle_assets.sh",
            ],
            requires="rclone",
        ),
        CheckStep(
            name="Scanning for images without alt text",
            command=["alt-text-llm", "scan"],
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
    parser.add_argument(
        "--autofix-only",
        action="store_true",
        help=(
            "Run only the shared formatter steps (no asset upload or "
            "alt-text scan). Used by the CI autofix job so local and CI "
            "autofixers stay in sync."
        ),
    )
    parser.add_argument(
        "--no-commit",
        action="store_true",
        help=(
            "Skip the per-step auto-commit. Use from CI, which makes a "
            "single consolidated commit after all steps finish."
        ),
    )
    args = parser.parse_args()

    try:
        steps = (
            get_formatter_steps(_GIT_ROOT)
            if args.autofix_only
            else get_check_steps(_GIT_ROOT)
        )
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

        # In --autofix-only (CI) mode we want every formatter to get a
        # chance to run: one unfixable ruff issue shouldn't block Prettier
        # or Stylelint fixes from being committed.
        run_checks(
            steps,
            resume,
            auto_commit=not args.no_commit,
            continue_on_failure=args.autofix_only,
        )

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
