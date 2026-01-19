#!/usr/bin/env python3
"""
Pretty-print progress bars for all pre-push checks.

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
import signal
import socket
import subprocess
import sys
import threading
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Collection, Deque, Sequence, TextIO

import psutil
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TaskID, TextColumn

console = Console()
SERVER_START_WAIT_TIME: int = 90

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


# pylint: disable=missing-class-docstring
@dataclass(slots=True, frozen=True)
class ServerInfo:
    pid: int
    created_by_script: bool


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


class ServerManager:
    """Manages the quartz server process and handles cleanup on interrupts."""

    _server_pid: int | None = None
    _is_server_created_by_script: bool = False

    def __init__(self):
        # Set up signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, _: int, __: object) -> None:
        """Handle interrupt signals by cleaning up server and exiting."""
        console.log("\n[yellow]Received interrupt signal.[/yellow]")
        self.cleanup()
        sys.exit(1)

    def handle_signal(self, sig: int) -> None:
        """Public method to handle signals (for testing)."""
        self._signal_handler(sig, None)

    def set_server_pid(self, pid: int, created_by_script: bool = False) -> None:
        """
        Set the server PID to track for cleanup.

        Args:
            pid: The PID of the server
            created_by_script: Whether the server was created by this script
        """
        self._server_pid = pid
        self._is_server_created_by_script = created_by_script

    def cleanup(self) -> None:
        """Clean up the server if it exists and was created by this script."""
        if self._server_pid is not None and self._is_server_created_by_script:
            console.log("[yellow]Cleaning up quartz server...[/yellow]")
            kill_process(self._server_pid)
        self._server_pid = None
        self._is_server_created_by_script = False


def is_port_in_use(port: int) -> bool:
    """Check if a port is in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0


def find_quartz_process() -> int | None:
    """
    Find the PID of any running quartz server.

    Returns None if no quartz process is found.
    """
    for proc in psutil.process_iter(["pid", "name", "cmdline"]):
        try:
            cmdline = proc.info.get("cmdline")
            if cmdline is None or len(cmdline) < 2:
                continue

            # Check if this is a "pnpm dev" process (how quartz is started)
            if cmdline[0] == "pnpm" and cmdline[1] == "dev":
                return proc.pid
        except (psutil.NoSuchProcess, psutil.AccessDenied):  # pragma: no cover
            continue
    return None


def kill_process(pid: int) -> None:
    """Safely terminate a process and its children."""
    try:
        process = psutil.Process(pid)
        try:
            process.terminate()
            process.wait(timeout=3)
        except psutil.TimeoutExpired:
            process.kill()  # Force kill if still alive
    except psutil.NoSuchProcess:
        # Process already terminated, nothing to do
        pass


def create_server(git_root_path: Path) -> ServerInfo:
    """
    Create a quartz server or use an existing one.

    Returns:
        ServerInfo with:
            - pid: The PID of the server to use
            - created_by_script: True if the server was created by this script
    """
    # First check if there's already a quartz process running
    existing_pid = find_quartz_process()
    if existing_pid:
        msg = (
            f"[green]Using existing quartz server (PID: {existing_pid})[/green]"
        )
        console.log(msg)
        return ServerInfo(existing_pid, False)

    # If no existing process found, check if the port is in use
    if is_port_in_use(8080):
        console.log(
            "[yellow]Port 8080 is in use but no quartz process "
            "found. Starting new server...[/yellow]"
        )

    # Start new server
    console.log("Starting new quartz server...")
    pnpm_path = shutil.which("pnpm") or "pnpm"
    with Progress(
        SpinnerColumn(),
        TextColumn(" {task.description}"),
        console=console,
        expand=True,
    ) as progress:
        # pylint: disable=consider-using-with
        new_server = subprocess.Popen(
            [pnpm_path, "dev"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=git_root_path,
            start_new_session=True,
        )
        server_pid = new_server.pid
        task_id = progress.add_task("", total=None)

        # Poll until the server is ready
        for i in range(SERVER_START_WAIT_TIME):
            if is_port_in_use(8080):
                progress.remove_task(task_id)
                progress.stop()
                console.log("[green]Quartz server successfully started[/green]")
                return ServerInfo(server_pid, True)
            progress.update(
                task_id,
                description=(
                    f"Waiting for server to start... "
                    f"({i + 1}/{SERVER_START_WAIT_TIME})"
                ),
                visible=True,
            )
            time.sleep(1)

        kill_process(server_pid)
        raise RuntimeError(
            f"Server failed to start after {SERVER_START_WAIT_TIME} seconds"
        )


@dataclass
class CheckStep:
    """A step in the pre-push check process."""

    name: str
    command: Sequence[str]
    shell: bool = False
    cwd: str | None = None
    interactive: bool = False


class CheckFailedError(Exception):
    def __init__(self, step_name: str, stdout: str = "", stderr: str = ""):
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

                # Special message for alt-text scan failures
                if "alt text" in step.name:
                    console.print(
                        "\n[yellow]Please add alt text to all images before pushing.[/yellow]"
                    )
                    console.print(
                        f"[cyan]Run:[/cyan] fish {_GIT_ROOT}/scripts/label_alt_text.fish\n"
                    )

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
        stdout_thread.start()
        stdout_thread.join()

        stderr_thread = threading.Thread(
            target=stream_reader,
            args=(process.stderr, stderr_lines, last_lines, progress, task_id),
        )
        stderr_thread.start()
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


def get_check_steps(
    git_root_path: Path,
) -> tuple[list[CheckStep], list[CheckStep]]:
    """
    Get the check steps for pre-server and post-server phases.

    Isolating this allows for better testing and configuration management.
    """
    script_files = glob.glob(f"{git_root_path}/scripts/*.py")

    steps_before_server = [
        CheckStep(
            name="Typechecking Python",
            command=[
                "uv",
                "run",
                "python",
                "-m",
                "mypy",
                "--config-file",
                f"{git_root_path}/config/python/mypy.ini",
            ]
            + script_files,
        ),
        CheckStep(
            name="Typechecking TypeScript",
            command=[
                "pnpm",
                "exec",
                "tsc",
                "--noEmit",
                "-p",
                "config/typescript/tsconfig.json",
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
        CheckStep(  # Reduce chance of pylint errors by formatting docstrings
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
            name="Linting Python",
            command=[
                "uv",
                "run",
                "python",
                "-m",
                "pylint",
                str(git_root_path),
                "--rcfile",
                f"{git_root_path}/config/python/.pylintrc",
            ],
        ),
        CheckStep(
            name="Linting prose",
            command=[
                "vale",
                "--config",
                f"{git_root_path}/config/vale/.vale.ini",
                f"{git_root_path}/website_content",
            ],
            interactive=True,
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
            name="DeepSource CLI (not blocking)",
            command=["deepsource", "issues", "list"],
        ),
        CheckStep(
            name="Running Javascript unit tests",
            command=["pnpm", "test"],
        ),
        CheckStep(
            name="Running Python unit tests",
            command=[
                "uv",
                "run",
                "python",
                "-m",
                "pytest",
                f"{git_root_path}/scripts",
                "--cov-fail-under=100",
                "--config-file",
                f"{git_root_path}/config/python/pyproject.toml",
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
        ),
        CheckStep(
            name="Checking source files",
            command=[
                "uv",
                "run",
                "python",
                f"{git_root_path}/scripts/source_file_checks.py",
            ],
        ),
        CheckStep(
            name="Scanning for images without alt text",
            command=["alt-text-llm", "scan"],
            shell=True,  # skipcq: BAN-B604
        ),
    ]

    steps_after_server = [
        # skipcq: BAN-B604
        CheckStep(
            name="Checking built CSS for unknown CSS variables",
            command=[
                "fish",
                f"{git_root_path}/scripts/check_css_vars.fish",
            ],
            # skipcq: BAN-B604 (a local command, assume safe)
            shell=True,
        ),
        CheckStep(
            name="Checking HTML files",
            command=[
                "uv",
                "run",
                "python",
                f"{git_root_path}/scripts/built_site_checks.py",
            ],
        ),
        # skipcq: BAN-B604
        CheckStep(
            name="Spellchecking",  # Goes late in case we modify spelling earlier
            command=["fish", f"{git_root_path}/scripts/spellchecker.fish"],
            # skipcq: BAN-B604 (a local command, assume safe)
            shell=True,
            interactive=True,
        ),
        # skipcq: BAN-B604
        CheckStep(
            name="Checking link validity",
            command=["fish", f"{git_root_path}/scripts/linkchecker.fish"],
            # skipcq: BAN-B604 (a local command, assume safe)
            shell=True,
            interactive=True,
        ),
    ]

    return steps_before_server, steps_after_server


def main() -> int:
    """Run all checks before pushing."""
    parser = argparse.ArgumentParser(
        description="Run pre-push checks with progress bars."
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from last successful check",
    )
    args = parser.parse_args()

    server_manager = ServerManager()
    stash_created = False

    git_path = shutil.which("git") or "git"
    try:
        # Stash any uncommitted changes
        stash_result = subprocess.run(
            [
                git_path,
                "stash",
                "push",
                "-u",
                "-m",
                "run_push_checks auto-stash",
            ],
            cwd=_GIT_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        # Check if stash was actually created (output won't contain "No local changes")
        if "No local changes" not in stash_result.stdout:
            stash_created = True
            console.log("[cyan]Stashed uncommitted changes[/cyan]")

        steps_before_server, steps_after_server = get_check_steps(_GIT_ROOT)
        all_steps = steps_before_server + steps_after_server
        all_step_names = [step.name for step in all_steps]

        # Validate resume state
        if args.resume:
            last_step = get_last_step(all_step_names)
            if last_step is None:
                console.log(
                    "[yellow]No valid resume point found. "
                    "Starting from beginning.[/yellow]"
                )
                args.resume = False

        # Run pre-server checks if needed
        if not args.resume:
            run_checks(steps_before_server, args.resume)
        else:
            last_step = get_last_step(all_step_names)
            pre_server_names = {step.name for step in steps_before_server}

            if last_step and last_step in pre_server_names:
                run_checks(steps_before_server, args.resume)
            else:
                for step in steps_before_server:
                    console.log(f"[grey]Skipping step: {step.name}[/grey]")

        server_info = create_server(_GIT_ROOT)
        server_manager.set_server_pid(
            server_info.pid, server_info.created_by_script
        )
        run_checks(steps_after_server, args.resume)

        console.log("\n[green]All checks passed successfully! 🎉[/green]")
        reset_saved_progress()
        return 0

    except CheckFailedError:
        # Error output already printed in run_checks, just return error code
        return 1
    except KeyboardInterrupt:
        console.log("\n[yellow]Process interrupted by user.[/yellow]")
        return 130  # Standard exit code for SIGINT
    finally:
        server_manager.cleanup()
        # Restore stashed changes if we created a stash
        if stash_created:
            subprocess.run(
                [git_path, "stash", "pop"],
                cwd=_GIT_ROOT,
                capture_output=True,
                text=True,
                check=True,
            )
            console.log("[cyan]Restored stashed changes[/cyan]")


if __name__ == "__main__":
    sys.exit(main())
