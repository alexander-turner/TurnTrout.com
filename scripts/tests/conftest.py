import shutil
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import git
import pytest

from .. import utils as script_utils

# --- Skip markers for missing external tools ---

requires_imagemagick = pytest.mark.skipif(
    shutil.which("convert") is None and shutil.which("magick") is None,
    reason="ImageMagick not found",
)

requires_ffmpeg = pytest.mark.skipif(
    shutil.which("ffmpeg") is None,
    reason="ffmpeg not found",
)

requires_rclone = pytest.mark.skipif(
    shutil.which("rclone") is None,
    reason="rclone not found",
)

requires_fish = pytest.mark.skipif(
    shutil.which("fish") is None,
    reason="fish shell not found",
)

requires_linkchecker = pytest.mark.skipif(
    shutil.which("linkchecker") is None,
    reason="linkchecker not found",
)

requires_media_tools = pytest.mark.skipif(
    shutil.which("ffmpeg") is None
    or (shutil.which("convert") is None and shutil.which("magick") is None),
    reason="ffmpeg and/or ImageMagick not found",
)


@pytest.fixture()
def temp_dir():
    """Creates a temporary directory and cleans up afterwards."""
    with tempfile.TemporaryDirectory() as dir_path:
        yield Path(dir_path)


@pytest.fixture()
def git_repo_setup(tmp_path: Path):
    """
    Initialize a temporary git repository and return its root Path.

    Many integration tests need a valid git repository to satisfy helper
    functions which call *git* under-the-hood (e.g. *get_git_root*).
    """
    repo = git.Repo.init(tmp_path)
    return {"repo": repo, "root": tmp_path}


@pytest.fixture()
def quartz_project_structure(tmp_path: Path):
    """
    Create a minimal Quartz directory layout under *tmp_path*.

    The structure mirrors the directories expected by many scripts:
    ├── public/
    ├── quartz/static/
    └── website_content/
    """
    dirs = {
        "public": tmp_path / "public",
        "static": tmp_path / "quartz" / "static",
        "content": tmp_path / "website_content",
    }
    for d in dirs.values():
        d.mkdir(parents=True, exist_ok=True)
    return dirs


@pytest.fixture()
def quartz_dirs(mock_git_root: Path) -> tuple[Path, Path]:
    """
    Create and return standard quartz static and content directories.

    Returns:
        Tuple of (static_dir, content_dir) paths.
    """
    static_dir = mock_git_root / "quartz" / "static"
    content_dir = mock_git_root / "quartz" / "website_content"
    static_dir.mkdir(parents=True, exist_ok=True)
    content_dir.mkdir(parents=True, exist_ok=True)
    return static_dir, content_dir


@pytest.fixture()
def mock_git_root(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """
    Mock git root with initialized repo and mocked git.Repo.

    This fixture creates a temporary directory structure that mimics
    the project root and mocks both git.Repo and get_git_root() to
    return this temporary location.

    Returns:
        Path to the mocked project root directory.
    """
    project_root = tmp_path / "turntrout.com"
    project_root.mkdir(parents=True, exist_ok=True)

    # Copy config/constants.json so load_shared_constants() works
    real_constants = (
        Path(__file__).resolve().parents[2] / "config" / "constants.json"
    )
    config_dir = project_root / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    (config_dir / "constants.json").write_text(
        real_constants.read_text(encoding="utf-8"), encoding="utf-8"
    )

    # Mock the git.Repo to return our fake repository
    mock_repo = MagicMock()
    mock_repo.working_tree_dir = str(project_root)
    monkeypatch.setattr("git.Repo", lambda *args, **kwargs: mock_repo)

    # Mock get_git_root to return our project root
    monkeypatch.setattr(
        script_utils, "get_git_root", lambda *args, **kwargs: project_root
    )

    return project_root


@pytest.fixture()
def git_initialized_dir(tmp_path: Path) -> dict[str, git.Repo | Path | dict]:
    """
    Initialize a git repository with basic config in tmp_path.

    Creates a git repository with user.name and user.email configured,
    ready for commits.

    Returns:
        Dictionary with 'repo' (git.Repo), 'root' (Path), and 'config' dict.
    """
    repo = git.Repo.init(tmp_path)
    config_writer = repo.config_writer()
    config_writer.set_value("user", "name", "Test User")
    config_writer.set_value("user", "email", "test@example.com")
    config_writer.release()

    return {
        "repo": repo,
        "root": tmp_path,
        "config": {"name": "Test User", "email": "test@example.com"},
    }


@pytest.fixture()
def mock_r2_upload_module():
    """
    Mock the r2_upload module for tests that don't need real R2 operations.

    This fixture patches sys.modules to provide a mock r2_upload module,
    preventing actual R2/rclone operations during tests.
    """
    with patch.dict("sys.modules", {"r2_upload": MagicMock()}):
        yield


@pytest.fixture()
def mock_subprocess_run():
    """
    Mock subprocess.run for tests that don't need real command execution.

    Returns a mock that simulates successful command completion by default.
    Tests can customize the mock's return value as needed.
    """
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        yield mock_run


@pytest.fixture()
def mock_rclone():
    """
    Mock rclone subprocess calls with successful return codes.

    Useful for tests involving R2 upload operations that should not actually
    interact with cloud storage.
    """
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        yield mock_run


def _is_git_command(cmd: list | str) -> bool:
    """Check if command is a git executable."""
    if not isinstance(cmd, list) or not cmd:
        return False

    git_paths = ("git", "/usr/bin/git", "/opt/homebrew/bin/git")
    first_arg = cmd[0]
    return first_arg in git_paths or (
        isinstance(first_arg, str) and first_arg.endswith("/git")
    )


def _is_blocked_git_operation(cmd: list) -> tuple[bool, str]:
    """
    Check if command is a blocked git operation.

    By default, blocks ALL git operations except explicitly allowed read-only ones.
    This prevents tests from accidentally modifying the real repository.

    Returns:
        Tuple of (is_blocked, subcommand_name)
    """
    allowed_readonly_operations = {
        "rev-parse",
        "status",
        "log",
        "show",
        "ls-files",
        "ls-tree",
        "cat-file",
        "config",
        "remote",
        "branch",
        "init",
    }

    if not _is_git_command(cmd) or len(cmd) < 2:
        return False, ""

    subcommand = cmd[1]

    is_blocked = subcommand not in allowed_readonly_operations
    return is_blocked, subcommand


@pytest.fixture(autouse=True)
def prevent_real_git_operations(monkeypatch: pytest.MonkeyPatch, request):
    """
    Automatically prevent real git operations in all tests.

    This fixture wraps subprocess.run to detect and fail on any real git
    commands (add, commit, push, etc.) that aren't properly mocked.
    Tests can opt out by using the 'allow_git_operations' marker.

    Usage to opt out:
        @pytest.mark.allow_git_operations
        def test_that_needs_real_git():
            ...
    """
    if "allow_git_operations" in request.keywords:
        return

    original_run = subprocess.run

    def guarded_run(*args, **kwargs):
        """Wrapper that fails if real git write operations are attempted."""
        cmd = args[0] if args else kwargs.get("args", [])
        is_blocked, subcommand = _is_blocked_git_operation(cmd)

        if is_blocked:
            pytest.fail(
                f"Test attempted real git operation: git {subcommand}\n"
                f"Full command: {cmd}\n"
                f"Tests should mock git operations to avoid modifying the real repository.\n"
                f"Use @pytest.mark.allow_git_operations to opt out of this check."
            )

        return original_run(*args, **kwargs)

    monkeypatch.setattr("subprocess.run", guarded_run)
