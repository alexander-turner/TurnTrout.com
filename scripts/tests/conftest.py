import tempfile
from pathlib import Path

import git
import pytest


@pytest.fixture()
def temp_dir():
    """Creates a temporary directory and cleans up afterwards."""
    with tempfile.TemporaryDirectory() as dir_path:
        yield Path(dir_path)


@pytest.fixture()
def git_repo_setup(tmp_path: Path):
    """Initialize a temporary git repository and return its root Path.

    Many integration tests need a valid git repository to satisfy helper
    functions which call *git* under-the-hood (e.g. *get_git_root*).
    """
    repo = git.Repo.init(tmp_path)
    return {"repo": repo, "root": tmp_path}


@pytest.fixture()
def quartz_project_structure(tmp_path: Path):
    """Create a minimal Quartz directory layout under *tmp_path*.

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
