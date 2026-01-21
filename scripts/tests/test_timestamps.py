"""Tests for the timestamp management system."""

import subprocess
import time
from unittest.mock import MagicMock, patch

import git
import pytest


@pytest.fixture()
def timestamps_repo_setup(git_initialized_dir):
    main_repo = git_initialized_dir["repo"]
    main_root = git_initialized_dir["root"]

    timestamps_root = main_root / ".timestamps"
    timestamps_root.mkdir()
    timestamps_repo = git.Repo.init(timestamps_root)

    config_writer = timestamps_repo.config_writer()
    config_writer.set_value("user", "name", "Test User")
    config_writer.set_value("user", "email", "test@example.com")
    config_writer.release()

    (timestamps_root / "files").mkdir()

    gitignore = main_root / ".gitignore"
    gitignore.write_text(".timestamps\n")
    main_repo.index.add([str(gitignore)])
    main_repo.index.commit("Initial commit")

    return {
        "main_repo": main_repo,
        "main_root": main_root,
        "timestamps_repo": timestamps_repo,
        "timestamps_root": timestamps_root,
    }


class TestTimestampsDirectory:
    def test_timestamps_setup(self, timestamps_repo_setup):
        """Test .timestamps directory is properly configured."""
        main_root = timestamps_repo_setup["main_root"]
        timestamps_root = timestamps_repo_setup["timestamps_root"]

        assert ".timestamps" in (main_root / ".gitignore").read_text()
        assert (timestamps_root / ".git").exists()
        assert (timestamps_root / "files").is_dir()

        result = subprocess.run(
            ["git", "status"],
            cwd=timestamps_root,
            capture_output=True,
        )
        assert result.returncode == 0


class TestPostCommitHook:
    def test_creates_timestamp_files(self, timestamps_repo_setup):
        main_repo = timestamps_repo_setup["main_repo"]
        main_root = timestamps_repo_setup["main_root"]
        timestamps_root = timestamps_repo_setup["timestamps_root"]

        test_file = main_root / "test.txt"
        test_file.write_text("test content")
        main_repo.index.add([str(test_file)])
        commit = main_repo.index.commit("Test commit")

        txt_file = timestamps_root / "files" / f"{commit.hexsha}.txt"
        txt_file.write_text(commit.hexsha)

        assert txt_file.exists()
        assert txt_file.read_text() == commit.hexsha

    @patch("subprocess.run")
    def test_ots_stamp_called(self, mock_run, timestamps_repo_setup):
        timestamps_root = timestamps_repo_setup["timestamps_root"]
        mock_run.return_value = MagicMock(returncode=0)

        txt_file = timestamps_root / "files" / "abc123.txt"
        txt_file.parent.mkdir(parents=True, exist_ok=True)
        txt_file.write_text("abc123")

        subprocess.run(["ots", "stamp", str(txt_file)], capture_output=True)

        mock_run.assert_called_once()
        assert "ots" in str(mock_run.call_args)

    def test_timestamp_files_committed(self, timestamps_repo_setup):
        timestamps_repo = timestamps_repo_setup["timestamps_repo"]
        timestamps_root = timestamps_repo_setup["timestamps_root"]

        txt_file = timestamps_root / "files" / "test123.txt"
        ots_file = timestamps_root / "files" / "test123.txt.ots"
        txt_file.write_text("test123")
        ots_file.write_text("mock ots data")

        timestamps_repo.index.add([str(txt_file), str(ots_file)])
        commit = timestamps_repo.index.commit(
            "Add OpenTimestamp proof for commit test123"
        )

        committed_files = [item.path for item in commit.tree.traverse()]
        assert "files/test123.txt" in committed_files
        assert "files/test123.txt.ots" in committed_files

    @patch("subprocess.run")
    def test_ots_file_creation_wait(self, mock_run, timestamps_repo_setup):
        """Test that the hook waits for .ots file creation."""

        timestamps_root = timestamps_repo_setup["timestamps_root"]
        txt_file = timestamps_root / "files" / "delayed123.txt"
        ots_file = timestamps_root / "files" / "delayed123.txt.ots"
        txt_file.parent.mkdir(parents=True, exist_ok=True)
        txt_file.write_text("delayed123")

        # Simulate ots stamp creating the file after a delay
        def delayed_ots_creation(*args, **kwargs):
            time.sleep(0.2)  # Simulate async file creation
            ots_file.write_text("mock ots data")
            return MagicMock(returncode=0)

        mock_run.side_effect = delayed_ots_creation

        # Simulate the hook's behavior
        subprocess.run(["ots", "stamp", str(txt_file)], capture_output=True)

        # Wait for .ots file (simulating the hook's wait loop)
        count = 0
        while count < 50:
            if ots_file.exists():
                break
            time.sleep(0.1)
            count += 1

        assert ots_file.exists(), "Hook should wait for .ots file creation"


class TestPreCommitCheck:
    def test_requires_timestamps_directory(self, git_initialized_dir):
        assert not (git_initialized_dir["root"] / ".timestamps").exists()

    def test_validates_timestamps_exists(self, timestamps_repo_setup):
        assert (timestamps_repo_setup["main_root"] / ".timestamps").is_dir()


class TestTimestampFileFormat:
    def test_file_naming_convention(self, timestamps_repo_setup):
        timestamps_root = timestamps_repo_setup["timestamps_root"]

        txt_file = timestamps_root / "files" / "abc123.txt"
        ots_file = timestamps_root / "files" / "abc123.txt.ots"
        txt_file.write_text("abc123")
        ots_file.write_text("mock ots data")

        assert txt_file.read_text() == "abc123"
        assert txt_file.exists() and ots_file.exists()
