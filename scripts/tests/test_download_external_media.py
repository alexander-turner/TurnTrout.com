"""Tests for download_external_media.py."""

import io
from unittest import mock

import pytest

from scripts import download_external_media


@pytest.fixture
def mock_git_root(tmp_path, monkeypatch) -> None:
    """Create a mock git root directory structure."""
    website_content = tmp_path / "website_content"
    website_content.mkdir()
    asset_staging = website_content / "asset_staging"
    asset_staging.mkdir()

    monkeypatch.setattr(
        "scripts.download_external_media.script_utils.get_git_root",
        lambda *_args, **_kwargs: tmp_path,
    )
    return tmp_path


def test_find_external_media_urls_excludes_cdn(mock_git_root):
    """Test that CDN URLs are excluded from external media URLs."""
    md_file = mock_git_root / "website_content" / "test.md"
    md_file.write_text("""
# Test Post

![External image](https://example.com/image.png)
![CDN image](https://assets.turntrout.com/static/images/posts/image.avif)
<video src="https://example.com/video.mp4"></video>
<img src="https://assets.turntrout.com/icon.svg" />
""")

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
    md_file.write_text("""
![Image1](https://example.com/image.png)
![Image2](https://example.com/image.png)
""")

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
    md_file.write_text("""
![Image1](https://example.com/image.PNG)
![Image2](https://example.com/image.JpG)
![Image3](https://example.com/video.MP4)
""")

    urls = download_external_media.find_external_media_urls([md_file])

    assert len(urls) == 3
    assert "https://example.com/image.PNG" in urls
    assert "https://example.com/image.JpG" in urls
    assert "https://example.com/video.MP4" in urls


def _mock_response(payload: bytes = b"") -> mock.MagicMock:
    """Build a MagicMock that mimics a streaming requests Response."""
    response = mock.MagicMock()
    response.raw = io.BytesIO(payload)
    response.__enter__.return_value = response
    response.raise_for_status = mock.MagicMock()
    return response


def test_download_media_skips_url_with_no_filename(
    mock_git_root, tmp_path, capsys
):
    """URLs whose path has no filename component are skipped without raising."""
    target_dir = tmp_path / "downloads"
    target_dir.mkdir()

    result = download_external_media.download_media(
        "https://example.com/", target_dir
    )

    assert result is False
    captured = capsys.readouterr()
    assert "Skipping URL with no filename" in captured.err


def test_download_media_success(mock_git_root, tmp_path):
    """Test successful media download."""
    target_dir = tmp_path / "downloads"
    target_dir.mkdir()

    response = _mock_response(b"image-bytes")
    with mock.patch.object(
        download_external_media._http_session, "get", return_value=response
    ) as mock_get:
        result = download_external_media.download_media(
            "https://example.com/image.png", target_dir
        )

        assert result is True
        mock_get.assert_called_once()
        url = mock_get.call_args[0][0]
        assert url == "https://example.com/image.png"
        assert (target_dir / "image.png").read_bytes() == b"image-bytes"
        # Decoding is opted into so gzip/deflate responses land decompressed.
        assert response.raw.decode_content is True


def test_download_media_respects_target_filename_override(
    mock_git_root, tmp_path
):
    """The caller can override the on-disk filename (used for collision-
    safety)."""
    target_dir = tmp_path / "downloads"
    target_dir.mkdir()

    response = _mock_response(b"image-bytes")
    with mock.patch.object(
        download_external_media._http_session, "get", return_value=response
    ):
        result = download_external_media.download_media(
            "https://example.com/image.png",
            target_dir,
            target_filename="ab12cd34-image.png",
        )

    assert result is True
    assert (target_dir / "ab12cd34-image.png").read_bytes() == b"image-bytes"
    assert not (target_dir / "image.png").exists()


def test_download_media_failure(mock_git_root, tmp_path):
    """Test failed media download."""
    target_dir = tmp_path / "downloads"
    target_dir.mkdir()

    with mock.patch.object(
        download_external_media._http_session,
        "get",
        side_effect=download_external_media.requests.RequestException(
            "Error message"
        ),
    ):
        result = download_external_media.download_media(
            "https://example.com/image.png", target_dir
        )

        assert result is False


def test_replace_urls_in_file(mock_git_root):
    """Test URL replacement in markdown file with a single-URL map."""
    md_file = mock_git_root / "website_content" / "test.md"
    original_content = "![Image](https://example.com/image.png)"
    md_file.write_text(original_content)

    download_external_media.replace_urls_in_file(
        md_file,
        {"https://example.com/image.png": "asset_staging/image.png"},
    )

    updated_content = md_file.read_text()
    assert "asset_staging/image.png" in updated_content
    assert "https://example.com/image.png" not in updated_content


def test_replace_urls_in_file_applies_multiple_replacements_in_one_pass(
    mock_git_root,
):
    """Every mapping is applied to a single-file read/write pair."""
    md_file = mock_git_root / "website_content" / "test.md"
    md_file.write_text(
        "![A](https://a.example.com/one.png)\n"
        "![B](https://b.example.com/two.jpg)\n"
    )

    with mock.patch(
        "scripts.download_external_media.script_utils.update_markdown_file",
        wraps=download_external_media.script_utils.update_markdown_file,
    ) as spy:
        download_external_media.replace_urls_in_file(
            md_file,
            {
                "https://a.example.com/one.png": "asset_staging/one.png",
                "https://b.example.com/two.jpg": "asset_staging/two.jpg",
            },
        )

    assert spy.call_count == 1
    updated = md_file.read_text()
    assert "asset_staging/one.png" in updated
    assert "asset_staging/two.jpg" in updated


def test_replace_urls_in_file_prefix_url_not_corrupted(mock_git_root):
    """A URL that is a strict prefix of another must not corrupt the longer
    one: longest-first ordering rewrites the longer URL before the shorter."""
    short_url = "https://example.com/image.png"
    long_url = "https://example.com/image.png/thumb.jpg"
    md_file = mock_git_root / "website_content" / "test.md"
    md_file.write_text(f"![Short]({short_url})\n![Long]({long_url})\n")

    download_external_media.replace_urls_in_file(
        md_file,
        {
            short_url: "asset_staging/image.png",
            long_url: "asset_staging/thumb.jpg",
        },
    )

    updated = md_file.read_text()
    assert "asset_staging/image.png" in updated
    assert "asset_staging/thumb.jpg" in updated
    # The longer URL must not have been mangled into the shorter's target.
    assert "asset_staging/image.png/thumb.jpg" not in updated
    assert short_url not in updated
    assert long_url not in updated


def test_replace_urls_in_file_outside_content_dir(mock_git_root, tmp_path):
    """Test that replacing URLs in file outside content dir raises error."""
    outside_file = tmp_path / "outside.md"
    outside_file.write_text("![Image](https://example.com/image.png)")

    with pytest.raises(
        ValueError, match="not in the website_content directory"
    ):
        download_external_media.replace_urls_in_file(
            outside_file,
            {"https://example.com/image.png": "asset_staging/image.png"},
        )


def test_disambiguate_filename_passes_through_when_free():
    """A basename with no collision is returned unchanged."""
    assert (
        download_external_media.disambiguate_filename(
            "https://example.com/image.png", "image.png", set()
        )
        == "image.png"
    )


def test_disambiguate_filename_prefixes_on_collision():
    """A colliding basename gets a URL-derived prefix so downloads stay
    distinct."""
    taken = {"image.png"}
    disambiguated = download_external_media.disambiguate_filename(
        "https://example.com/other/image.png", "image.png", taken
    )
    assert disambiguated != "image.png"
    assert disambiguated.endswith("-image.png")
    # The prefix is deterministic (URL-derived), so distinct URLs get distinct
    # disambiguations even when the original basenames match.
    other = download_external_media.disambiguate_filename(
        "https://elsewhere.example.com/image.png", "image.png", taken
    )
    assert other != disambiguated


def test_disambiguate_filename_widens_prefix_on_prefix_collision(monkeypatch):
    """If the 8-hex prefix is already taken, the prefix widens so the returned
    name is always free."""
    base = "image.png"
    digest = "0" * 64

    class _FakeHash:
        def hexdigest(self) -> str:
            return digest

    monkeypatch.setattr(
        download_external_media.hashlib,
        "sha256",
        lambda _data: _FakeHash(),
    )

    taken = {base, f"{digest[:8]}-{base}"}
    result = download_external_media.disambiguate_filename(
        "https://example.com/image.png", base, taken
    )
    assert result not in taken
    assert result.endswith(f"-{base}")
    assert len(result.split("-", 1)[0]) == 9


def test_disambiguate_filename_raises_when_every_width_taken(monkeypatch):
    """When every digest prefix width is already taken, fail loudly rather than
    return a name that would clobber an existing download."""
    base = "image.png"
    digest = "0" * 64

    class _FakeHash:
        def hexdigest(self) -> str:
            return digest

    monkeypatch.setattr(
        download_external_media.hashlib,
        "sha256",
        lambda _data: _FakeHash(),
    )

    taken = {base} | {
        f"{digest[:width]}-{base}" for width in range(8, len(digest) + 1)
    }
    with pytest.raises(RuntimeError, match="Could not disambiguate filename"):
        download_external_media.disambiguate_filename(
            "https://example.com/image.png", base, taken
        )


def test_main_no_markdown_files(mock_git_root):
    """Test main function with no markdown files."""
    with (
        mock.patch("subprocess.run"),
        pytest.raises(ValueError, match="No markdown files found"),
    ):
        download_external_media.main()


def test_main_no_external_urls(mock_git_root, capsys):
    """Test main function with no external URLs."""
    md_file = mock_git_root / "website_content" / "test.md"
    md_file.write_text("# Just text, no external media")

    with mock.patch("subprocess.run") as mock_run:
        download_external_media.main()

        captured = capsys.readouterr()
        assert "No external media URLs found" in captured.out

        # Verify Obsidian was killed (but not restarted since no downloads)
        calls = mock_run.call_args_list
        assert any("pkill" in str(call) for call in calls)


def test_main_downloads_and_updates(mock_git_root, capsys):
    """Test main function downloads files and updates references."""
    md_file = mock_git_root / "website_content" / "test.md"
    md_file.write_text("![Image](https://example.com/image.png)")

    response = _mock_response(b"image-bytes")
    with (
        mock.patch("subprocess.run") as mock_run,
        mock.patch.object(
            download_external_media._http_session,
            "get",
            return_value=response,
        ) as mock_get,
    ):
        mock_run.return_value = mock.Mock(returncode=0)

        download_external_media.main()

        # pkill and open were invoked via subprocess.run
        assert mock_run.call_count >= 2

        # Download was attempted via the http session
        mock_get.assert_called_once()
        assert mock_get.call_args[0][0] == "https://example.com/image.png"

        # Check that URL was updated in markdown
        updated_content = md_file.read_text()
        assert "asset_staging/image.png" in updated_content
        assert "https://example.com/image.png" not in updated_content

        captured = capsys.readouterr()
        assert "Found 1 external media URLs" in captured.out
        assert "Successfully downloaded 1/1 files" in captured.out


def test_main_skips_urls_without_filenames(mock_git_root, capsys, monkeypatch):
    """A URL whose filename extraction raises is skipped without aborting
    main."""
    md_file = mock_git_root / "website_content" / "test.md"
    md_file.write_text("![Image](https://example.com/image.png)")

    def raise_value_error(_url: str) -> str:
        raise ValueError("no filename component")

    monkeypatch.setattr(
        download_external_media.script_utils,
        "extract_filename_from_url",
        raise_value_error,
    )
    with mock.patch("subprocess.run"):
        download_external_media.main()

    captured = capsys.readouterr()
    assert "Skipping URL with no filename" in captured.err
    assert "Successfully downloaded 0/1 files" in captured.out


def test_main_disambiguates_filename_collisions(mock_git_root, capsys):
    """Two URLs with the same basename must land as distinct staged files."""
    md_file = mock_git_root / "website_content" / "test.md"
    md_file.write_text(
        "![One](https://a.example.com/image.png)\n"
        "![Two](https://b.example.com/image.png)\n"
    )

    response = _mock_response(b"image-bytes")
    with (
        mock.patch("subprocess.run"),
        mock.patch.object(
            download_external_media._http_session,
            "get",
            return_value=response,
        ),
    ):
        download_external_media.main()

    asset_staging = mock_git_root / "website_content" / "asset_staging"
    staged_files = sorted(asset_staging.iterdir())
    # Two distinct files must exist on disk.
    assert len(staged_files) == 2
    updated = md_file.read_text()
    # Both markdown references must point at their own staged file, and
    # neither original URL may survive.
    assert "https://a.example.com/image.png" not in updated
    assert "https://b.example.com/image.png" not in updated
    for staged in staged_files:
        assert f"asset_staging/{staged.name}" in updated


def test_main_rewrites_each_markdown_file_once(mock_git_root):
    """Many URLs across many files rewrite each file at most once."""
    for name in ("a.md", "b.md", "c.md"):
        (mock_git_root / "website_content" / name).write_text(
            "![X](https://x.example.com/x.png)\n"
            "![Y](https://y.example.com/y.jpg)\n"
        )

    response = _mock_response(b"image-bytes")
    with (
        mock.patch("subprocess.run"),
        mock.patch.object(
            download_external_media._http_session,
            "get",
            return_value=response,
        ),
        mock.patch(
            "scripts.download_external_media.script_utils.update_markdown_file",
            wraps=download_external_media.script_utils.update_markdown_file,
        ) as spy,
    ):
        download_external_media.main()

    # 3 markdown files x 1 pass each = 3 total calls, not 3 x 2 URLs = 6.
    assert spy.call_count == 3


def test_main_handles_download_failures(mock_git_root, capsys):
    """Test main function handles download failures gracefully."""
    md_file = mock_git_root / "website_content" / "test.md"
    md_file.write_text("![Image](https://example.com/image.png)")

    with (
        mock.patch("subprocess.run") as mock_run,
        mock.patch.object(
            download_external_media._http_session,
            "get",
            side_effect=download_external_media.requests.RequestException(
                "Error"
            ),
        ),
    ):
        mock_run.return_value = mock.Mock(returncode=0)

        download_external_media.main()

        # URL should not be updated if download failed
        content = md_file.read_text()
        assert "https://example.com/image.png" in content
        assert "asset_staging/image.png" not in content

        # Check output
        captured = capsys.readouterr()
        assert "Successfully downloaded 0/1 files" in captured.out
