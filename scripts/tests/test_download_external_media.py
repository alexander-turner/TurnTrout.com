"""Tests for download_external_media.py"""

import subprocess
from unittest import mock

import pytest

from scripts import download_external_media


@pytest.fixture
def mock_git_root(tmp_path):
    """Create a mock git root directory structure."""
    website_content = tmp_path / "website_content"
    website_content.mkdir()
    asset_staging = website_content / "asset_staging"
    asset_staging.mkdir()

    with mock.patch(
        "scripts.download_external_media.script_utils.get_git_root",
        return_value=tmp_path,
    ):
        yield tmp_path


def test_find_external_media_urls_excludes_cdn(mock_git_root):
    """Test that CDN URLs are excluded from external media URLs."""
    md_file = mock_git_root / "website_content" / "test.md"
    md_file.write_text(
        """
# Test Post

![External image](https://example.com/image.png)
![CDN image](https://assets.turntrout.com/static/images/posts/image.avif)
<video src="https://example.com/video.mp4"></video>
<img src="https://assets.turntrout.com/icon.svg" />
"""
    )

    urls = download_external_media.find_external_media_urls([md_file])

    assert "https://example.com/image.png" in urls
    assert "https://example.com/video.mp4" in urls
    assert (
        "https://assets.turntrout.com/static/images/posts/image.avif"
        not in urls
    )
    assert "https://assets.turntrout.com/icon.svg" not in urls


def test_find_external_media_urls_multiple_files(mock_git_root):
    """Test finding URLs across multiple markdown files."""
    md_file1 = mock_git_root / "website_content" / "test1.md"
    md_file1.write_text("![Image](https://example.com/image1.png)")

    md_file2 = mock_git_root / "website_content" / "test2.md"
    md_file2.write_text("![Image](https://example.com/image2.jpg)")

    urls = download_external_media.find_external_media_urls(
        [md_file1, md_file2]
    )

    assert len(urls) == 2
    assert "https://example.com/image1.png" in urls
    assert "https://example.com/image2.jpg" in urls


def test_find_external_media_urls_deduplicates(mock_git_root):
    """Test that duplicate URLs are deduplicated."""
    md_file = mock_git_root / "website_content" / "test.md"
    md_file.write_text(
        """
![Image1](https://example.com/image.png)
![Image2](https://example.com/image.png)
"""
    )

    urls = download_external_media.find_external_media_urls([md_file])

    assert len(urls) == 1
    assert "https://example.com/image.png" in urls


@pytest.mark.parametrize("extension", download_external_media.MEDIA_EXTENSIONS)
def test_find_external_media_url_by_extension(mock_git_root, extension):
    """Test that each supported media extension is detected individually."""
    md_file = mock_git_root / "website_content" / "test.md"

    # Create markdown content with URL for this extension
    md_file.write_text(f"![Media](https://example.com/file.{extension})")

    urls = download_external_media.find_external_media_urls([md_file])

    expected_url = f"https://example.com/file.{extension}"
    assert expected_url in urls, f"Extension {extension} not found in URLs"
    assert len(urls) == 1


def test_find_external_media_urls_case_insensitive(mock_git_root):
    """Test that extension matching is case-insensitive."""
    md_file = mock_git_root / "website_content" / "test.md"
    md_file.write_text(
        """
![Image1](https://example.com/image.PNG)
![Image2](https://example.com/image.JpG)
![Image3](https://example.com/video.MP4)
"""
    )

    urls = download_external_media.find_external_media_urls([md_file])

    assert len(urls) == 3
    assert "https://example.com/image.PNG" in urls
    assert "https://example.com/image.JpG" in urls
    assert "https://example.com/video.MP4" in urls


def test_download_media_success(mock_git_root, tmp_path):
    """Test successful media download."""
    target_dir = tmp_path / "downloads"
    target_dir.mkdir()

    with mock.patch("subprocess.run") as mock_run:
        mock_run.return_value = mock.Mock(returncode=0)

        result = download_external_media.download_media(
            "https://example.com/image.png", target_dir
        )

        assert result is True
        mock_run.assert_called_once()
        call_args = mock_run.call_args[0][0]
        assert "curl" in call_args
        assert "https://example.com/image.png" in call_args


def test_download_media_failure(mock_git_root, tmp_path):
    """Test failed media download."""
    target_dir = tmp_path / "downloads"
    target_dir.mkdir()

    with mock.patch("subprocess.run") as mock_run:
        mock_run.side_effect = subprocess.CalledProcessError(
            1, "curl", stderr=b"Error message"
        )

        result = download_external_media.download_media(
            "https://example.com/image.png", target_dir
        )

        assert result is False


def test_replace_url_in_file(mock_git_root):
    """Test URL replacement in markdown file."""
    md_file = mock_git_root / "website_content" / "test.md"
    original_content = "![Image](https://example.com/image.png)"
    md_file.write_text(original_content)

    download_external_media.replace_url_in_file(
        md_file, "https://example.com/image.png", "asset_staging/image.png"
    )

    updated_content = md_file.read_text()
    assert "asset_staging/image.png" in updated_content
    assert "https://example.com/image.png" not in updated_content


def test_replace_url_in_file_outside_content_dir(mock_git_root, tmp_path):
    """Test that replacing URL in file outside content dir raises error."""
    outside_file = tmp_path / "outside.md"
    outside_file.write_text("![Image](https://example.com/image.png)")

    with pytest.raises(
        ValueError, match="not in the website_content directory"
    ):
        download_external_media.replace_url_in_file(
            outside_file,
            "https://example.com/image.png",
            "asset_staging/image.png",
        )


def test_main_no_markdown_files(mock_git_root, capsys):
    """Test main function with no markdown files."""
    download_external_media.main(mock_git_root / "website_content")

    captured = capsys.readouterr()
    assert "No markdown files found" in captured.out


def test_main_no_external_urls(mock_git_root, capsys):
    """Test main function with no external URLs."""
    md_file = mock_git_root / "website_content" / "test.md"
    md_file.write_text("# Just text, no external media")

    download_external_media.main(mock_git_root / "website_content")

    captured = capsys.readouterr()
    assert "No external media URLs found" in captured.out


def test_main_downloads_and_updates(mock_git_root, capsys):
    """Test main function downloads files and updates references."""
    md_file = mock_git_root / "website_content" / "test.md"
    md_file.write_text("![Image](https://example.com/image.png)")

    with mock.patch("subprocess.run") as mock_run:
        mock_run.return_value = mock.Mock(returncode=0)

        download_external_media.main(mock_git_root / "website_content")

        # Check that download was attempted
        mock_run.assert_called_once()

        # Check that URL was updated in markdown
        updated_content = md_file.read_text()
        assert "asset_staging/image.png" in updated_content
        assert "https://example.com/image.png" not in updated_content

        # Check output
        captured = capsys.readouterr()
        assert "Found 1 external media URLs" in captured.out
        assert "Successfully downloaded 1/1 files" in captured.out


def test_main_handles_download_failures(mock_git_root, capsys):
    """Test main function handles download failures gracefully."""
    md_file = mock_git_root / "website_content" / "test.md"
    md_file.write_text("![Image](https://example.com/image.png)")

    with mock.patch("subprocess.run") as mock_run:
        mock_run.side_effect = subprocess.CalledProcessError(
            1, "curl", stderr=b"Error"
        )

        download_external_media.main(mock_git_root / "website_content")

        # URL should not be updated if download failed
        content = md_file.read_text()
        assert "https://example.com/image.png" in content
        assert "asset_staging/image.png" not in content

        # Check output
        captured = capsys.readouterr()
        assert "Successfully downloaded 0/1 files" in captured.out
