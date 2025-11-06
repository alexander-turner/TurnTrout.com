"""Unit tests for run_push_checks.py."""

import json
import signal
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import ANY, MagicMock, call, patch

import psutil  # type: ignore[import]
import pytest
from rich.style import Style

from scripts import run_push_checks


@pytest.fixture(autouse=True)
def reset_global_state():
    """Reset global state before each test."""
    import scripts.run_push_checks

    scripts.run_push_checks._server_to_cleanup = None
    yield


@pytest.fixture
def temp_state_dir():
    """Create a temporary directory for state files."""
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        state_file = temp_path / "progress.json"

        with (
            patch.object(run_push_checks, "STATE_DIR", temp_path),
            patch.object(run_push_checks, "STATE_FILE_PATH", state_file),
        ):
            if state_file.exists():
                state_file.unlink()

            yield temp_dir

            if state_file.exists():
                state_file.unlink()


@pytest.fixture
def mock_process():
    """Mock psutil.Process for testing process management functions."""
    mock = MagicMock()
    mock.pid = 12345
    mock.info = {"cmdline": ["npx", "quartz", "build", "--serve"]}
    mock.terminate = MagicMock()
    mock.wait = MagicMock()
    mock.kill = MagicMock()
    return mock


@pytest.fixture
def mock_socket():
    """Mock socket for testing port checking."""
    mock = MagicMock()
    mock.connect_ex = MagicMock()
    return mock


def test_is_port_in_use(monkeypatch):
    """Test port availability checking."""
    with patch("socket.socket") as mock_socket_cls:
        mock_sock_instance = MagicMock()
        mock_sock_instance.connect_ex.return_value = 0
        mock_socket_cls.return_value.__enter__.return_value = run_push_checks
    with patch("socket.socket") as mock_socket_cls:
        mock_sock_instance = MagicMock()
        mock_sock_instance.connect_ex.return_value = 1
        mock_socket_cls.return_value.__enter__.return_value = (
            mock_sock_instance
        )
        assert run_push_checks.is_port_in_use(8080) is False


def test_find_quartz_process(mock_process):
    """Test finding Quartz process."""
    with patch("psutil.process_iter", return_value=[mock_process]):
        assert run_push_checks.find_quartz_process() == 12345

    mock_process.info = {"cmdline": ["some", "other", "process"]}
    with patch("psutil.process_iter", return_value=[mock_process]):
        assert run_push_checks.find_quartz_process() is None


def test_kill_process(mock_process):
    """Test process termination."""
    with patch("psutil.Process", return_value=mock_process):
        run_push_checks.kill_process(12345)
        mock_process.terminate.assert_called_once()
        mock_process.wait.assert_called_once_with(timeout=3)

    mock_process.wait.side_effect = psutil.TimeoutExpired(3)
    with patch("psutil.Process", return_value=mock_process):
        run_push_checks.kill_process(12345)
        mock_process.kill.assert_called_once()


def test_kill_process_no_such_process():
    """Test kill_process handles non-existent process PID."""
    with patch("psutil.Process") as mock_process_cls:
        mock_process_cls.side_effect = psutil.NoSuchProcess(99999)
        # Should not raise any exception
        run_push_checks.kill_process(99999)


def test_create_server():
    """Test server creation logic."""
    with (
        patch("scripts.run_push_checks.is_port_in_use") as mock_port_check,
        patch(
            "scripts.run_push_checks.find_quartz_process"
        ) as mock_find_process,
        patch("subprocess.Popen") as mock_popen,
        patch("scripts.run_push_checks.Progress") as mock_progress,
    ):
        # Case 1: Existing quartz process is found
        mock_find_process.return_value = 12345

        # Check return value is a ServerInfo with proper values
        result = run_push_checks.create_server(Path("/fake/path"))
        assert result.pid == 12345
        assert result.created_by_script is False

        # Port check shouldn't be called when process is found
        mock_port_check.assert_not_called()

        # Case 2: No existing process, but port is in use
        mock_find_process.return_value = None
        mock_port_check.return_value = True

        # Set up the server process mock
        mock_server = MagicMock()
        mock_server.pid = 54321
        mock_popen.return_value = mock_server

        # Set up progress bar mock
        mock_progress_instance = MagicMock()
        mock_progress.return_value = mock_progress_instance

        # Simulate server starting successfully
        mock_port_check.side_effect = [True, True]

        result = run_push_checks.create_server(Path("/fake/path"))
        assert result.pid == 54321
        assert result.created_by_script is True

        # Reset mocks for Case 3
        mock_port_check.reset_mock()
        mock_port_check.side_effect = None

        # Case 3: No existing process, port is not in use initially, but becomes available
        mock_find_process.return_value = None
        mock_port_check.side_effect = [False] + [True] * 39

        # Check return value for newly created server
        result = run_push_checks.create_server(Path("/fake/path"))
        assert result.pid == 54321
        assert result.created_by_script is True


def test_create_server_failure():
    """Test server creation timeout logic."""
    with (
        patch("scripts.run_push_checks.is_port_in_use", return_value=False),
        patch("subprocess.Popen") as mock_popen,
        patch("scripts.run_push_checks.kill_process") as mock_kill,
        patch("time.sleep"),  # Avoid actual sleep
        patch("scripts.run_push_checks.Progress"),  # Mock progress bar
        patch(
            "scripts.run_push_checks.find_quartz_process", return_value=None
        ),  # Ensure no existing process
    ):
        mock_server = MagicMock()
        mock_server.pid = 67890
        mock_popen.return_value = mock_server

        with pytest.raises(RuntimeError) as exc_info:
            run_push_checks.create_server(Path("/fake/path"))

        assert "Server failed to start" in str(exc_info.value)
        mock_kill.assert_called_once_with(67890)


def test_server_manager_cleanup():
    """Test that ServerManager only cleans up servers it created."""
    server_manager = run_push_checks.ServerManager()

    with patch("scripts.run_push_checks.kill_process") as mock_kill:
        # Case 1: Server not created by script - shouldn't be killed
        server_manager.set_server_pid(12345, created_by_script=False)
        server_manager.cleanup()
        mock_kill.assert_not_called()

        # Case 2: Server created by script - should be killed
        server_manager.set_server_pid(54321, created_by_script=True)
        server_manager.cleanup()
        mock_kill.assert_called_once_with(54321)


@pytest.fixture
def test_steps():
    """Fixture providing test check steps."""
    return [
        run_push_checks.CheckStep(
            name="Test Step 1", command=["echo", "test1"]
        ),
        run_push_checks.CheckStep(
            name="Test Step 2", command=["echo", "test2"]
        ),
        run_push_checks.CheckStep(
            name="Test Step 3", command=["echo", "test3"]
        ),
    ]


def test_run_checks_all_success(test_steps, temp_state_dir):
    """Test that all checks run successfully when there are no failures."""
    with patch("scripts.run_push_checks.run_command") as mock_run:
        mock_run.return_value = (True, "", "")
        run_push_checks.run_checks(test_steps)
        assert mock_run.call_count == 3


@pytest.mark.parametrize("failing_step_index", [0, 1, 2])
def test_run_checks_exits_on_failure(
    test_steps, failing_step_index, temp_state_dir
):
    """Test that run_checks exits immediately when a check fails."""
    with patch("scripts.run_push_checks.run_command") as mock_run:
        # Create a list of results where one step fails
        results = [(True, "", "")] * len(test_steps)
        results[failing_step_index] = (False, "Failed output", "Error")
        mock_run.side_effect = results

        with pytest.raises(SystemExit) as exc_info:
            run_push_checks.run_checks(test_steps)

        assert exc_info.value.code == 1
        assert mock_run.call_count == failing_step_index + 1


def test_run_checks_shows_error_output(test_steps):
    """Test that error output is properly displayed on failure."""
    with (
        patch("scripts.run_push_checks.run_command") as mock_run,
        patch("scripts.run_push_checks.console.log") as mock_log,
    ):
        mock_run.return_value = (False, "stdout error", "stderr error")

        with pytest.raises(SystemExit):
            run_push_checks.run_checks(test_steps)

        mock_log.assert_any_call("[red]✗[/red] Test Step 1")
        mock_log.assert_any_call("\n[bold red]Error output:[/bold red]")
        mock_log.assert_any_call("stdout error")
        mock_log.assert_any_call("stderr error", style=Style(color="red"))


def test_cleanup_handler():
    """Test cleanup handler functionality."""
    server_manager = run_push_checks.ServerManager()
    with (
        patch("scripts.run_push_checks.kill_process") as mock_kill,
        patch("sys.exit") as mock_exit,
    ):
        # Test cleanup with no server
        server_manager._signal_handler(signal.SIGINT, None)
        mock_kill.assert_not_called()
        mock_exit.assert_called_once_with(1)

        mock_kill.reset_mock()
        mock_exit.reset_mock()

        # Test cleanup with active server not created by script
        server_manager.set_server_pid(12345, created_by_script=False)
        server_manager._signal_handler(signal.SIGINT, None)
        mock_kill.assert_not_called()
        mock_exit.assert_called_once_with(1)

        mock_kill.reset_mock()
        mock_exit.reset_mock()

        # Test cleanup with active server created by script
        server_manager.set_server_pid(54321, created_by_script=True)
        server_manager._signal_handler(signal.SIGINT, None)
        mock_kill.assert_called_once_with(54321)
        mock_exit.assert_called_once_with(1)


def test_run_command_success():
    """Test successful command execution."""
    step = run_push_checks.CheckStep(
        name="Test Command", command=["echo", "test"]
    )
    with patch("subprocess.Popen") as mock_popen:
        proc = mock_popen.return_value.__enter__.return_value
        proc.wait.return_value = 0
        proc.stdout.readline.side_effect = ["test output\n", ""]
        proc.stderr.readline.side_effect = [""]

        mock_progress = MagicMock()
        mock_task_id = MagicMock()

        success, stdout, stderr = run_push_checks.run_command(
            step, mock_progress, mock_task_id
        )
        assert success is True
        assert "test output\n" in stdout
        assert stderr == ""


def test_run_command_failure():
    """Test command execution failure."""
    step = run_push_checks.CheckStep(
        name="Test Command", command=["echo", "test"]
    )
    with patch("subprocess.Popen") as mock_popen:
        proc = mock_popen.return_value.__enter__.return_value
        proc.wait.return_value = 1
        proc.stdout.readline.side_effect = ["error output\n", ""]
        proc.stderr.readline.side_effect = ["error message\n", ""]

        mock_progress = MagicMock()
        mock_task_id = MagicMock()

        success, stdout, stderr = run_push_checks.run_command(
            step, mock_progress, mock_task_id
        )
        assert success is False
        assert "error output\n" in stdout
        assert "error message\n" in stderr


def test_run_command_shell_handling():
    """Test command execution with shell=True."""
    step = run_push_checks.CheckStep(
        name="Test Command",
        command=["echo", "test"],
        # skipcq: BAN-B604 (a local command, assume safe)
        shell=True,
    )
    with patch("subprocess.Popen") as mock_popen:
        proc = mock_popen.return_value.__enter__.return_value
        proc.wait.return_value = 0
        proc.stdout.readline.side_effect = ["output\n", ""]
        proc.stderr.readline.side_effect = [""]

        mock_progress = MagicMock()
        mock_task_id = MagicMock()

        run_push_checks.run_command(step, mock_progress, mock_task_id)
        expected_full_command = " ".join(step.command)
        called_cmd = mock_popen.call_args[0][0]
        assert isinstance(called_cmd, str)
        assert called_cmd == expected_full_command


def test_progress_bar_updates():
    """Test that progress bar updates correctly with output."""
    step = run_push_checks.CheckStep(
        name="Test Command", command=["echo", "test"]
    )
    with patch("subprocess.Popen") as mock_popen:
        proc = mock_popen.return_value.__enter__.return_value
        proc.wait.return_value = 0
        # Simulate 6 lines of output to test the deque maxlen=5 behavior
        proc.stdout.readline.side_effect = [
            "line1\n",
            "line2\n",
            "line3\n",
            "line4\n",
            "line5\n",
            "line6\n",
            "",
        ]
        proc.stderr.readline.side_effect = [""]

        mock_progress = MagicMock()
        mock_task_id = MagicMock()

        run_push_checks.run_command(step, mock_progress, mock_task_id)

        # Get all update calls that have a description
        update_calls = [
            call
            for call in mock_progress.update.call_args_list
            if "description" in call[1]
        ]

        # First update should show first line and make visible
        assert update_calls[0][0] == (mock_task_id,)
        assert update_calls[0][1]["description"] == "line1"
        assert update_calls[0][1]["visible"] is True

        # Last update with description should show lines2..6
        last_desc = update_calls[-1][1]["description"]
        assert (
            "line1" not in last_desc
        )  # line1 should be dropped due to maxlen=5
        assert "line2" in last_desc
        assert "line3" in last_desc
        assert "line4" in last_desc
        assert "line5" in last_desc
        assert "line6" in last_desc


def test_progress_bar_stderr_updates():
    """Test that progress bar updates correctly with stderr output."""
    step = run_push_checks.CheckStep(
        name="Test Command", command=["echo", "test"]
    )
    with patch("subprocess.Popen") as mock_popen:
        proc = mock_popen.return_value.__enter__.return_value
        proc.wait.return_value = 1
        proc.stdout.readline.side_effect = [""]
        proc.stderr.readline.side_effect = ["error1\n", "error2\n", ""]

        mock_progress = MagicMock()
        mock_task_id = MagicMock()

        run_push_checks.run_command(step, mock_progress, mock_task_id)

        update_calls = [
            call
            for call in mock_progress.update.call_args_list
            if "description" in call[1]
        ]
        # Confirm both stderr lines appear
        descs = [c[1]["description"] for c in update_calls]
        assert any("error1" in d for d in descs)
        assert any("error2" in d for d in descs)


def test_progress_bar_mixed_output():
    """Test that progress bar handles mixed stdout/stderr correctly."""
    step = run_push_checks.CheckStep(
        name="Test Command", command=["echo", "test"]
    )
    with patch("subprocess.Popen") as mock_popen:
        proc = mock_popen.return_value.__enter__.return_value
        proc.wait.return_value = 0
        proc.stdout.readline.side_effect = ["out1\n", "out2\n", ""]
        proc.stderr.readline.side_effect = ["err1\n", "err2\n", ""]

        mock_progress = MagicMock()
        mock_task_id = MagicMock()

        run_push_checks.run_command(step, mock_progress, mock_task_id)

        update_calls = [
            call
            for call in mock_progress.update.call_args_list
            if "description" in call[1]
        ]
        descriptions = [call[1]["description"] for call in update_calls]
        assert any("out1" in desc for desc in descriptions)
        assert any("out2" in desc for desc in descriptions)
        assert any("err1" in desc for desc in descriptions)
        assert any("err2" in desc for desc in descriptions)


def test_save_and_get_state(temp_state_dir):
    """Test saving and retrieving state."""
    run_push_checks.save_state("Test Step 1")
    assert run_push_checks.get_last_step() == "Test Step 1"

    # Test overwriting state
    run_push_checks.save_state("Test Step 2")
    assert run_push_checks.get_last_step() == "Test Step 2"


def test_reset_saved_progress(temp_state_dir):
    """Test clearing state."""
    run_push_checks.save_state("Test Step")
    assert run_push_checks.get_last_step() == "Test Step"

    run_push_checks.reset_saved_progress()
    assert run_push_checks.get_last_step() is None


def test_run_checks_with_resume(test_steps, temp_state_dir):
    """Test resuming from a previous step."""
    with patch("scripts.run_push_checks.run_command") as mock_run:
        mock_run.return_value = (True, "", "")

        # Save state as if we completed the first step
        run_push_checks.save_state("Test Step 1")

        # Run with resume flag
        run_push_checks.run_checks(test_steps, resume=True)

        # Should only run steps 2 and 3
        assert mock_run.call_count == 2

        # Verify the skipped step was logged
        with patch("scripts.run_push_checks.console.log") as mock_log:
            run_push_checks.run_checks(test_steps, resume=True)
            mock_log.assert_any_call("[grey]Skipping step: Test Step 1[/grey]")


def test_run_checks_resume_from_middle(test_steps, temp_state_dir):
    """Test resuming from a middle step with failure."""
    with patch("scripts.run_push_checks.run_command") as mock_run:
        # Set up to fail on the last step
        mock_run.side_effect = [(False, "Failed", "Error")]

        # Save state as if we completed the second step
        run_push_checks.save_state("Test Step 2")

        # Run with resume flag, should fail on step 3
        with pytest.raises(SystemExit):
            run_push_checks.run_checks(test_steps, resume=True)

        # Should only try to run step 3
        assert mock_run.call_count == 1


@pytest.mark.parametrize("resume_flag", [True, False])
def test_argument_parsing(resume_flag, temp_state_dir):
    """Test command line argument parsing with and without resume flag."""
    with patch("argparse.ArgumentParser.parse_args") as mock_parse:
        mock_parse.return_value = MagicMock(resume=resume_flag)

        # Create mock steps
        mock_steps_before = [
            run_push_checks.CheckStep(name="Test Before", command=["test"])
        ]
        mock_steps_after = [
            run_push_checks.CheckStep(name="Test After", command=["test"])
        ]

        with (
            patch(
                "scripts.run_push_checks.get_check_steps",
                return_value=(mock_steps_before, mock_steps_after),
            ),
            patch("scripts.run_push_checks.run_checks") as mock_run,
            patch("scripts.run_push_checks.create_server") as mock_create,
        ):
            # Set up create_server to return a ServerInfo
            mock_create.return_value = run_push_checks.ServerInfo(12345, False)

            # Set up a valid resume point if testing resume
            if resume_flag:
                run_push_checks.save_state("Test Before")

            from scripts.run_push_checks import main

            main()

            # Verify run_checks was called twice with correct resume flag
            assert mock_run.call_count == 2
            mock_run.assert_has_calls(
                [
                    call(mock_steps_before, resume_flag),
                    call(mock_steps_after, resume_flag),
                ]
            )


def test_main_clears_state_on_success(temp_state_dir):
    """Test that main clears state file when all checks pass."""
    with (
        patch(
            "argparse.ArgumentParser.parse_args",
            return_value=MagicMock(resume=False),
        ),
        patch("scripts.run_push_checks.run_checks") as mock_run,  # noqa: F841
        patch("scripts.run_push_checks.create_server") as mock_create,
        patch("scripts.run_push_checks.kill_process"),
        patch(
            "scripts.run_push_checks.get_check_steps",
            return_value=(
                [run_push_checks.CheckStep(name="test", command=["test"])],
                [],
            ),
        ),
    ):
        mock_create.return_value = run_push_checks.ServerInfo(12345, False)

        from scripts.run_push_checks import main

        main()

        # Verify state was cleared after successful completion
        assert run_push_checks.get_last_step() is None


def test_main_preserves_state_on_failure(temp_state_dir):
    """Test that main preserves state file when a check fails."""
    with (
        patch(
            "argparse.ArgumentParser.parse_args",
            return_value=MagicMock(resume=False),
        ),
        patch("scripts.run_push_checks.run_checks") as mock_run,
        patch("scripts.run_push_checks.create_server") as mock_create,
        patch(
            "scripts.run_push_checks.get_check_steps",
            return_value=(
                [run_push_checks.CheckStep(name="test", command=["test"])],
                [],
            ),
        ),
    ):
        mock_create.return_value = run_push_checks.ServerInfo(12345, False)

        # Save initial state
        run_push_checks.save_state("test")

        # Make the first run_checks call fail
        mock_run.side_effect = SystemExit(1)

        from scripts.run_push_checks import main

        with pytest.raises(SystemExit):
            main()

        # Verify state was not cleared
        assert run_push_checks.get_last_step() == "test"


def test_main_skips_pre_server_steps(temp_state_dir):
    """Test that main correctly skips pre-server steps when resuming from post-
    server step."""
    with (
        patch(
            "argparse.ArgumentParser.parse_args",
            return_value=MagicMock(resume=True),
        ),
        patch("scripts.run_push_checks.run_checks") as mock_run,
        patch("scripts.run_push_checks.create_server") as mock_create,
        patch("scripts.run_push_checks.console.log") as mock_log,
    ):
        mock_create.return_value = run_push_checks.ServerInfo(12345, False)
        mock_run.return_value = None  # Successful runs

        # Create mock steps
        mock_steps_before = [
            run_push_checks.CheckStep(name="Pre Step 1", command=["test"]),
            run_push_checks.CheckStep(name="Pre Step 2", command=["test"]),
        ]
        mock_steps_after = [
            run_push_checks.CheckStep(name="Post Step", command=["test"])
        ]

        with (
            patch(
                "scripts.run_push_checks.get_check_steps",
                return_value=(mock_steps_before, mock_steps_after),
            ),
        ):
            # Set up state to resume from post step
            run_push_checks.save_state("Post Step")

            from scripts.run_push_checks import main

            main()

            # Verify pre-server steps were skipped
            mock_log.assert_any_call("[grey]Skipping step: Pre Step 1[/grey]")
            mock_log.assert_any_call("[grey]Skipping step: Pre Step 2[/grey]")

            # Verify only post-server steps were run
            assert mock_run.call_count == 1
            mock_run.assert_called_once_with(mock_steps_after, True)


def test_run_checks_skips_until_last_step(temp_state_dir):
    """Test that run_push_checks.run_checks skips steps until it reaches the
    last successful step."""
    test_steps = [
        run_push_checks.CheckStep(name="Step 1", command=["test"]),
        run_push_checks.CheckStep(name="Step 2", command=["test"]),
        run_push_checks.CheckStep(name="Step 3", command=["test"]),
    ]

    with (
        patch("scripts.run_push_checks.run_command") as mock_run,
        patch("scripts.run_push_checks.console.log") as mock_log,
    ):
        mock_run.return_value = (True, "", "")
        run_push_checks.save_state(
            "Step 2"
        )  # Pretend we completed up to Step 2

        run_push_checks.run_checks(test_steps, resume=True)

        # Verify first two steps were skipped
        mock_log.assert_any_call("[grey]Skipping step: Step 1[/grey]")
        mock_log.assert_any_call("[grey]Skipping step: Step 2[/grey]")

        # Verify only Step 3 was run
        assert mock_run.call_count == 1
        mock_run.assert_called_once_with(test_steps[2], ANY, ANY)


def test_get_last_step_invalid_json(temp_state_dir, capsys):
    """Test get_last_step handles invalid JSON content."""
    state_file = Path(temp_state_dir) / "last_successful_step.json"
    with open(state_file, "w", encoding="utf-8") as f:
        f.write("this is not valid json")
    # Patch the path to ensure it uses the test file
    with patch("scripts.run_push_checks.STATE_FILE_PATH", state_file):
        result = run_push_checks.get_last_step()
        assert result is None
        stderr = capsys.readouterr().err
        assert "Error parsing JSON in" in stderr


@pytest.mark.parametrize(
    "state_content",
    [
        {"some_other_key": "some_value"},  # Unexpected structure
        {},  # Empty JSON object
    ],
)
def test_get_last_step_key_error(temp_state_dir, state_content: dict, capsys):
    """Test get_last_step handles valid JSON with unexpected structure and
    prints error."""
    state_file_path = Path(temp_state_dir) / "last_successful_step.json"
    with open(state_file_path, "w", encoding="utf-8") as f:
        json.dump(state_content, f)
    # Patch the path to ensure it uses the test file
    with patch("scripts.run_push_checks.STATE_FILE_PATH", state_file_path):
        # Should return None because the key is missing or structure is wrong
        result = run_push_checks.get_last_step()
        assert result is None
        # Assert that the specific error message was printed to stderr
        stderr = capsys.readouterr().err
        assert "No 'last_successful_step' key in" in stderr


def test_invalid_step(temp_state_dir):
    """Test that get_last_step handles invalid steps correctly."""
    test_steps = ["Step 1", "Step 2", "Step 3"]
    run_push_checks.save_state("Invalid Step")

    # Should return None when step doesn't exist in available_steps
    assert run_push_checks.get_last_step(test_steps) is None

    # Should still be able to get the raw step without validation
    assert run_push_checks.get_last_step() == "Invalid Step"


def test_get_check_steps():
    """Test that check steps are properly configured."""
    test_root = Path("/test/root")
    steps_before, steps_after = run_push_checks.get_check_steps(test_root)

    # Verify we have a reasonable number of steps
    assert len(steps_before) >= 11
    assert len(steps_after) >= 2

    # Verify some key steps exist and are properly configured
    assert any(
        step.name.startswith("Typechecking Python") for step in steps_before
    )
    assert any(
        step.name == "Compressing and uploading local assets"
        for step in steps_before
    )
    assert any(
        step.name.startswith("Checking HTML files") for step in steps_after
    )

    # Verify paths are properly configured
    for step in steps_before + steps_after:
        if ".pylintrc" in str(step.command):
            assert "--rcfile" in step.command
            assert str(test_root / ".pylintrc") in str(step.command)
        if "eslint.config.js" in str(step.command):
            assert "--config" in step.command
            assert str(test_root / "eslint.config.js") in str(step.command)


def test_main_resume_with_invalid_step(temp_state_dir):
    """Test main() handles invalid resume state correctly."""
    with (
        patch(
            "argparse.ArgumentParser.parse_args",
            return_value=MagicMock(resume=True),
        ),
        patch("scripts.run_push_checks.run_checks") as mock_run,
        patch("scripts.run_push_checks.create_server") as mock_create,
        patch("scripts.run_push_checks.console.log") as mock_log,
        patch("scripts.run_push_checks.kill_process"),
        patch(
            "scripts.run_push_checks.get_check_steps",
            return_value=(
                [run_push_checks.CheckStep(name="test", command=["test"])],
                [],
            ),
        ),
    ):
        mock_create.return_value = run_push_checks.ServerInfo(12345, False)
        # Save an invalid step
        run_push_checks.save_state("invalid_step")

        from scripts.run_push_checks import main

        main()

        # Should show warning and start from beginning
        mock_log.assert_any_call(
            "[yellow]No valid resume point found. Starting from beginning.[/yellow]"
        )
        # Should run all steps
        assert mock_run.call_count == 2


def test_main_preserves_state_on_interrupt(temp_state_dir):
    """Test that state is preserved when user interrupts."""
    with (
        patch(
            "argparse.ArgumentParser.parse_args",
            return_value=MagicMock(resume=False),
        ),
        patch("scripts.run_push_checks.run_checks") as mock_run,
        patch("scripts.run_push_checks.create_server") as mock_create,
        patch("scripts.run_push_checks.console.log") as mock_log,
        patch("scripts.run_push_checks.kill_process"),
        patch(
            "scripts.run_push_checks.get_check_steps",
            return_value=(
                [run_push_checks.CheckStep(name="test", command=["test"])],
                [],
            ),
        ),
    ):
        mock_create.return_value = run_push_checks.ServerInfo(12345, False)
        # Save a valid step
        run_push_checks.save_state("test")

        # Simulate keyboard interrupt
        mock_run.side_effect = KeyboardInterrupt()

        from scripts.run_push_checks import main

        with pytest.raises(KeyboardInterrupt):
            main()

        # State should be preserved
        assert run_push_checks.get_last_step() == "test"
        mock_log.assert_any_call(
            "\n[yellow]Process interrupted by user.[/yellow]"
        )


def test_create_server_progress_bar():
    """Test server creation shows progress correctly."""
    with (
        patch("scripts.run_push_checks.is_port_in_use") as mock_port_check,
        patch("scripts.run_push_checks.Progress") as mock_progress_cls,
        patch("subprocess.Popen") as mock_popen,
        patch("time.sleep"),  # Don't actually sleep in tests
        patch(
            "scripts.run_push_checks.find_quartz_process", return_value=None
        ),
    ):
        # Set up mocks
        # First two checks are for the initial port check and first loop iteration
        # Third check is for second loop iteration
        # Fourth check is for success
        mock_port_check.side_effect = [False, False, False, True]
        mock_progress = MagicMock()
        mock_progress_cls.return_value.__enter__.return_value = mock_progress
        mock_task = MagicMock()
        mock_progress.add_task.return_value = mock_task
        mock_server = MagicMock()
        mock_server.pid = 12345
        mock_popen.return_value = mock_server

        server_info = run_push_checks.create_server(Path("/test"))

        # Verify returned ServerInfo
        assert server_info.pid == 12345
        assert server_info.created_by_script is True

        # Verify progress updates
        assert mock_progress.add_task.call_count == 1
        update_calls = mock_progress.update.call_args_list

        # Should have at least 2 updates (one for each attempt)
        assert len(update_calls) >= 2

        # First update should show first attempt
        first_desc = update_calls[0][1]["description"]
        assert (
            f"Waiting for server to start... "
            f"(1/{run_push_checks.SERVER_START_WAIT_TIME})" in first_desc
        )

        # Second update should show second attempt
        second_desc = update_calls[1][1]["description"]
        assert (
            f"Waiting for server to start... "
            f"(2/{run_push_checks.SERVER_START_WAIT_TIME})" in second_desc
        )


def test_run_interactive_command():
    """Test interactive command execution (like spellchecker)"""
    step = run_push_checks.CheckStep(
        name="Spellcheck",
        command=["fish", "scripts/spellchecker.fish"],
        # skipcq: BAN-B604 (a local command, assume safe)
        shell=True,
    )

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)

        mock_progress = MagicMock()
        mock_task_id = MagicMock()

        success, stdout, stderr = run_push_checks.run_interactive_command(
            step, mock_progress, mock_task_id
        )

        # Verify progress was hidden
        mock_progress.update.assert_called_with(mock_task_id, visible=False)

        # Verify subprocess.run was called correctly
        mock_run.assert_called_once()
        assert mock_run.call_args[0][0] == "fish scripts/spellchecker.fish"
        assert mock_run.call_args[1]["shell"] is True
        assert mock_run.call_args[1]["check"] is True

        assert success is True
        assert stdout == ""
        assert stderr == ""

    # Test failing interactive command
    with patch("subprocess.run") as mock_run:
        mock_run.side_effect = subprocess.CalledProcessError(
            1, "fish scripts/spellchecker.fish"
        )

        mock_progress = MagicMock()
        mock_task_id = MagicMock()

        success, stdout, stderr = run_push_checks.run_interactive_command(
            step, mock_progress, mock_task_id
        )

        assert success is False
        assert stdout == ""
        assert "Command failed with exit code 1" in stderr


@pytest.mark.parametrize(
    "step",
    [
        # skipcq: BAN-B604 (a local command, assume safe)
        run_push_checks.CheckStep(
            name="Spellcheck",
            command=["fish", "scripts/spellchecker.fish"],
            shell=True,
        ),
        # skipcq: BAN-B604 (a local command, assume safe)
        run_push_checks.CheckStep(
            name="Linkcheck",
            command=["fish", "scripts/linkchecker.fish"],
            shell=True,
        ),
        run_push_checks.CheckStep(
            name="Vale", command=["vale", "some/path"], shell=False
        ),
    ],
)
def test_run_command_delegates_to_interactive(step):
    """Test that run_command correctly delegates to interactive runner."""
    with patch(
        "scripts.run_push_checks.run_interactive_command"
    ) as mock_interactive:
        mock_interactive.return_value = (True, "test", "")

        mock_progress = MagicMock()
        mock_task_id = MagicMock()

        success, stdout, stderr = run_push_checks.run_command(
            step, mock_progress, mock_task_id
        )

        # Verify interactive runner was called
        mock_interactive.assert_called_once_with(
            step, mock_progress, mock_task_id
        )
        assert success is True
        assert stdout == "test"
        assert stderr == ""


def test_server_process_continues_running():
    """Test that server process continues running after create_server
    returns."""
    with (
        patch("scripts.run_push_checks.is_port_in_use") as mock_port_check,
        patch("subprocess.Popen") as mock_popen,
        patch("time.sleep"),  # Don't actually sleep in tests
        patch(
            "scripts.run_push_checks.find_quartz_process", return_value=None
        ),
        patch(
            "shutil.which", return_value="npx"
        ),  # Mock shutil.which to return just "npx"
    ):
        # Set up port check to return False initially, then True after server "starts"
        mock_port_check.side_effect = [False, False, True]

        # Set up the server process mock
        mock_server = MagicMock()
        mock_server.pid = 12345
        mock_popen.return_value = mock_server

        # Call create_server
        server_info = run_push_checks.create_server(Path("/test"))

        # Verify server was started
        assert server_info.pid == 12345
        assert server_info.created_by_script is True

        # Verify server process wasn't terminated
        mock_server.terminate.assert_not_called()
        mock_server.kill.assert_not_called()
        mock_server.wait.assert_not_called()

        # Verify Popen was called with the correct arguments
        mock_popen.assert_called_once()
        popen_args = mock_popen.call_args[0][0]
        assert popen_args == ["npx", "quartz", "build", "--serve"]
        popen_kwargs = mock_popen.call_args[1]
        assert popen_kwargs["start_new_session"] is True
        assert popen_kwargs["stdout"] == subprocess.DEVNULL
        assert popen_kwargs["stderr"] == subprocess.DEVNULL


def test_reused_server_not_killed():
    """Test that reused server isn't killed on cleanup."""
    with (
        patch(
            "scripts.run_push_checks.find_quartz_process"
        ) as mock_find_process,
        patch("scripts.run_push_checks.kill_process") as mock_kill,
    ):
        # Set up an existing quartz process
        mock_find_process.return_value = 12345

        server_manager = run_push_checks.ServerManager()

        # Get server info and set it in manager
        server_info = run_push_checks.create_server(Path("/test"))
        server_manager.set_server_pid(
            server_info.pid, server_info.created_by_script
        )

        # Cleanup should NOT kill the server
        server_manager.cleanup()
        mock_kill.assert_not_called()
