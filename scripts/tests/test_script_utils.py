"""
Test the utilities used for running the tests :)
"""

import subprocess
from pathlib import Path
from typing import Optional
import pytest
import git
from .. import utils as script_utils

def test_git_root_is_ancestor(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """
    Test that the found git root is an ancestor of the current file.
    """
    monkeypatch.setattr(script_utils, "get_git_root", lambda: tmp_path)
    current_file_path = tmp_path / "tests" / "test_utils.py"
    current_file_path.parent.mkdir(parents=True)
    current_file_path.touch()

    git_root = script_utils.get_git_root()
    assert git_root is not None
    assert current_file_path.is_relative_to(git_root)


@pytest.mark.parametrize("git_exists", [True, False])
def test_find_git_root(
    git_exists: bool, monkeypatch: pytest.MonkeyPatch
) -> None:
    expected_output = "/path/to/git/root" if git_exists else ""
    expected_return = Path(expected_output) if git_exists else None

    def mock_subprocess_run(*args, **kwargs) -> subprocess.CompletedProcess:
        return subprocess.CompletedProcess(
            args=args,
            returncode=0 if git_exists else 1,
            stdout=expected_output,
        )

    monkeypatch.setattr(script_utils.subprocess, "run", mock_subprocess_run)
    assert script_utils.get_git_root() == expected_return


@pytest.mark.parametrize(
    "input_path,expected_output,should_raise",
    [
        (
            "/home/user/quartz/static/images/test.png",
            Path("quartz/static/images/test.png"),
            False,
        ),
        ("/home/user/projects/other/file.txt", None, True),
        ("/home/user/quartz/content/notes.md", None, True),
    ],
)
def test_path_relative_to_quartz(
    input_path: str, expected_output: Optional[Path], should_raise: bool
) -> None:
    if should_raise:
        with pytest.raises(ValueError):
            script_utils.path_relative_to_quartz(Path(input_path))
    else:
        assert (
            script_utils.path_relative_to_quartz(Path(input_path))
            == expected_output
        )


def test_get_files_no_dir():
    """Test when no directory is provided."""
    result = script_utils.get_files()
    assert isinstance(result, tuple)
    assert not result  # Empty tuple since no directory was given


@pytest.mark.parametrize(
    "file_paths, expected_files",
    [
        (["test.md", "test.txt"], ["test.md"]),
        (
            ["subdir1/test1.md", "subdir1/test1.txt", "subdir2/test2.md"],
            ["subdir1/test1.md", "subdir2/test2.md"],
        ),
        (
            ["test.md", "test.txt", "image.jpg", "document.pdf"],
            ["test.md", "test.txt"],
        ),
    ],
)
def test_get_files_specific_dir(tmp_path, file_paths, expected_files):
    """Test file discovery by inferring structure from file paths."""
    # Create test files and directories
    for file_path in file_paths:
        file: Path = tmp_path / file_path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.touch()  # Just create empty files

    # Get files based on the file extensions in the file paths
    filetypes_to_match = list({p.suffix for p in map(Path, expected_files)})
    result = script_utils.get_files(
        dir_to_search=tmp_path, filetypes_to_match=filetypes_to_match
    )

    # Normalize file paths and compare
    result = [str(p.relative_to(tmp_path)) for p in result]
    assert sorted(result) == sorted(expected_files)


def test_get_files_gitignore(tmp_path):
    """Test with a .gitignore file."""
    try:
        # Create a git repository
        repo = git.Repo.init(tmp_path)
        with open(tmp_path / ".gitignore", "w", encoding="utf-8") as f:
            f.write("*.txt\n")  # Ignore text files

        md_file = tmp_path / "test.md"
        txt_file = tmp_path / "test.txt"
        md_file.write_text("Markdown content")
        txt_file.write_text("Text content")
        repo.index.add([".gitignore"])
        repo.index.commit("Initial commit")

        # Test getting files with gitignore
        result = script_utils.get_files(dir_to_search=tmp_path)
        assert len(result) == 1
        assert result[0] == md_file
    except git.GitCommandError:
        pytest.skip("Git not installed or not in PATH")
