import unittest.mock as mock
import tempfile
import pytest
from pathlib import Path
import io
import tempfile
import subprocess
from .. import convert_markdown_yaml

try:
    from . import utils as test_utils
    from .utils import setup_test_env
except ImportError:
    import utils as test_utils  # type: ignore
    from test_utils import setup_test_env  # type: ignore


@pytest.fixture
def mock_git_root(tmp_path):
    git_root = tmp_path / "git"
    git_root.mkdir()
    (git_root / "quartz" / "static" / "images" / "card_images").mkdir(parents=True)
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

    with mock.patch("requests.get") as mock_get, mock.patch(
        "subprocess.run"
    ) as mock_subproc_run, mock.patch("shutil.move") as mock_shutil_move, mock.patch(
        "scripts.convert_markdown_yaml.r2_upload.upload_and_move"
    ) as mock_r2_upload:

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


def test_process_card_image_in_markdown_success(setup_test_env, mock_git_root):
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
        downloaded_avif_path = temp_dir_path / "image.avif"
        converted_png_path = temp_dir_path / "image.png"
        new_card_image_url = "http://r2.example.com/static/images/card_images/image.png"
        converted_png_path.touch()

        with mock.patch("requests.get") as mock_get, mock.patch(
            "subprocess.run"
        ) as mock_subproc_run, mock.patch(
            "shutil.move"
        ) as mock_shutil_move, mock.patch(
            "scripts.convert_markdown_yaml.r2_upload.upload_and_move"
        ) as mock_r2_upload, mock.patch(
            "scripts.convert_markdown_yaml.r2_upload.R2_BASE_URL",
            "http://r2.example.com",
        ), mock.patch(
            "scripts.convert_markdown_yaml.r2_upload.R2_MEDIA_DIR",
            "turntrout/static/images/card_images",
        ), mock.patch(
            "tempfile.gettempdir", return_value=str(temp_dir_path)
        ):

            # Mock the image download response
            mock_response = mock.Mock()
            mock_response.status_code = 200
            mock_response.raw = io.BytesIO(b"fake image data")
            mock_get.return_value = mock_response

            # Mock subprocess.run for ImageMagick conversion
            mock_subproc_run.return_value = subprocess.CompletedProcess(
                args=[], returncode=0
            )

            # Mock shutil.move to simulate moving the file
            mock_shutil_move.return_value = None

            # Mock R2 upload to simulate successful upload
            mock_r2_upload.return_value = None

            convert_markdown_yaml.process_card_image_in_markdown(md_file)

            # Verify that the functions were called without checking arguments
            mock_get.assert_called()
            mock_subproc_run.assert_called()
            mock_shutil_move.assert_called()
            mock_r2_upload.assert_called()

            # Verify that the markdown file was updated correctly
            expected_updated_content = f"""---
title: "Test Post"
date: "2023-10-10"
card_image: {new_card_image_url}
tags:
  - test
---
Content with AVIF card_image.
"""
            assert md_file.read_text() == expected_updated_content


def test_process_card_image_in_markdown_download_failure(setup_test_env, mock_git_root):
    markdown_content = """---
title: "Test Post"
date: "2023-10-10"
card_image: http://example.com/static/image.avif
---
Content with AVIF card_image.
"""

    md_file = mock_git_root / "static" / "images" / "posts" / "test.md"
    md_file.write_text(markdown_content)

    with mock.patch("requests.get") as mock_get, mock.patch(
        "subprocess.run"
    ) as mock_subproc_run, mock.patch("shutil.move") as mock_shutil_move, mock.patch(
        "scripts.convert_markdown_yaml.r2_upload.upload_and_move"
    ) as mock_r2_upload:

        # Mock the image download response to fail
        mock_get.return_value.status_code = 404

        with pytest.raises(ValueError, match="Failed to download image"):
            convert_markdown_yaml.process_card_image_in_markdown(md_file)

        # Verify that the image was attempted to be downloaded
        mock_get.assert_called()

        # Ensure that no subprocess was run
        mock_subproc_run.assert_not_called()
        # Ensure that no file was moved
        mock_shutil_move.assert_not_called()
        # Ensure that R2 upload was not called
        mock_r2_upload.assert_not_called()

        # Markdown file should remain unchanged
        assert md_file.read_text() == markdown_content


def test_process_card_image_in_markdown_conversion_failure(
    setup_test_env, mock_git_root
):
    markdown_content = """---
title: "Test Post"
date: "2023-10-10"
card_image: http://example.com/static/image.avif
---
Content with AVIF card_image.
"""

    md_file = mock_git_root / "static" / "images" / "posts" / "test.md"
    md_file.write_text(markdown_content)

    downloaded_avif_path = mock_git_root / "static" / "images" / "posts" / "image.avif"
    converted_png_path = (
        mock_git_root / "quartz" / "static" / "images" / "card_images" / "image.png"
    )

    # Create the AVIF file (this will be the file that fails to convert)
    downloaded_avif_path.parent.mkdir(parents=True, exist_ok=True)
    downloaded_avif_path.touch()

    with mock.patch("requests.get") as mock_get, mock.patch(
        "subprocess.run"
    ) as mock_subproc_run, mock.patch("shutil.move") as mock_shutil_move, mock.patch(
        "scripts.convert_markdown_yaml.r2_upload.upload_and_move"
    ) as mock_r2_upload:

        # Mock the image download response
        mock_response = mock.Mock()
        mock_response.status_code = 200
        mock_response.raw = io.BytesIO(b"fake image data")
        mock_get.return_value = mock_response

        # Mock subprocess.run to raise an error during ImageMagick conversion
        mock_subproc_run.side_effect = subprocess.CalledProcessError(
            returncode=1, cmd=["magick"], stderr="ImageMagick conversion error."
        )

        with pytest.raises(subprocess.CalledProcessError, match="magick"):
            convert_markdown_yaml.process_card_image_in_markdown(md_file)

        # Verify that the image was downloaded
        mock_get.assert_called()

        # Verify that ImageMagick was called
        mock_subproc_run.assert_called()

        # Ensure that R2 upload was not called
        mock_r2_upload.assert_not_called()

        # Ensure that the PNG file was not created due to conversion failure
        assert not converted_png_path.exists()

        # Markdown file should remain unchanged
        assert md_file.read_text() == markdown_content


def test_main(mock_git_root):
    markdown_content = """---
title: "Test Post"
date: "2023-10-10"
card_image: http://example.com/static/image.avif
---
Content with AVIF card_image.
"""
    md_file = mock_git_root / "content" / "test.md"
    md_file.parent.mkdir(parents=True, exist_ok=True)
    md_file.write_text(markdown_content)

    with mock.patch(
        "scripts.convert_markdown_yaml.process_card_image_in_markdown"
    ) as mock_process, mock.patch(
        "scripts.convert_markdown_yaml.script_utils.get_git_root",
        return_value=mock_git_root,
    ), mock.patch(
        "scripts.convert_markdown_yaml.script_utils.get_files", return_value=[md_file]
    ):
        with mock.patch(
            "sys.argv",
            ["convert_markdown_yaml.py", "-d", str(mock_git_root / "content")],
        ):
            convert_markdown_yaml.main()

    mock_process.assert_called_once_with(md_file)
