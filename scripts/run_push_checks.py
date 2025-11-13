#!/usr/bin/env python3
"""Pretty-print progress bars for all pre-push checks."""

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
from typing import Collection, Deque, Sequence, TextIO, Tuple

import psutil
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TaskID, TextColumn
from rich.style import Style

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
@dataclass
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
            err_console.print(f"No 'last_successful_step' key in {STATE_FILE_PATH}")
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
            if cmdline is not None and any("quartz" in cmd.lower() for cmd in cmdline):
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
        console.log(
            "[green]Using existing quartz server " f"(PID: {existing_pid})[/green]"
        )
        return ServerInfo(existing_pid, False)

    # If no existing process found, check if the port is in use
    if is_port_in_use(8080):
        console.log(
            "[yellow]Port 8080 is in use but no quartz process "
            "found. Starting new server...[/yellow]"
        )

    # Start new server
    console.log("Starting new quartz server...")
    npx_path = shutil.which("npx") or "npx"
    with Progress(
        SpinnerColumn(),
        TextColumn(" {task.description}"),
        console=console,
        expand=True,
    ) as progress:
        # pylint: disable=consider-using-with
        new_server = subprocess.Popen(
            [npx_path, "quartz", "build", "--serve"],
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


def run_checks(steps: Sequence[CheckStep], resume: bool = False) -> None:
    """
    Run a sequence of check steps and handle their output.

    Args:
        steps: Sequence of check steps to run
        resume: Whether to resume from last successful step
    """
    step_names = [step.name for step in steps]
    # Validate against current phase's steps
    last_step = get_last_step(step_names if resume else None)
    should_skip = bool(resume and last_step)

    with Progress(
        SpinnerColumn(),
        TextColumn(" {task.description}"),  # Add leading space for alignment
        console=console,
        expand=True,  # Allow the progress bar to use full width
    ) as progress:
        for step in steps:
            if should_skip:
                console.log(f"[grey]Skipping step: {step.name}[/grey]")
                if step.name == last_step:
                    should_skip = False
                continue

            # Create two tasks - one for the step name and one for output
            name_task = progress.add_task(f"[cyan]{step.name}...", total=None)
            # Hidden until we have output
            output_task = progress.add_task("", total=None, visible=False)

            success, stdout, stderr = run_command(step, progress, output_task)
            progress.remove_task(name_task)
            progress.remove_task(output_task)

            if success:
                console.log(f"[green]✓[/green] {step.name}")
                save_state(step.name)
            else:
                console.log(f"[red]✗[/red] {step.name}")
                console.log("\n[bold red]Error output:[/bold red]")
                if stdout:
                    console.log(stdout)
                if stderr:
                    console.log(stderr, style=Style(color="red"))
                sys.exit(1)


def run_interactive_command(
    step: CheckStep, progress: Progress, task_id: TaskID
) -> Tuple[bool, str, str]:
    """
    Run an interactive command that requires direct terminal access.

    Args:
        step: The command step to run
        progress: Progress bar instance
        task_id: Task ID for updating progress

    Returns:
        Tuple of (success, stdout, stderr)
    """
    # Hide progress display during interactive process
    progress.update(task_id, visible=False)
    try:
        # skipcq: BAN-B602
        subprocess.run(
            " ".join(step.command) if step.shell else step.command,
            # skipcq: BAN-B602 (a local command, assume safe)
            shell=step.shell,
            cwd=step.cwd,
            check=True,
        )
        return True, "", ""
    except subprocess.CalledProcessError as e:
        return False, "", f"Command failed with exit code {e.returncode}"


def run_command(
    step: CheckStep, progress: Progress, task_id: TaskID
) -> Tuple[bool, str, str]:
    """
    Run a command and return success status and output.

    Shows real-time output for steps while suppressing server output.
    Returns:
        Tuple of (success, stdout, stderr) where success is a boolean and
        stdout/stderr are strings containing the complete output.
    """
    if any(
        task in str(step.command) for task in ["spellchecker", "linkchecker", "vale"]
    ):
        return run_interactive_command(step, progress, task_id)

    try:
        # skipcq: BAN-B602
        with subprocess.Popen(
            " ".join(step.command) if step.shell else step.command,
            # skipcq: BAN-B602 (a local command, assume safe)
            shell=step.shell,
            cwd=step.cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        ) as process:
            stdout_lines: list[str] = []
            stderr_lines: list[str] = []
            last_lines: Deque[str] = deque(maxlen=5)

            def stream_reader(stream: TextIO, lines_list: list[str]) -> None:
                for line in iter(stream.readline, ""):
                    lines_list.append(line)
                    last_lines.append(line.rstrip())
                    # Update progress display with last lines
                    progress.update(
                        task_id,
                        description="\n".join(last_lines),
                        visible=True,
                    )

            stdout_thread = threading.Thread(
                target=stream_reader, args=(process.stdout, stdout_lines)
            )
            stderr_thread = threading.Thread(
                target=stream_reader, args=(process.stderr, stderr_lines)
            )

            stdout_thread.start()
            stderr_thread.start()
            stdout_thread.join()
            stderr_thread.join()

            return_code = process.wait()

            # Clear the output task after completion
            progress.update(task_id, visible=False)

            stdout = "".join(stdout_lines)
            stderr = "".join(stderr_lines)

            return return_code == 0, stdout, stderr

    except subprocess.CalledProcessError as e:  # pragma: no cover
        return False, e.stdout or "", e.stderr or ""


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
                "python",
                "-m",
                "mypy",
            ]
            + script_files,
        ),
        CheckStep(
            name="Typechecking TypeScript",
            command=[
                "npx",
                "tsc",
                "--noEmit",
                "-p",
                "config/typescript/tsconfig.json",
            ],
        ),
        CheckStep(
            name="Linting TypeScript",
            command=[
                "npx",
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
        ),
        CheckStep(
            name="Cleaning up SCSS",
            command=[
                "npx",
                "stylelint",
                "--config",
                "config/stylelint/.stylelintrc.json",
                "--fix",
                "quartz/**/*.scss",
            ],
        ),
        # skipcq: BAN-B604
        CheckStep(
            name="Spellchecking",
            command=["fish", f"{git_root_path}/scripts/spellchecker.fish"],
            # skipcq: BAN-B604 (a local command, assume safe)
            shell=True,
        ),
        CheckStep(
            name="Running Javascript unit tests",
            command=["npm", "run", "test"],
        ),
        CheckStep(
            name="Running Python unit tests",
            command=[
                "python",
                "-m",
                "pytest",
                f"{git_root_path}/scripts",
                "-n",
                "auto",
                "--cov=scripts",
                "--cov-report=html",
                "--cov-fail-under=100",
            ],
        ),
        # skipcq: BAN-B604
        CheckStep(
            name="Compressing and uploading local assets",
            command=[
                "bash",
                f"{git_root_path}/scripts/handle_local_assets.sh",
            ],
            # skipcq: BAN-B604 (a local command, assume safe)
            shell=True,
        ),
        CheckStep(
            name="Checking source files",
            command=[
                "python",
                f"{git_root_path}/scripts/source_file_checks.py",
            ],
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
                "python",
                f"{git_root_path}/scripts/built_site_checks.py",
            ],
        ),
        # skipcq: BAN-B604
        CheckStep(
            name="Checking link validity",
            command=["fish", f"{git_root_path}/scripts/linkchecker.fish"],
            # skipcq: BAN-B604 (a local command, assume safe)
            shell=True,
        ),
    ]

    return steps_before_server, steps_after_server


def main() -> None:
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

    try:
        steps_before_server, steps_after_server = get_check_steps(_GIT_ROOT)
        all_steps = steps_before_server + steps_after_server
        all_step_names = [step.name for step in all_steps]

        # Validate the last step exists in our known steps
        last_step = get_last_step(all_step_names if args.resume else None)
        if args.resume and last_step is None:
            # If resuming but no valid last step found, start from beginning
            console.log(
                "[yellow]No valid resume point found. "
                "Starting from beginning.[/yellow]"
            )
            args.resume = False

        # Determine if we need to run pre-server steps
        should_run_pre = (
            not args.resume
            or not last_step
            or last_step in {step.name for step in steps_before_server}
        )

        if should_run_pre:
            run_checks(steps_before_server, args.resume)
        else:
            for step in steps_before_server:
                console.log(f"[grey]Skipping step: {step.name}[/grey]")

        server_info = create_server(_GIT_ROOT)
        server_manager.set_server_pid(server_info.pid, server_info.created_by_script)
        run_checks(steps_after_server, args.resume)

        console.log("\n[green]All checks passed successfully! 🎉[/green]")
        reset_saved_progress()

    except KeyboardInterrupt:
        console.log("\n[yellow]Process interrupted by user.[/yellow]")
        raise
    finally:
        server_manager.cleanup()


if __name__ == "__main__":
    main()
