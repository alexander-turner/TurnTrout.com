import io
import unittest.mock as mock
from pathlib import Path

import pytest

from .. import convert_markdown_yaml, source_file_checks
from .utils import create_markdown_file

try:
    # ruff: noqa: F401
    from .utils import setup_test_env  # type: ignore
except ImportError:
    pass


@pytest.fixture
def mock_git_root(quartz_project_structure):
    """Override conftest mock_git_root to add card_images directory."""
    git_root = quartz_project_structure["public"].parent
    (git_root / "quartz" / "static" / "images" / "card_images").mkdir(
        parents=True, exist_ok=True
    )
    (git_root / "static" / "images" / "posts").mkdir(
        parents=True, exist_ok=True
    )
    with mock.patch("scripts.utils.get_git_root", return_value=git_root):
        yield git_root


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
    md_file = mock_git_root / "website_content" / "test.md"
    create_markdown_file(md_file, content=markdown_content)

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
            "already_processed_jpeg",
            """---
title: Test Post
date: 2023-10-10
card_image: https://assets.turntrout.com/images/card_images/image.jpg
---
Content with already processed JPEG card_image.""",
            "processed_jpeg.md",
        ),
        (
            "small_png_under_300kb",
            """---
title: Test Post
date: 2023-10-10
card_image: https://assets.turntrout.com/images/card_images/small.png
---
Content with small PNG card_image under 300KB.""",
            "small_png.md",
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
        mock_git_root / "website_content" / f"test_{md_filename_suffix}"
    )
    md_file_path.parent.mkdir(exist_ok=True)
    md_file_path.write_text(markdown_content)

    # Mock HEAD request for PNG size check
    mock_head_response = mock.Mock()
    mock_head_response.status_code = 200
    mock_head_response.headers = {"Content-Length": str(200 * 1024)}  # 200KB

    with (
        mock.patch("requests.get") as mock_get,
        mock.patch("requests.head", return_value=mock_head_response),
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
    """Test parsing of markdown frontmatter."""
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
    """Test parsing markdown with no frontmatter."""
    content = "Just some content"
    result = convert_markdown_yaml._parse_markdown_frontmatter(content)
    assert result is None


def test_download_image(tmp_path):
    """Test image download functionality."""
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
    """Test image download failure handling."""
    output_path = tmp_path / "test.avif"
    url = "http://example.com/image.avif"

    mock_response = mock.Mock()
    mock_response.status_code = 404

    with (
        mock.patch("requests.get", return_value=mock_response),
        pytest.raises(ValueError, match="Failed to download image"),
    ):
        convert_markdown_yaml._download_image(url, output_path)


@pytest.fixture
def jpeg_conversion_setup(tmp_path):
    """Common setup for JPEG conversion tests."""
    input_path = tmp_path / "test.avif"
    output_path = tmp_path / "test.jpg"
    input_path.touch()
    return input_path, output_path


def test_convert_to_jpeg(jpeg_conversion_setup):
    """Test JPEG conversion with size constraints."""
    input_path, output_path = jpeg_conversion_setup

    with (
        mock.patch(
            "scripts.convert_markdown_yaml.script_utils.find_executable",
            return_value="magick",
        ),
        mock.patch("subprocess.run") as mock_run,
        mock.patch.object(Path, "stat") as mock_stat,
    ):
        # Mock file size to be under 300KB (200KB)
        mock_stat.return_value.st_size = 200 * 1024

        convert_markdown_yaml._convert_to_jpeg(input_path, output_path)

        # Should be called once since file is under size limit
        mock_run.assert_called_once()
        args = mock_run.call_args[0][0]
        assert args[0] == "magick"
        assert args[1] == str(input_path)
        assert "-strip" in args
        assert "-quality" in args
        assert "-sampling-factor" in args
        assert args[-1] == str(output_path)


def test_convert_to_jpeg_resizes_to_height_1200(jpeg_conversion_setup):
    """Test that JPEG conversion resizes images to height of 1200 pixels."""
    input_path, output_path = jpeg_conversion_setup

    with (
        mock.patch(
            "scripts.convert_markdown_yaml.script_utils.find_executable",
            return_value="magick",
        ),
        mock.patch("subprocess.run") as mock_run,
        mock.patch.object(Path, "stat") as mock_stat,
    ):
        # Mock file size to be under 300KB (200KB)
        mock_stat.return_value.st_size = 200 * 1024

        convert_markdown_yaml._convert_to_jpeg(input_path, output_path)

    # Verify the resize parameter is present and correct
    mock_run.assert_called_once()
    args = mock_run.call_args[0][0]

    assert "-resize" in args
    resize_idx = args.index("-resize")
    assert (
        args[resize_idx + 1] == "x1200"
    ), f"Expected resize parameter 'x1200', got '{args[resize_idx + 1]}'"


def test_convert_to_jpeg_iterative_compression(jpeg_conversion_setup):
    """Test JPEG conversion with iterative quality reduction."""
    input_path, output_path = jpeg_conversion_setup

    with (
        mock.patch(
            "scripts.convert_markdown_yaml.script_utils.find_executable",
            return_value="magick",
        ),
        mock.patch("subprocess.run") as mock_run,
        mock.patch.object(Path, "stat") as mock_stat,
    ):
        # Mock file sizes: first too large, second acceptable
        mock_stat.return_value.st_size = 400 * 1024  # First: 400KB (too large)

        # After first call, make it smaller
        def side_effect(*args, **kwargs):
            if mock_run.call_count == 1:
                mock_stat.return_value.st_size = 400 * 1024
            else:
                mock_stat.return_value.st_size = (
                    250 * 1024
                )  # 250KB (acceptable)

        mock_run.side_effect = side_effect

        convert_markdown_yaml._convert_to_jpeg(
            input_path, output_path, max_size_kb=300
        )

    # Should be called twice (quality 85, then 80)
    assert mock_run.call_count == 2

    # Check that quality was reduced
    first_call_args = mock_run.call_args_list[0][0][0]
    second_call_args = mock_run.call_args_list[1][0][0]

    first_quality_idx = first_call_args.index("-quality") + 1
    second_quality_idx = second_call_args.index("-quality") + 1

    assert int(first_call_args[first_quality_idx]) == 85
    assert int(second_call_args[second_quality_idx]) == 80


def test_convert_to_jpeg_warns_when_cannot_compress_below_limit(
    jpeg_conversion_setup, capsys
):
    """Test that _convert_to_jpeg warns when file cannot be compressed below limit."""
    input_path, output_path = jpeg_conversion_setup
    max_size_kb = source_file_checks.MAX_CARD_IMAGE_SIZE_KB
    # File size that exceeds the limit
    oversized_kb = max_size_kb + 1

    with (
        mock.patch(
            "scripts.convert_markdown_yaml.script_utils.find_executable",
            return_value="magick",
        ),
        mock.patch("subprocess.run"),
        mock.patch.object(Path, "stat") as mock_stat,
    ):
        # Mock file size to always be too large, even at minimum quality
        mock_stat.return_value.st_size = oversized_kb * 1024

        convert_markdown_yaml._convert_to_jpeg(
            input_path, output_path, max_size_kb=max_size_kb
        )

    # Verify warning message was printed
    captured = capsys.readouterr()
    assert f"Warning: Could not compress below {max_size_kb}KB" in captured.out
    assert f"Final size: {oversized_kb}.0KB at quality 60" in captured.out


def test_process_image(tmp_path):
    """Test the _process_image helper function."""
    url = "http://example.com/image.avif"

    with (
        mock.patch(
            "scripts.convert_markdown_yaml._download_image"
        ) as mock_download,
        mock.patch(
            "scripts.convert_markdown_yaml._convert_to_jpeg"
        ) as mock_convert,
    ):
        jpeg_path, jpeg_filename = convert_markdown_yaml._process_image(
            url, tmp_path
        )

    mock_download.assert_called_once()
    mock_convert.assert_called_once()

    assert jpeg_filename == "image.jpg"
    assert jpeg_path == tmp_path / "image.jpg"


def test_setup_and_store_image(mock_git_root):
    """Test the _setup_and_store_image helper function."""
    jpeg_path = mock_git_root / "temp" / "image.jpg"
    jpeg_filename = "image.jpg"

    with (
        mock.patch("shutil.move") as mock_move,
        mock.patch(
            "scripts.convert_markdown_yaml.r2_upload.upload_and_move"
        ) as mock_r2_upload,
    ):
        local_jpeg_path = convert_markdown_yaml._setup_and_store_image(
            jpeg_path, jpeg_filename
        )

    mock_move.assert_called_once()
    mock_r2_upload.assert_called_once()

    expected_path = (
        mock_git_root
        / "quartz"
        / "static"
        / "images"
        / "card_images"
        / jpeg_filename
    )
    assert local_jpeg_path == expected_path


def _test_card_image_processing_helper(
    mock_git_root: Path,
    temp_dir: Path,
    markdown_content: str,
    expected_body: str,
    extra_frontmatter: str = "",
) -> None:
    """Helper function to test card image processing with common setup."""
    md_file = mock_git_root / "website_content" / "test.md"
    create_markdown_file(md_file, content=markdown_content)

    new_card_image_url = (
        "http://r2.example.com/static/images/card_images/image.jpg"
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
        mock.patch("tempfile.gettempdir", return_value=str(temp_dir)),
    ):
        mock_process_image.return_value = (
            temp_dir / "image.jpg",
            "image.jpg",
        )
        mock_setup_store.return_value = (
            mock_git_root
            / "quartz"
            / "static"
            / "images"
            / "card_images"
            / "image.jpg"
        )

        convert_markdown_yaml.process_card_image_in_markdown(md_file)

    mock_process_image.assert_called_once()
    mock_setup_store.assert_called_once()

    expected_content = f"""---
title: "Test Post"
date: "2023-10-10"
card_image: {new_card_image_url}{extra_frontmatter}
---
{expected_body}
"""
    assert md_file.read_text() == expected_content


@pytest.mark.parametrize(
    "card_image_url,body_content,extra_frontmatter",
    [
        (
            "http://example.com/static/image.avif",
            "Content with AVIF card_image.",
            "\ntags:\n  - test",
        ),
        (
            "https://assets.turntrout.com/static/images/card_images/image.png",
            "Content with PNG card_image on assets.turntrout.com.",
            "",
        ),
    ],
)
def test_process_card_image_conversion(
    setup_test_env,
    mock_git_root,
    temp_dir,
    card_image_url,
    body_content,
    extra_frontmatter,
):
    """Test card image conversion for various sources."""
    markdown_content = f"""---
title: "Test Post"
date: "2023-10-10"
card_image: {card_image_url}{extra_frontmatter}
---
{body_content}
"""
    _test_card_image_processing_helper(
        mock_git_root,
        temp_dir,
        markdown_content,
        body_content,
        extra_frontmatter=extra_frontmatter,
    )


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
    md_file = mock_git_root / "website_content" / "test.md"
    create_markdown_file(md_file, content=markdown_content)

    with (
        mock.patch(
            "scripts.convert_markdown_yaml._process_image"
        ) as mock_process_image,
        mock.patch(
            "scripts.convert_markdown_yaml._setup_and_store_image"
        ) as mock_setup_store,
        pytest.raises(ValueError, match="Failed to process image"),
    ):
        mock_process_image.side_effect = ValueError("Failed to process image")
        convert_markdown_yaml.process_card_image_in_markdown(md_file)

    mock_process_image.assert_called_once()
    mock_setup_store.assert_not_called()

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
    create_markdown_file(md_file, content=markdown_content)

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


def test_process_card_image_in_markdown_wrong_directory(mock_git_root):
    """Test ValueError for markdown file outside website_content."""
    other_dir = mock_git_root / "other_dir"
    other_dir.mkdir()
    md_file = other_dir / "test.md"
    create_markdown_file(
        md_file, frontmatter={"title": "Test"}, content="Content"
    )

    with pytest.raises(
        ValueError,
        match=f"File path {md_file} is not in the website_content directory.",
    ):
        convert_markdown_yaml.process_card_image_in_markdown(md_file)
