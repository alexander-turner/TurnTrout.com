import shutil
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from .. import r2_upload
from .. import utils as script_utils
from .utils import create_markdown_file


@pytest.fixture()
def r2_cleanup():
    """Fixture to clean up uploaded files on R2 after each test."""
    uploaded_files = []
    yield uploaded_files
    for file in uploaded_files:
        rclone_executable = script_utils.find_executable("rclone")
        subprocess.run(
            [
                rclone_executable,
                "delete",
                f"r2:{r2_upload.R2_BUCKET_NAME}/{file}",
            ],
            check=True,
        )


@pytest.fixture
def test_media_setup(
    quartz_project_structure, monkeypatch: pytest.MonkeyPatch
):
    """
    Fixture to set up a temporary test environment with:
        - A Quartz project structure (content, static directories).
        - Markdown files with image references.
        - Git initialization to simulate a real project.
    """
    tmp_path = quartz_project_structure["public"].parent
    monkeypatch.setenv("HOME", str(tmp_path))

    dirs = {
        "quartz": tmp_path / "quartz",
        "website_content": quartz_project_structure["content"],
        "static": quartz_project_structure["static"],
    }

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
    md_files = [
        (dirs["website_content"] / f, content)
        for f, content in md_content.items()
    ]
    for file_path, content in md_files:
        create_markdown_file(file_path, content=content)

    git_executable = script_utils.find_executable("git")
    subprocess.run([git_executable, "init", tmp_path], check=True)
    subprocess.run(
        [git_executable, "config", "user.email", "test@example.com"],
        cwd=tmp_path,
        check=True,
    )
    subprocess.run(
        [git_executable, "config", "user.name", "Test User"],
        cwd=tmp_path,
        check=True,
    )
    subprocess.run([git_executable, "add", "."], cwd=tmp_path, check=True)
    subprocess.run(
        [git_executable, "commit", "-m", "Initial commit"],
        cwd=tmp_path,
        check=True,
    )

    yield tmp_path, dirs["static"] / "test.jpg", dirs[
        "website_content"
    ], md_files

    shutil.rmtree(tmp_path)


@pytest.fixture(autouse=True)
def mock_home_directory(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    r2_upload._HOME_DIR = tmp_path


def test_verbose_output(
    mock_git_root: Path, capsys: pytest.CaptureFixture[str], tmp_path: Path
):
    test_file = mock_git_root / "quartz" / "static" / "test_verbose.jpg"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.touch()

    with patch("subprocess.run"), patch("shutil.move"):
        r2_upload.upload_and_move(
            test_file, verbose=True, move_to_dir=tmp_path
        )

    captured = capsys.readouterr()
    assert f"Uploading {test_file}" in captured.out
    assert "Moving original file:" in captured.out


def test_upload_to_r2_success(mock_git_root: Path):
    test_file = mock_git_root / "quartz" / "static" / "test.jpg"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.touch()

    with (
        patch(
            "scripts.r2_upload.script_utils.find_executable",
            return_value="rclone",
        ),
        patch("subprocess.run") as mock_run,
        patch("shutil.move"),
    ):
        r2_upload.upload_and_move(test_file)

    # Check that subprocess.run was called twice
    assert mock_run.call_count == 2
    # Check the first call (check_exists_on_r2)
    assert mock_run.call_args_list[0][0][0][:2] == ["rclone", "ls"]
    # Check the second call (upload)
    assert mock_run.call_args_list[1][0][0][:2] == ["rclone", "copyto"]
    assert mock_run.call_args_list[1][0][0][2] == str(test_file)


@pytest.mark.parametrize(
    "input_path, expected_key",
    [
        ("/path/to/quartz/static/image.jpg", "static/image.jpg"),
        (
            "quartz/website_content/blog/post.md",
            "website_content/blog/post.md",
        ),
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
            "scripts.r2_upload.subprocess.run",
            subprocess.CalledProcessError(1, "rclone"),
            RuntimeError,
        ),
        (
            "scripts.r2_upload.shutil.move",
            OSError("Permission denied"),
            OSError,
        ),
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

    with (
        patch(mock_func, side_effect=mock_side_effect),
        patch("scripts.r2_upload.check_exists_on_r2", return_value=False),
        pytest.raises(expected_exception),
    ):
        r2_upload.upload_and_move(test_file, move_to_dir=mock_git_root)


@pytest.mark.parametrize(
    "args, expected_exception",
    [
        (
            [
                "--verbose",
                "--move-to-dir",
                tempfile.gettempdir(),
                "quartz/static/test.jpg",
            ],
            None,
        ),
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
        args = [
            arg.replace("quartz/static/test.jpg", str(test_file))
            for arg in args
        ]
        args = [
            "--references-dir",
            str(mock_git_root / "quartz" / "website_content"),
        ] + args
    with patch("sys.argv", ["r2_upload.py"] + args):
        if expected_exception:
            with pytest.raises(expected_exception):
                r2_upload.main()
        else:
            r2_upload.main()


def test_upload_and_move(
    test_media_setup: tuple[Path, Path, Path, list[tuple[Path, str]]],
    tmp_path: Path,
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
        test_image, references_dir=content_dir, move_to_dir=move_to_dir
    )

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
    # Create a mock Repo object
    mock_repo = MagicMock()
    mock_repo.working_tree_dir = str(mock_git_root)
    mock_repo.ignored = MagicMock(return_value=False)  # Don't ignore any files

    with patch("git.Repo") as mock_git:
        mock_git.return_value = mock_repo

        # Use the mock_git_root instead of tmp_path
        static_dir = mock_git_root / "quartz" / "static"
        content_dir = mock_git_root / "quartz" / "website_content"
        static_dir.mkdir(parents=True, exist_ok=True)
        content_dir.mkdir(parents=True, exist_ok=True)

        # Create test files
        (static_dir / "file4.png").touch()
        (static_dir / "file5.jpg").touch()

        # Create a test markdown file
        test_md = content_dir / "test.md"
        create_markdown_file(
            test_md,
            content="![](quartz/static/file4.png)\n![](quartz/static/file5.jpg)",
        )

        arg_list = [
            "r2_upload.py",
            "--upload-from-directory",
            str(static_dir),
            "--filetypes",
            ".png",
            ".jpg",
            "--references-dir",
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
            1
            for call in mock_rclone.call_args_list
            if call[0][0][1] == "copyto"
        )
        assert (
            copyto_count == 2
        ), f"Expected 2 'copyto' calls, but got {copyto_count}"


def test_preserve_path_structure(mock_git_root: Path, tmp_path: Path):
    move_to_dir = tmp_path / "external_backup"
    move_to_dir.mkdir()

    deep_file = (
        mock_git_root
        / "quartz"
        / "static"
        / "images"
        / "deep"
        / "test_deep.jpg"
    )
    deep_file.parent.mkdir(parents=True)
    deep_file.touch()

    with patch("subprocess.run"), patch("shutil.move") as mock_move:
        r2_upload.upload_and_move(
            deep_file, move_to_dir=move_to_dir, references_dir=None
        )

    expected_moved_path = move_to_dir / deep_file.relative_to(mock_git_root)
    mock_move.assert_called_once_with(str(deep_file), str(expected_moved_path))


def test_preserve_path_structure_with_replacement(
    mock_git_root: Path, tmp_path: Path
):
    # Create a mock Repo object
    mock_repo = MagicMock()
    mock_repo.working_tree_dir = str(mock_git_root)
    mock_repo.ignored = MagicMock(return_value=False)  # Don't ignore any files

    with patch("git.Repo") as mock_git:
        mock_git.return_value = mock_repo

        move_to_dir = tmp_path / "external_backup"
        move_to_dir.mkdir()

        content_dir = mock_git_root / "quartz" / "website_content"
        content_dir.mkdir(parents=True)

        static_file = (
            mock_git_root / "quartz" / "static" / "images" / "test_static.jpg"
        )
        static_file.parent.mkdir(parents=True)
        static_file.touch()

        md_file = content_dir / "test_reference.md"
        create_markdown_file(
            md_file,
            content="![Test Image](quartz/static/images/test_static.jpg)",
        )

        with patch("subprocess.run"), patch("shutil.move") as mock_move:
            r2_upload.upload_and_move(
                static_file,
                references_dir=content_dir,
                move_to_dir=move_to_dir,
            )

        expected_moved_path = move_to_dir / static_file.relative_to(
            mock_git_root
        )
        mock_move.assert_called_once_with(
            str(static_file), str(expected_moved_path)
        )

        updated_md_content = md_file.read_text()
        assert (
            "![Test Image](https://assets.turntrout.com/static/images/test_static.jpg)"
            in updated_md_content
        )


def test_check_exists_on_r2_file_exists():
    with (
        patch(
            "scripts.r2_upload.script_utils.find_executable",
            return_value="rclone",
        ),
        patch("subprocess.run") as mock_run,
    ):
        mock_run.return_value = MagicMock(returncode=0, stdout="file.txt\n")
        result = r2_upload.check_exists_on_r2("r2:bucket/file.txt")
        assert result is True
        mock_run.assert_called_once_with(
            ["rclone", "ls", "r2:bucket"],
            capture_output=True,
            text=True,
            check=False,
        )


def test_check_exists_on_r2_file_not_exists():
    with (
        patch(
            "scripts.r2_upload.script_utils.find_executable",
            return_value="rclone",
        ),
        patch("subprocess.run") as mock_run,
    ):
        mock_run.return_value = MagicMock(returncode=0, stdout="")
        result = r2_upload.check_exists_on_r2("r2:bucket/nonexistent.txt")
        assert result is False
        mock_run.assert_called_once_with(
            ["rclone", "ls", "r2:bucket"],
            capture_output=True,
            text=True,
            check=False,
        )


def test_check_exists_on_r2_verbose_output(capsys):
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="file.txt\n")
        r2_upload.check_exists_on_r2("r2:bucket/file.txt", verbose=True)
        captured = capsys.readouterr()
        assert "File found in R2: r2:bucket/file.txt" in captured.out

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="")
        r2_upload.check_exists_on_r2("r2:bucket/nonexistent.txt", verbose=True)
        captured = capsys.readouterr()
        assert (
            "No existing file found in R2: r2:bucket/nonexistent.txt"
            in captured.out
        )


def test_upload_non_existing_file(mock_git_root: Path, tmp_path: Path):
    test_file = mock_git_root / "quartz" / "static" / "test_non_existing.jpg"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.touch()

    with (
        patch(
            "scripts.r2_upload.check_exists_on_r2", return_value=False
        ) as mock_check,
        patch("subprocess.run") as mock_run,
        patch("shutil.move") as mock_move,
    ):

        r2_upload.upload_and_move(
            test_file, verbose=True, move_to_dir=tmp_path
        )

        mock_check.assert_called_once_with(
            f"r2:{r2_upload.R2_BUCKET_NAME}/static/test_non_existing.jpg", True
        )

        mock_run.assert_called_with(
            [
                "rclone",
                "copyto",
                str(test_file),
                f"r2:{r2_upload.R2_BUCKET_NAME}/static/test_non_existing.jpg",
            ],
            check=True,
        )

        mock_move.assert_called_once()


def test_upload_and_move_file_exists(
    mock_git_root: Path, capsys: pytest.CaptureFixture[str]
):
    test_file = mock_git_root / "quartz" / "static" / "test.jpg"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.touch()

    with (
        patch("scripts.r2_upload.check_exists_on_r2", return_value=True),
        patch("subprocess.run"),
        patch("shutil.move"),
    ):
        r2_upload.upload_and_move(
            test_file, verbose=True, overwrite_existing=False
        )

    captured = capsys.readouterr()
    assert (
        "File 'static/test.jpg' already exists in R2. Use '--overwrite-existing' to overwrite."
        in captured.out
    )


def test_upload_to_r2_overwrite_print(
    mock_git_root: Path, capsys: pytest.CaptureFixture[str]
):
    """Test red print output when overwriting an existing file."""
    test_file = mock_git_root / "quartz" / "static" / "test_overwrite_out.jpg"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.touch()

    with (
        patch("scripts.r2_upload.check_exists_on_r2", return_value=True),
        patch("scripts.r2_upload._download_from_r2"),
    ):
        r2_upload.upload_to_r2(
            test_file, verbose=True, overwrite_existing=True
        )

    captured = capsys.readouterr()
    # Check for the red color ANSI escape codes in the output
    red_start = "\033[91m"
    red_end = "\033[0m"
    expected_output = (
        f"{red_start}Overwriting existing file in R2: "
        f"static/test_overwrite_out.jpg{red_end}"
    )
    assert expected_output in captured.out
    assert "Downloaded backup from R2" in captured.out


def test_upload_to_r2_download_backup(mock_git_root: Path, tmp_path: Path):
    """Test file backup logic when overwriting an existing file."""
    test_file = mock_git_root / "quartz" / "static" / "test_overwrite_move.jpg"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.write_text("Original content")

    r2_key = r2_upload.get_r2_key(test_file)
    upload_target = f"r2:{r2_upload.R2_BUCKET_NAME}/{r2_key}"
    expected_backup_path = tmp_path / test_file.name

    with (
        patch("scripts.r2_upload.check_exists_on_r2", return_value=True),
        patch("scripts.r2_upload._download_from_r2") as mock_download,
        patch("scripts.r2_upload.tempfile.gettempdir", return_value=tmp_path),
    ):
        r2_upload.upload_to_r2(
            test_file,
            overwrite_existing=True,
        )

    mock_download.assert_called_once_with(upload_target, expected_backup_path)

    # Verify the original file still exists
    assert test_file.exists()
    assert test_file.read_text() == "Original content"


# Ensure we tell rclone to handle the MIME header correctly
def test_upload_svg_with_metadata(mock_git_root: Path):
    test_file = mock_git_root / "quartz" / "static" / "test.svg"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.touch()

    with patch("subprocess.run") as mock_run, patch("shutil.move"):
        r2_upload.upload_and_move(test_file, verbose=True)

        # Check that rclone was called with the correct metadata for SVG
        mock_run.assert_any_call(
            [
                "rclone",
                "copyto",
                str(test_file),
                f"r2:{r2_upload.R2_BUCKET_NAME}/static/test.svg",
                "--metadata-set",
                "content-type=image/svg+xml",
            ],
            check=True,
        )


def test_move_uploaded_file(mock_git_root: Path, tmp_path: Path):
    """Test that move_uploaded_file preserves directory structure."""
    source_file = mock_git_root / "quartz" / "static" / "deep" / "test.jpg"
    source_file.parent.mkdir(parents=True)
    source_file.touch()

    move_to_dir = tmp_path / "backup"

    r2_upload.move_uploaded_file(source_file, move_to_dir, verbose=True)

    expected_path = move_to_dir / "quartz" / "static" / "deep" / "test.jpg"
    assert expected_path.exists()
    assert not source_file.exists()


def test_move_uploaded_file_error_handling(
    mock_git_root: Path, tmp_path: Path
):
    """Test error handling when move operation fails."""
    source_file = mock_git_root / "quartz" / "static" / "test.jpg"
    source_file.parent.mkdir(parents=True)
    source_file.touch()

    move_to_dir = tmp_path / "backup"
    move_to_dir.mkdir()

    # Make the target directory read-only to force a permission error
    move_to_dir.chmod(0o444)

    with pytest.raises(OSError):
        r2_upload.move_uploaded_file(source_file, move_to_dir)


def test_move_uploaded_file_nonexistent_source(
    mock_git_root: Path, tmp_path: Path
):
    """Test error handling when source file doesn't exist."""
    source_file = mock_git_root / "quartz" / "static" / "nonexistent.jpg"
    move_to_dir = tmp_path / "backup"

    with pytest.raises(FileNotFoundError):
        r2_upload.move_uploaded_file(source_file, move_to_dir)


def test_upload_and_move_nonexistent_move_dir(
    mock_git_root: Path,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
):
    """Test handling of nonexistent move directory."""
    test_file = mock_git_root / "quartz" / "static" / "test.jpg"
    test_file.parent.mkdir(parents=True)
    test_file.touch()

    nonexistent_dir = tmp_path / "nonexistent"

    with patch("subprocess.run"):
        r2_upload.upload_and_move(test_file, move_to_dir=nonexistent_dir)

    captured = capsys.readouterr()
    assert (
        f"Warning: Directory does not exist: {nonexistent_dir}" in captured.out
    )


def test_update_markdown_references_with_links(
    tmp_path: Path, mock_git_root: Path
):
    """Test updating both image references and regular links."""
    content_dir = tmp_path / "website_content"
    content_dir.mkdir()

    test_file = mock_git_root / "quartz" / "static" / "docs" / "doc.pdf"
    test_file.parent.mkdir(parents=True)
    test_file.touch()

    photo_relative_path = "static/docs/photo.png"
    md_content = f"""
    # Test Document
    ![Image](quartz/{photo_relative_path})
    [Download PDF](./static/docs/doc.pdf)
    [Other Link](different/path/file.pdf)
    Text
    """

    md_file = content_dir / "test.md"
    create_markdown_file(md_file, content=md_content)

    r2_key = r2_upload.get_r2_key(test_file)
    r2_address = f"https://assets.turntrout.com/{r2_key}"

    r2_upload.update_markdown_references(
        test_file, r2_address, references_dir=content_dir
    )

    updated_content = md_file.read_text()

    expected_content = f"""
    # Test Document
    ![Image](quartz/{photo_relative_path})
    [Download PDF]({r2_address})
    [Other Link](different/path/file.pdf)
    Text
    """

    assert updated_content == expected_content


def test_update_markdown_references_no_references_dir():
    """Test handling when no references directory is provided."""
    test_file = Path("quartz/static/test.jpg")
    r2_address = "https://assets.turntrout.com/static/test.jpg"

    # Should not raise any errors
    r2_upload.update_markdown_references(test_file, r2_address)


def test_update_markdown_references_verbose_output(
    tmp_path: Path, mock_git_root: Path, capsys: pytest.CaptureFixture[str]
):
    """Test verbose output during reference updates."""
    content_dir = tmp_path / "website_content"
    content_dir.mkdir()

    test_file = mock_git_root / "quartz" / "static" / "test.jpg"
    test_file.parent.mkdir(parents=True)
    test_file.touch()

    md_file = content_dir / "test.md"
    create_markdown_file(md_file, content="![](quartz/static/test.jpg)")

    r2_address = "https://assets.turntrout.com/static/test.jpg"

    r2_upload.update_markdown_references(
        test_file, r2_address, references_dir=content_dir, verbose=True
    )

    captured = capsys.readouterr()
    assert 'Changing "static/test.jpg" references to' in captured.out
    assert r2_address in captured.out


def test_files_to_upload_ignores_gitignore(mock_git_root: Path):
    """Test that --upload-from-directory finds all files, including those that
    would be ignored by git."""
    static_dir = mock_git_root / "quartz" / "static"
    content_dir = mock_git_root / "quartz" / "website_content"
    static_dir.mkdir(parents=True, exist_ok=True)
    content_dir.mkdir(parents=True, exist_ok=True)

    # Create a .gitignore file at the project root
    (mock_git_root / ".gitignore").write_text("*.ignored.png\n")

    # Create test files
    ignored_file = static_dir / "test.ignored.png"
    ignored_file.touch()
    regular_file = static_dir / "test.regular.png"
    regular_file.touch()
    existing_png_file = static_dir / "file4.png"
    existing_png_file.touch()

    arg_list = [
        "r2_upload.py",
        "--upload-from-directory",
        str(static_dir),
        "--filetypes",
        ".png",
        "--references-dir",
        str(content_dir),
    ]

    with (
        patch("sys.argv", arg_list),
        patch("scripts.r2_upload.upload_and_move") as mock_upload_and_move,
    ):
        r2_upload.main()

    uploaded_files = {
        call.args[0] for call in mock_upload_and_move.call_args_list
    }

    expected_files = {ignored_file, regular_file, existing_png_file}

    assert uploaded_files == expected_files
