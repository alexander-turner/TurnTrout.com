import io
import tempfile
import unittest.mock as mock
from pathlib import Path

import pytest

from .. import convert_markdown_yaml

try:
    # ruff: noqa: F401
    from .utils import setup_test_env  # type: ignore
except ImportError:
    pass


@pytest.fixture
def mock_git_root(tmp_path):
    git_root = tmp_path / "git"
    git_root.mkdir()
    (git_root / "quartz" / "static" / "images" / "card_images").mkdir(
        parents=True
    )
    (git_root / "static" / "images" / "posts").mkdir(parents=True)
    with mock.patch("scripts.utils.get_git_root", return_value=git_root):
        yield git_root


mock_r2_upload = mock.MagicMock()
mock.patch.dict("sys.modules", {"r2_upload": mock_r2_upload}).start()


@pytest.mark.parametrize(
    "markdown_content",
    [
        # No YAML front matter
        """
Some content without YAML front matter.
![](static/image.avif)
""",
        # YAML front matter without card_image
        """
---
title: Test Post
date: 2023-10-10
---
Content with no card_image.
""",
        # card_image does not end with .avif
        """
---
title: Test Post
date: 2023-10-10
card_image: static/image.png
---
Content with non-AVIF card_image.
""",
    ],
)
def test_process_card_image_in_markdown_skips_cases(
    setup_test_env, mock_git_root, markdown_content
):
    md_file = mock_git_root / "static" / "images" / "posts" / "test.md"
    md_file.write_text(markdown_content)

    with (
        mock.patch("requests.get") as mock_get,
        mock.patch("subprocess.run") as mock_subproc_run,
        mock.patch("shutil.move") as mock_shutil_move,
        mock.patch(
            "scripts.convert_markdown_yaml.r2_upload.upload_and_move"
        ) as mock_r2_upload,
    ):

        convert_markdown_yaml.process_card_image_in_markdown(md_file)

        # Ensure that no download was attempted
        mock_get.assert_not_called()
        # Ensure that no subprocess was run
        mock_subproc_run.assert_not_called()
        # Ensure that no file was moved
        mock_shutil_move.assert_not_called()
        # Ensure that R2 upload was not called
        mock_r2_upload.assert_not_called()

        # Markdown file should remain unchanged
        assert md_file.read_text() == markdown_content


@pytest.mark.parametrize(
    "test_id, markdown_content, md_filename_suffix",
    [
        (
            "no_url",
            """---
title: Test Post
date: 2023-10-10
---
Content with no card_image.""",
            "no_url.md",
        ),
        (
            "wrong_extension",
            """---
title: Test Post
date: 2023-10-10
card_image: static/image.gif
---
Content with non-convertible card_image.""",
            "wrong_ext.md",
        ),
        (
            "already_processed",
            """---
title: Test Post
date: 2023-10-10
card_image: https://assets.turntrout.com/images/card_images/image.png
---
Content with already processed card_image.""",
            "processed.md",
        ),
        (
            "no_frontmatter",
            """
Some content without YAML front matter.
![](static/image.avif)
""",
            "no_frontmatter.md",
        ),
    ],
)
def test_process_card_image_in_markdown_skips(
    setup_test_env,
    mock_git_root,
    test_id,
    markdown_content,
    md_filename_suffix,
):
    """Test skipping conditions for process_card_image_in_markdown."""
    md_file_path = (
        mock_git_root
        / "static"
        / "images"
        / "posts"
        / f"test_{md_filename_suffix}"
    )
    md_file_path.write_text(markdown_content)

    with (
        mock.patch("requests.get") as mock_get,
        mock.patch("subprocess.run") as mock_subproc_run,
        mock.patch("shutil.move") as mock_shutil_move,
        mock.patch(
            "scripts.convert_markdown_yaml.r2_upload.upload_and_move"
        ) as mock_r2_upload,
    ):
        convert_markdown_yaml.process_card_image_in_markdown(md_file_path)
        mock_get.assert_not_called()
        mock_subproc_run.assert_not_called()
        mock_shutil_move.assert_not_called()
        mock_r2_upload.assert_not_called()
        assert md_file_path.read_text() == markdown_content


def test_parse_markdown_frontmatter():
    """
    Test parsing of markdown frontmatter.
    """
    content = """---
title: "Test Post"
date: "2023-10-10"
card_image: http://example.com/image.avif
---
Test content"""

    result = convert_markdown_yaml._parse_markdown_frontmatter(content)
    assert result is not None
    data, body = result
    assert data["title"] == "Test Post"
    assert data["card_image"] == "http://example.com/image.avif"
    assert body == "Test content"


def test_parse_markdown_frontmatter_no_frontmatter():
    """
    Test parsing markdown with no frontmatter.
    """
    content = "Just some content"
    result = convert_markdown_yaml._parse_markdown_frontmatter(content)
    assert result is None


def test_download_image(tmp_path):
    """
    Test image download functionality.
    """
    output_path = tmp_path / "test.avif"
    url = "http://example.com/image.avif"

    mock_response = mock.Mock()
    mock_response.status_code = 200
    mock_response.raw = io.BytesIO(b"fake image data")

    with mock.patch("requests.get", return_value=mock_response) as mock_get:
        convert_markdown_yaml._download_image(url, output_path)

        mock_get.assert_called_once()
        assert output_path.exists()
        assert output_path.read_bytes() == b"fake image data"


def test_download_image_failure(tmp_path):
    """
    Test image download failure handling.
    """
    output_path = tmp_path / "test.avif"
    url = "http://example.com/image.avif"

    mock_response = mock.Mock()
    mock_response.status_code = 404

    with (
        mock.patch("requests.get", return_value=mock_response),
        pytest.raises(ValueError, match="Failed to download image"),
    ):
        convert_markdown_yaml._download_image(url, output_path)


def test_convert_to_png(tmp_path):
    """
    Test PNG conversion.
    """
    input_path = tmp_path / "test.avif"
    output_path = tmp_path / "test.png"
    input_path.touch()

    with mock.patch("subprocess.run") as mock_run:
        convert_markdown_yaml._convert_to_png(input_path, output_path)

        mock_run.assert_called_once()
        args = mock_run.call_args[0][0]
        assert args[0] == "magick"
        assert args[1] == str(input_path)
        assert args[-1] == str(output_path)


def test_process_image(tmp_path):
    """Test the _process_image helper function."""
    url = "http://example.com/image.avif"

    with (
        mock.patch(
            "scripts.convert_markdown_yaml._download_image"
        ) as mock_download,
        mock.patch(
            "scripts.convert_markdown_yaml._convert_to_png"
        ) as mock_convert,
    ):
        png_path, png_filename = convert_markdown_yaml._process_image(
            url, tmp_path
        )

        # Verify function calls
        mock_download.assert_called_once()
        mock_convert.assert_called_once()

        # Verify returned paths
        assert png_filename == "image.png"
        assert png_path == tmp_path / "image.png"


def test_setup_and_store_image(mock_git_root):
    """Test the _setup_and_store_image helper function."""
    png_path = mock_git_root / "temp" / "image.png"
    png_filename = "image.png"

    with (
        mock.patch("shutil.move") as mock_move,
        mock.patch(
            "scripts.convert_markdown_yaml.r2_upload.upload_and_move"
        ) as mock_r2_upload,
    ):
        local_png_path = convert_markdown_yaml._setup_and_store_image(
            png_path, png_filename
        )

        # Verify function calls
        mock_move.assert_called_once()
        mock_r2_upload.assert_called_once()

        # Verify returned path
        expected_path = (
            mock_git_root
            / "quartz"
            / "static"
            / "images"
            / "card_images"
            / png_filename
        )
        assert local_png_path == expected_path


def test_process_card_image_in_markdown_success(setup_test_env, mock_git_root):
    """Test successful processing of card image in markdown."""
    markdown_content = """---
title: "Test Post"
date: "2023-10-10"
card_image: http://example.com/static/image.avif
tags:
  - test
---
Content with AVIF card_image.
"""
    md_file = mock_git_root / "static" / "images" / "posts" / "test.md"
    md_file.write_text(markdown_content)

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir_path = Path(temp_dir)
        new_card_image_url = (
            "http://r2.example.com/static/images/card_images/image.png"
        )

        with (
            mock.patch(
                "scripts.convert_markdown_yaml._process_image"
            ) as mock_process_image,
            mock.patch(
                "scripts.convert_markdown_yaml._setup_and_store_image"
            ) as mock_setup_store,
            mock.patch(
                "scripts.convert_markdown_yaml.r2_upload.R2_BASE_URL",
                "http://r2.example.com",
            ),
            mock.patch("tempfile.gettempdir", return_value=str(temp_dir_path)),
        ):
            # Mock return values
            mock_process_image.return_value = (
                temp_dir_path / "image.png",
                "image.png",
            )
            mock_setup_store.return_value = (
                mock_git_root
                / "quartz"
                / "static"
                / "images"
                / "card_images"
                / "image.png"
            )

            convert_markdown_yaml.process_card_image_in_markdown(md_file)

            # Verify function calls
            mock_process_image.assert_called_once()
            mock_setup_store.assert_called_once()

            # Verify markdown content was updated
            expected_content = f"""---
title: "Test Post"
date: "2023-10-10"
card_image: {new_card_image_url}
tags:
  - test
---
Content with AVIF card_image.
"""
            assert md_file.read_text() == expected_content


def test_process_card_image_in_markdown_process_failure(
    setup_test_env, mock_git_root
):
    """Test handling of image processing failures."""
    markdown_content = """---
title: "Test Post"
date: "2023-10-10"
card_image: http://example.com/static/image.avif
---
Content with AVIF card_image.
"""
    md_file = mock_git_root / "static" / "images" / "posts" / "test.md"
    md_file.write_text(markdown_content)

    with (
        mock.patch(
            "scripts.convert_markdown_yaml._process_image"
        ) as mock_process_image,
        mock.patch(
            "scripts.convert_markdown_yaml._setup_and_store_image"
        ) as mock_setup_store,
    ):
        mock_process_image.side_effect = ValueError("Failed to process image")

        with pytest.raises(ValueError, match="Failed to process image"):
            convert_markdown_yaml.process_card_image_in_markdown(md_file)

        mock_process_image.assert_called_once()
        mock_setup_store.assert_not_called()

        # Verify content remains unchanged
        assert md_file.read_text() == markdown_content


def test_main(mock_git_root):
    markdown_content = """---
title: "Test Post"
date: "2023-10-10"
card_image: http://example.com/static/image.avif
---
Content with AVIF card_image.
"""
    md_file = mock_git_root / "website_content" / "test.md"
    md_file.parent.mkdir(parents=True, exist_ok=True)
    md_file.write_text(markdown_content)

    with (
        mock.patch(
            "scripts.convert_markdown_yaml.process_card_image_in_markdown"
        ) as mock_process,
        mock.patch(
            "scripts.convert_markdown_yaml.script_utils.get_git_root",
            return_value=mock_git_root,
        ),
        mock.patch(
            "scripts.convert_markdown_yaml.script_utils.get_files",
            return_value=[md_file],
        ),
        mock.patch(
            "sys.argv",
            [
                "convert_markdown_yaml.py",
                "-d",
                str(mock_git_root / "website_content"),
            ],
        ),
    ):
        convert_markdown_yaml.main()

    mock_process.assert_called_once_with(md_file)
