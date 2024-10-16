import pytest
from unittest.mock import patch, MagicMock
import shutil
from pathlib import Path
import subprocess
from .. import r2_upload
from .. import utils as script_utils
import os
import git  # type: ignore
import tempfile


@pytest.fixture()
def r2_cleanup():
    """Fixture to clean up uploaded files on R2 after each test."""
    uploaded_files = []
    yield uploaded_files
    for file in uploaded_files:
        subprocess.run(
            ["rclone", "delete", f"r2:{r2_upload.R2_BUCKET_NAME}/{file}"],
            check=True,
        )


@pytest.fixture
def test_media_setup(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """
    Fixture to set up a temporary test environment with:
        - A Quartz project structure (content, static directories).
        - Markdown files with image references.
        - Git initialization to simulate a real project.
    """
    monkeypatch.setenv("HOME", str(tmp_path))

    dirs = {
        "quartz": tmp_path / "quartz",
        "content": tmp_path / "quartz" / "content",
        "static": tmp_path / "quartz" / "static",
    }
    for d in dirs.values():
        d.mkdir(parents=True, exist_ok=True)

    test_files = [
        "test.jpg",
        "file1.webm",
        "file1.mp4",
        "file2.svg",
        "file3.avif",
        "file4.png",
        "file5.jpg",
    ]
    for f in test_files:
        (dirs["static"] / f).touch()

    md_content = {
        "test1.md": "Here's an image: ![](quartz/static/test.jpg)",
        "test2.md": "Multiple images: ![](quartz/static/test.jpg) ![](quartz/static/test.jpg)",
        "test3.md": "Here's a path which starts with a dot: ![](./static/test.jpg)",
        "patterns.md": "Standard: ![](quartz/static/test.jpg)\nMultiple: ![](quartz/static/test.jpg) ![](quartz/static/test.jpg)\nNo match: ![](quartz/static/other.jpg)\nInline: This is an inline ![](quartz/static/test.jpg) image.",
        "test.md": "\n".join(f"![](quartz/static/{f})" for f in test_files),
    }
    md_files = [(dirs["content"] / f, content) for f, content in md_content.items()]
    for file_path, content in md_files:
        file_path.write_text(content)

    subprocess.run(["git", "init", tmp_path], check=True)
    subprocess.run(
        ["git", "config", "user.email", "test@example.com"], cwd=tmp_path, check=True
    )
    subprocess.run(
        ["git", "config", "user.name", "Test User"], cwd=tmp_path, check=True
    )
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True)
    subprocess.run(["git", "commit", "-m", "Initial commit"], cwd=tmp_path, check=True)

    yield tmp_path, dirs["static"] / "test.jpg", dirs["content"], md_files

    shutil.rmtree(tmp_path)


@pytest.fixture
def mock_git_root(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    project_root = tmp_path / "turntrout.com"

    # Create a mock Repo object
    mock_repo = MagicMock()
    mock_repo.working_tree_dir = str(project_root)

    def mock_repo_init(*args, **kwargs):
        return mock_repo

    monkeypatch.setattr("git.Repo", mock_repo_init)

    def mock_get_git_root():
        return project_root

    monkeypatch.setattr(script_utils, "get_git_root", mock_get_git_root)
    return project_root


@pytest.fixture(autouse=True)
def mock_rclone():
    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        yield mock_run


@pytest.fixture(autouse=True)
def mock_home_directory(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    def mock_get_home_directory():
        return str(tmp_path)

    monkeypatch.setattr(r2_upload, "get_home_directory", mock_get_home_directory)


def test_verbose_output(mock_git_root: Path, capsys: pytest.CaptureFixture[str]):
    test_file = mock_git_root / "quartz" / "static" / "test_verbose.jpg"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.touch()

    with patch("subprocess.run"), patch("shutil.move"):
        r2_upload.upload_and_move(test_file, verbose=True)

    captured = capsys.readouterr()
    assert f"Uploading {test_file}" in captured.out
    assert "Moving original file:" in captured.out


def test_upload_to_r2_success(mock_git_root: Path, r2_cleanup: list[str]):
    test_file = mock_git_root / "quartz" / "static" / "test.jpg"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.touch()

    with patch("subprocess.run") as mock_run, patch("shutil.move"):
        r2_upload.upload_and_move(test_file)

    mock_run.assert_called_once()
    assert mock_run.call_args[0][0][2] == str(test_file)
    r2_cleanup.append("static/test.jpg")


@pytest.mark.parametrize(
    "input_path, expected_key",
    [
        ("/path/to/quartz/static/image.jpg", "static/image.jpg"),
        ("quartz/content/blog/post.md", "content/blog/post.md"),
        ("/quartz/assets/file.pdf", "assets/file.pdf"),
        ("no_matching_dir/file.txt", "no_matching_dir/file.txt"),
    ],
)
def test_get_r2_key(input_path: str, expected_key: str):
    assert r2_upload.get_r2_key(Path(input_path)) == expected_key


@pytest.mark.parametrize(
    "exception_class, file_path",
    [
        (FileNotFoundError, "quartz/non_existent.jpg"),
        (ValueError, "static/test.jpg"),
    ],
)
def test_upload_and_move_exceptions(
    mock_git_root: Path, exception_class: type[Exception], file_path: str
):
    with pytest.raises(exception_class):
        r2_upload.upload_and_move(mock_git_root / file_path)


@pytest.mark.parametrize(
    "mock_func, mock_side_effect, expected_exception",
    [
        (
            "subprocess.run",
            subprocess.CalledProcessError(1, "rclone"),
            RuntimeError,
        ),
        ("shutil.move", IOError("Permission denied"), IOError),
    ],
)
def test_upload_and_move_failures(
    mock_git_root: Path,
    mock_func: str,
    mock_side_effect: Exception,
    expected_exception: type[Exception],
):
    test_file = mock_git_root / "quartz" / "static" / "test_fail.jpg"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.touch()

    with patch("subprocess.run"), patch(mock_func, side_effect=mock_side_effect):
        with pytest.raises(expected_exception):
            r2_upload.upload_and_move(test_file)


@pytest.mark.parametrize(
    "args, expected_exception",
    [
        (["-v", "-m", tempfile.gettempdir(), "quartz/static/test.jpg"], None),
        (["quartz/static/non_existent_file.jpg"], FileNotFoundError),
        ([], SystemExit),
    ],
)
def test_main_function(
    mock_git_root: Path, args: list[str], expected_exception: type[Exception]
):
    if "quartz/static/test.jpg" in args:
        test_file = mock_git_root / "quartz" / "static" / "test.jpg"
        test_file.parent.mkdir(parents=True, exist_ok=True)
        test_file.touch()
        args = [arg.replace("quartz/static/test.jpg", str(test_file)) for arg in args]
        args = ["--replacement-dir", str(mock_git_root / "quartz" / "content")] + args
    with patch("sys.argv", ["r2_upload.py"] + args):
        if expected_exception:
            with pytest.raises(expected_exception):
                r2_upload.main()
        else:
            r2_upload.main()


def test_upload_and_move(
    test_media_setup: tuple[Path, Path, Path, list[tuple[Path, str]]],
    tmp_path: Path,
    r2_cleanup: list[str],
    mock_git_root: Path,
    mock_rclone: MagicMock,
):
    project_root, test_image, content_dir, md_files = test_media_setup
    move_to_dir = tmp_path / "moved"
    move_to_dir.mkdir()

    # Create the test image within the mock_git_root
    test_image = mock_git_root / test_image.relative_to(project_root)
    test_image.parent.mkdir(parents=True, exist_ok=True)
    test_image.touch()

    r2_upload.upload_and_move(
        test_image, replacement_dir=content_dir, move_to_dir=move_to_dir
    )

    r2_cleanup.append("static/test.jpg")

    # Check if the file is moved to the correct location with preserved structure
    expected_moved_path = move_to_dir / test_image.relative_to(mock_git_root)

    assert (
        expected_moved_path.exists()
    ), f"Expected moved file does not exist: {expected_moved_path}"
    assert not test_image.exists(), f"Original file still exists: {test_image}"

    # Check if rclone was called with the correct arguments
    mock_rclone.assert_called_with(
        [
            "rclone",
            "copyto",
            str(test_image),
            f"r2:{r2_upload.R2_BUCKET_NAME}/static/test.jpg",
        ],
        check=True,
    )

    for (file_path, _), expected_content in zip(
        md_files,
        [
            "Here's an image: ![](https://assets.turntrout.com/static/test.jpg)",
            "Multiple images: ![](https://assets.turntrout.com/static/test.jpg) ![](https://assets.turntrout.com/static/test.jpg)",
            "Here's a path which starts with a dot: ![](https://assets.turntrout.com/static/test.jpg)",
            "Standard: ![](https://assets.turntrout.com/static/test.jpg)\nMultiple: ![](https://assets.turntrout.com/static/test.jpg) ![](https://assets.turntrout.com/static/test.jpg)\nNo match: ![](quartz/static/other.jpg)\nInline: This is an inline ![](https://assets.turntrout.com/static/test.jpg) image.",
        ],
    ):
        assert file_path.read_text().strip() == expected_content.strip()


def test_main_upload_all_custom_filetypes(
    test_media_setup: tuple[Path, Path, Path, list[tuple[Path, str]]],
    mock_git_root: Path,
    mock_rclone: MagicMock,
):
    # Use the mock_git_root instead of tmp_path
    static_dir = mock_git_root / "quartz" / "static"
    content_dir = mock_git_root / "quartz" / "content"
    static_dir.mkdir(parents=True, exist_ok=True)
    content_dir.mkdir(parents=True, exist_ok=True)

    # Create test files
    (static_dir / "file4.png").touch()
    (static_dir / "file5.jpg").touch()

    # Create a test markdown file
    test_md = content_dir / "test.md"
    test_md.write_text("![](quartz/static/file4.png)\n![](quartz/static/file5.jpg)")

    arg_list = [
        "r2_upload.py",
        "--all-asset-dir",
        str(static_dir),
        "--filetypes",
        ".png",
        ".jpg",
        "--replacement-dir",
        str(content_dir),
    ]
    with patch("sys.argv", arg_list):
        r2_upload.main()

    md_content: str = test_md.read_text()
    for file in ("file4.png", "file5.jpg"):
        assert f"https://assets.turntrout.com/static/{file}" in md_content

    # Check if rclone was called for both PNG and JPG files
    assert any(
        call[0][0]
        == [
            "rclone",
            "copyto",
            str(static_dir / "file4.png"),
            f"r2:{r2_upload.R2_BUCKET_NAME}/static/file4.png",
        ]
        for call in mock_rclone.call_args_list
    )
    assert any(
        call[0][0]
        == [
            "rclone",
            "copyto",
            str(static_dir / "file5.jpg"),
            f"r2:{r2_upload.R2_BUCKET_NAME}/static/file5.jpg",
        ]
        for call in mock_rclone.call_args_list
    )

    # Count the number of 'copyto' calls
    copyto_count = sum(
        1 for call in mock_rclone.call_args_list if call[0][0][1] == "copyto"
    )
    assert copyto_count == 2, f"Expected 2 'copyto' calls, but got {copyto_count}"


def test_preserve_path_structure(mock_git_root: Path, tmp_path: Path):
    move_to_dir = tmp_path / "external_backup"
    move_to_dir.mkdir()

    deep_file = (
        mock_git_root / "quartz" / "static" / "images" / "deep" / "test_deep.jpg"
    )
    deep_file.parent.mkdir(parents=True)
    deep_file.touch()

    with patch("subprocess.run"), patch("shutil.move") as mock_move:
        r2_upload.upload_and_move(deep_file, move_to_dir=move_to_dir)

    expected_moved_path = move_to_dir / deep_file.relative_to(mock_git_root)
    mock_move.assert_called_once_with(str(deep_file), str(expected_moved_path))


def test_preserve_path_structure_with_replacement(mock_git_root: Path, tmp_path: Path):
    move_to_dir = tmp_path / "external_backup"
    move_to_dir.mkdir()

    content_dir = mock_git_root / "quartz" / "content"
    content_dir.mkdir(parents=True)

    static_file = mock_git_root / "quartz" / "static" / "images" / "test_static.jpg"
    static_file.parent.mkdir(parents=True)
    static_file.touch()

    md_file = content_dir / "test_reference.md"
    md_file.write_text(f"![Test Image](quartz/static/images/test_static.jpg)")

    with patch("subprocess.run"), patch("shutil.move") as mock_move:
        r2_upload.upload_and_move(
            static_file, replacement_dir=content_dir, move_to_dir=move_to_dir
        )

    expected_moved_path = move_to_dir / static_file.relative_to(mock_git_root)
    mock_move.assert_called_once_with(str(static_file), str(expected_moved_path))

    updated_md_content = md_file.read_text()
    assert (
        "![Test Image](https://assets.turntrout.com/static/images/test_static.jpg)"
        in updated_md_content
    )


def test_strict_static_path_matching(
    test_media_setup: tuple[Path, Path, Path, list[tuple[Path, str]]],
    mock_git_root: Path,
):
    _, _, content_dir, _ = test_media_setup

    md_content = """
    1. Correct: ![image](/static/images/test.jpg)
    2. Incorrect: ![image](a/static/images/test.jpg)
    """

    md_file = content_dir / "test.md"
    md_file.write_text(md_content)

    test_image = mock_git_root / "quartz" / "static" / "images" / "test.jpg"
    test_image.parent.mkdir(parents=True, exist_ok=True)
    test_image.touch()

    with patch("subprocess.run"), patch("shutil.move"):
        r2_upload.upload_and_move(test_image, replacement_dir=content_dir)

    updated_content = md_file.read_text()
    expected_url = "https://assets.turntrout.com/static/images/test.jpg"

    assert f"![image]({expected_url})" in updated_content
    assert (
        "![image](a/static/images/test.jpg)" in updated_content
    ), "Incorrect case was unexpectedly modified"
