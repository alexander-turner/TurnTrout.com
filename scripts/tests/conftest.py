import tempfile
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import git
import pytest

from .. import utils as script_utils


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
def git_initialized_dir(tmp_path: Path) -> dict[str, Any]:
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
