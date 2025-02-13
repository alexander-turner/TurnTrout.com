#!/usr/bin/env python3
"""
Pretty-print progress bars for all pre-push checks.
"""

import argparse
import glob
import json
import shlex
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Deque, List, Optional, TextIO, Tuple

import psutil
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TaskID, TextColumn
from rich.style import Style

console = Console()


class StateManager:
    """
    Manages the state of check execution, allowing for resumption of checks.
    """

    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / "quartz_checks"
        self.state_file = self.temp_dir / "last_successful_step.json"
        self.temp_dir.mkdir(exist_ok=True)

    def save_state(self, step_name: str) -> None:
        """
        Save the last successful step.
        """
        state = {"last_successful_step": step_name}
        with open(self.state_file, "w", encoding="utf-8") as f:
            json.dump(state, f)

    def get_last_step(
        self, available_steps: Optional[List[str]] = None
    ) -> Optional[str]:
        """
        Get the name of the last successful step.

        Args:
            available_steps: Optional list of valid step names. If provided,
                           validates that the last step is in this list.

        Returns:
            The name of the last successful step, or None if no state exists
            or validation fails.
        """
        if not self.state_file.exists():
            return None
        try:
            with open(self.state_file, "r", encoding="utf-8") as f:
                state = json.load(f)
                last_step = state.get("last_successful_step")
                # Only validate if available_steps is provided
                if (
                    last_step
                    and available_steps is not None
                    and last_step not in available_steps
                ):
                    return None
                return last_step
        except (json.JSONDecodeError, KeyError):
            return None

    def clear_state(self) -> None:
        """
        Clear the saved state.
        """
        if self.state_file.exists():
            self.state_file.unlink()


class ServerManager:
    """
    Manages the quartz server process and handles cleanup on interrupts.
    """

    _server_pid: Optional[int] = None

    def __init__(self):
        # Set up signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, _: int, __: Optional[object]) -> None:
        """
        Handle interrupt signals by cleaning up server and exiting.
        """
        console.print("\n[yellow]Received interrupt signal.[/yellow]")
        self.cleanup()
        sys.exit(1)

    def set_server_pid(self, pid: int) -> None:
        """
        Set the server PID to track for cleanup.
        """
        self._server_pid = pid

    def cleanup(self) -> None:
        """
        Clean up the server if it exists.
        """
        if self._server_pid is not None:
            kill_process(self._server_pid)
            self._server_pid = None


def is_port_in_use(port: int) -> bool:
    """
    Check if a port is in use.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0


def find_quartz_process() -> Optional[int]:
    """
    Find the PID of any running quartz server.

    Returns None if no quartz process is found.
    """
    for proc in psutil.process_iter(["pid", "name", "cmdline"]):
        try:
            cmdline = proc.info.get("cmdline")
            if cmdline is not None and any(
                "quartz" in cmd.lower() for cmd in cmdline
            ):
                return proc.pid
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return None


def kill_process(pid: int) -> None:
    """
    Safely terminate a process and its children.
    """
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


def create_server(git_root_path: Path) -> int:
    """
    Create a quartz server.

    Returns the PID of the server to use.
    """
    # Use existing server if running
    if is_port_in_use(8080):
        existing_pid = find_quartz_process()
        if existing_pid:
            console.print(
                "[green]Using existing quartz server "
                f"(PID: {existing_pid})[/green]"
            )
            return existing_pid

    # Start new server
    console.print("Starting new quartz server...")
    npx_path = shutil.which("npx") or "npx"
    with (
        Progress(
            SpinnerColumn(),
            TextColumn(" {task.description}"),
            console=console,
            expand=True,
        ) as progress,
        subprocess.Popen(
            [npx_path, "quartz", "build", "--serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=git_root_path,
            start_new_session=True,
        ) as new_server,
    ):
        server_pid = new_server.pid
        task_id = progress.add_task("", total=None)

        # Wait for server to be available
        for i in range(40):
            if is_port_in_use(8080):
                console.print(
                    "[green]Quartz server successfully started[/green]"
                )
                return server_pid

            progress.update(
                task_id,
                description=f"Waiting for server to start... ({i + 1} seconds)",
                visible=True,
            )
            time.sleep(1)

        # Server failed to start
        kill_process(server_pid)
        raise RuntimeError("Server failed to start after 40 seconds")


@dataclass
class CheckStep:
    """
    A step in the pre-push check process.
    """

    name: str
    command: List[str]
    shell: bool = False
    cwd: Optional[str] = None


def run_checks(
    steps: List[CheckStep], state_manager: StateManager, resume: bool = False
) -> None:
    """
    Run a list of check steps and handle their output.

    Args:
        steps: List of check steps to run
        state_manager: StateManager instance to track progress
        resume: Whether to resume from last successful step
    """
    step_names = [step.name for step in steps]
    # Validate against current phase's steps
    last_step = state_manager.get_last_step(step_names if resume else None)
    should_skip = bool(resume and last_step)

    with Progress(
        SpinnerColumn(),
        TextColumn(" {task.description}"),  # Add leading space for alignment
        console=console,
        expand=True,  # Allow the progress bar to use full width
    ) as progress:
        for step in steps:
            if should_skip:
                console.print(f"[grey]Skipping step: {step.name}[/grey]")
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
                console.print(f"[green]✓[/green] {step.name}")
                state_manager.save_state(step.name)
            else:
                console.print(f"[red]✗[/red] {step.name}")
                console.print("\n[bold red]Error output:[/bold red]")
                if stdout:
                    console.print(stdout)
                if stderr:
                    console.print(stderr, style=Style(color="red"))
                sys.exit(1)


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
    try:
        with subprocess.Popen(
            (
                step.command
                if not step.shell
                else " ".join(shlex.quote(cmd) for cmd in step.command)
            ),
            shell=step.shell,
            cwd=step.cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        ) as process:
            stdout_lines: List[str] = []
            stderr_lines: List[str] = []

            # Keep track of last 5 lines for live display
            last_lines: Deque[str] = deque(maxlen=5)

            def stream_reader(
                stream: TextIO, lines_list: List[str], _: Optional[str] = None
            ) -> None:
                for line in iter(stream.readline, ""):
                    lines_list.append(line)
                    last_lines.append(line.rstrip())
                    # Update progress display with last 5 lines
                    progress.update(
                        task_id,
                        description="\n".join(last_lines),
                        visible=True,
                    )

            # Create and start threads for reading stdout and stderr
            stdout_thread = threading.Thread(
                target=stream_reader, args=(process.stdout, stdout_lines)
            )
            stderr_thread = threading.Thread(
                target=stream_reader, args=(process.stderr, stderr_lines)
            )

            stdout_thread.start()
            stderr_thread.start()

            # Wait for both threads to complete
            stdout_thread.join()
            stderr_thread.join()

            # Now wait for the process to complete
            return_code = process.wait()

            # Combine all output
            stdout = "".join(stdout_lines)
            stderr = "".join(stderr_lines)

            return return_code == 0, stdout, stderr

    except subprocess.CalledProcessError as e:
        return False, e.stdout or "", e.stderr or ""


git_root = Path(
    subprocess.check_output(
        [shutil.which("git") or "git", "rev-parse", "--show-toplevel"],
        text=True,
    ).strip()
)


# Define all check steps
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
            command=["mypy"] + script_files,
        ),
        CheckStep(
            name="Typechecking TypeScript",
            command=["npx", "tsc", "--noEmit"],
        ),
        CheckStep(
            name="Linting TypeScript",
            command=[
                "npx",
                "eslint",
                "--fix",
                str(git_root_path),
                "--config",
                f"{git_root_path}/eslint.config.js",
            ],
        ),
        CheckStep(
            name="Linting Python",
            command=[
                "pylint",
                str(git_root_path),
                "--rcfile",
                f"{git_root_path}/.pylintrc",
            ],
        ),
        CheckStep(
            name="Linting prose",
            command=["vale", f"{git_root_path}/content/*.md"],
        ),
        CheckStep(
            name="Cleaning up SCSS",
            command=["npx", "stylelint", "--fix", "quartz/**/*.scss"],
        ),
        CheckStep(
            name="Spellchecking",
            command=["fish", f"{git_root_path}/scripts/spellchecker.fish"],
            shell=True,
        ),
        CheckStep(
            name="Checking source files",
            command=[
                "python",
                f"{git_root_path}/scripts/source_file_checks.py",
            ],
        ),
        CheckStep(
            name="Running Javascript unit tests",
            command=["npm", "run", "test"],
        ),
        CheckStep(
            name="Running Python unit tests",
            command=["pytest", f"{git_root_path}/scripts"],
        ),
        CheckStep(
            name="Compressing and uploading local assets",
            command=["sh", f"{git_root_path}/scripts/handle_local_assets.sh"],
            shell=True,
        ),
    ]

    steps_after_server = [
        CheckStep(
            name="Checking HTML files",
            command=[
                "python",
                f"{git_root_path}/scripts/built_site_checks.py",
            ],
        ),
        CheckStep(
            name="Integration testing using Playwright (Chrome-only)",
            command=[
                "npx",
                "playwright",
                "test",
                "--config",
                f"{git_root_path}/playwright.config.ts",
                "--project",
                "Desktop Chrome",
            ],
        ),
        CheckStep(
            name="Checking link validity",
            command=["fish", f"{git_root_path}/scripts/linkchecker.fish"],
            shell=True,
        ),
        CheckStep(
            name="Updating metadata on published posts",
            command=[
                "python",
                f"{git_root_path}/scripts/update_date_on_publish.py",
            ],
        ),
        CheckStep(
            name="Cryptographically timestamping the last commit",
            command=[
                "sh",
                f"{git_root_path}/scripts/timestamp_last_commit.sh",
            ],
            shell=True,
        ),
    ]

    return steps_before_server, steps_after_server


def main() -> None:
    """
    Run all checks before pushing.
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

    server_manager = ServerManager()
    state_manager = StateManager()

    try:
        steps_before_server, steps_after_server = get_check_steps(git_root)
        all_steps = steps_before_server + steps_after_server
        all_step_names = [step.name for step in all_steps]

        # Validate the last step exists in our known steps
        last_step = state_manager.get_last_step(
            all_step_names if args.resume else None
        )
        if args.resume and not last_step:
            # If resuming but no valid last step found, start from beginning
            console.print(
                "[yellow]No valid resume point found. Starting from beginning.[/yellow]"
            )
            args.resume = False

        # Determine if we need to run pre-server steps
        should_run_pre = (
            not args.resume
            or not last_step
            or last_step in {step.name for step in steps_before_server}
        )

        if should_run_pre:
            run_checks(steps_before_server, state_manager, args.resume)
        else:
            for step in steps_before_server:
                console.print(f"[grey]Skipping step: {step.name}[/grey]")

        server_pid = create_server(git_root)
        server_manager.set_server_pid(server_pid)
        run_checks(steps_after_server, state_manager, args.resume)

        console.print("\n[green]All checks passed successfully! 🎉[/green]")
        # Clear state file on successful completion
        state_manager.clear_state()

    except KeyboardInterrupt:
        console.print("\n[yellow]Process interrupted by user.[/yellow]")
        # Don't clear state file on interrupt - allows for valid resume
        raise
    except Exception as e:
        console.print(f"\n[red]Error: {str(e)}[/red]")
        # Clear state file on error since we don't know if it's valid
        state_manager.clear_state()
        raise
    finally:
        server_manager.cleanup()


if __name__ == "__main__":
    main()
