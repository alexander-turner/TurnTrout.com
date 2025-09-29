"""Tests for alt_text_utils.py module."""

import json
import shutil
import subprocess
import sys
from pathlib import Path
from unittest import mock
from unittest.mock import Mock, patch

import git
import pytest
import requests

sys.path.append(str(Path(__file__).parent.parent))

from .. import alt_text_utils, scan_for_empty_alt
from . import utils as test_utils

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def base_queue_item(temp_dir: Path) -> scan_for_empty_alt.QueueItem:
    """Provides a base QueueItem for testing."""
    return scan_for_empty_alt.QueueItem(
        markdown_file=str(temp_dir / "test.md"),
        asset_path="image.jpg",
        line_number=5,
        context_snippet="This is a test image context.",
    )


@pytest.mark.parametrize(
    "markdown_file, context_snippet, max_chars, expected_in_prompt",
    [
        ("empty.md", "", 100, ["empty.md", "Under 100 characters"]),
        ("test.md", "", 10, ["test.md", "Under 10 characters"]),
        ("large.md", "", 10000, ["large.md", "Under 10000 characters"]),
        (
            "context.md",
            "Some context",
            250,
            ["context.md", "Some context", "Under 250 characters"],
        ),
        (
            "special.md",
            "Context with special chars: <>&\"'",
            150,
            ["special.md", "special chars", "Under 150 characters"],
        ),
    ],
)
def test_build_prompt_edge_cases(
    base_queue_item: scan_for_empty_alt.QueueItem,
    markdown_file: str,
    context_snippet: str,
    max_chars: int,
    expected_in_prompt: list[str],
) -> None:
    base_queue_item.markdown_file = markdown_file
    base_queue_item.context_snippet = context_snippet

    # Mock generate_article_context to return the context_snippet
    with patch.object(
        alt_text_utils,
        "generate_article_context",
        return_value=context_snippet,
    ):
        prompt = alt_text_utils.build_prompt(base_queue_item, max_chars)

    for expected in expected_in_prompt:
        assert expected in prompt


class TestGenerateArticleContext:
    """Test suite for generate_article_context function."""

    @pytest.fixture
    def sample_markdown(self, temp_dir: Path) -> Path:
        """Create a sample markdown file with multiple paragraphs."""
        content = """Para 1: First paragraph

Para 2: Second paragraph

Para 3: Third paragraph

Para 4: Fourth paragraph

Para 5: Fifth paragraph

Para 6: Sixth paragraph with image

Para 7: Seventh paragraph after image

Para 8: Eighth paragraph after image

Para 9: Ninth paragraph (should not appear)"""

        return test_utils.create_markdown_file(
            temp_dir / "test_context.md",
            content=content,
        )

    def test_generates_article_context(self, sample_markdown: Path) -> None:
        """Test that article context includes all before and 2 after target (default trim_frontmatter=False)."""
        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(sample_markdown),
            asset_path="image.jpg",
            line_number=11,  # "Para 6: Sixth paragraph with image"
            context_snippet="unused",
        )

        # Test default behavior (trim_frontmatter=False)
        context = alt_text_utils.generate_article_context(queue_item)

        # Verify correct inclusion/exclusion
        should_include = [
            "Para 1",
            "Para 2",
            "Para 3",
            "Para 4",
            "Para 5",
            "Para 6",
            "Para 7",
            "Para 8",
        ]
        should_exclude = ["Para 9"]

        for text in should_include:
            assert text in context, f"Expected '{text}' in context"
        for text in should_exclude:
            assert text not in context, f"Expected '{text}' NOT in context"

    def test_preserves_yaml_frontmatter_by_default(
        self, temp_dir: Path
    ) -> None:
        """Test that YAML frontmatter is preserved by default (trim_frontmatter=False)."""
        frontmatter = {"title": "Test Article", "date": "2023-01-01"}
        content = "Para 1\n\nPara 2 with image\n\nPara 3"

        markdown_file = test_utils.create_markdown_file(
            temp_dir / "test_frontmatter.md",
            frontmatter=frontmatter,
            content=content,
        )

        # Find line number for "Para 2 with image"
        source_lines = markdown_file.read_text().splitlines()
        target_line = next(
            i + 1
            for i, line in enumerate(source_lines)
            if "Para 2 with image" in line
        )

        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(markdown_file),
            asset_path="image.jpg",
            line_number=target_line,
            context_snippet="unused",
        )

        # Test default behavior (trim_frontmatter=False) - frontmatter should be preserved
        context = alt_text_utils.generate_article_context(queue_item)

        # Verify frontmatter is preserved and content remains
        assert "title: Test Article" in context
        assert "date: '2023-01-01'" in context
        assert "Para 1" in context
        assert "Para 2 with image" in context

    def test_handles_files_without_frontmatter(self, temp_dir: Path) -> None:
        """Test that files without frontmatter work correctly."""
        content = "Para 1\n\nPara 2 with image\n\nPara 3"

        markdown_file = test_utils.create_markdown_file(
            temp_dir / "test_no_frontmatter.md",
            frontmatter=None,
            content=content,
        )

        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(markdown_file),
            asset_path="image.jpg",
            line_number=3,  # "Para 2 with image"
            context_snippet="unused",
        )

        context = alt_text_utils.generate_article_context(queue_item)

        # Verify all content is included
        assert "Para 1" in context
        assert "Para 2 with image" in context
        assert "Para 3" in context

    def test_line_number_adjustment_with_frontmatter(
        self, temp_dir: Path
    ) -> None:
        """Test that line numbers are correctly adjusted when frontmatter is present."""
        frontmatter = {"title": "Test Article"}
        content = "Para 1\n\nTarget para\n\nPara 3"

        markdown_file = test_utils.create_markdown_file(
            temp_dir / "test_line_adjustment.md",
            frontmatter=frontmatter,
            content=content,
        )

        # Find line number for "Target para"
        source_lines = markdown_file.read_text().splitlines()
        target_line = next(
            i + 1
            for i, line in enumerate(source_lines)
            if "Target para" in line
        )

        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(markdown_file),
            asset_path="image.jpg",
            line_number=target_line,
            context_snippet="unused",
        )

        context = alt_text_utils.generate_article_context(
            queue_item, max_before=1, max_after=1, trim_frontmatter=True
        )

        # Frontmatter should be removed, content should remain
        assert "title:" not in context
        assert "Para 1" in context
        assert "Target para" in context
        assert "Para 3" in context

    def test_trim_frontmatter_true_removes_yaml(self, temp_dir: Path) -> None:
        """Test that trim_frontmatter=True removes YAML frontmatter from context."""
        frontmatter = {
            "title": "Test Article",
            "date": "2023-01-01",
            "tags": ["test"],
        }
        content = "Para 1: First paragraph\n\nPara 2: Target paragraph\n\nPara 3: Third paragraph"

        markdown_file = test_utils.create_markdown_file(
            temp_dir / "test_trim_true.md",
            frontmatter=frontmatter,
            content=content,
        )

        # Find line number for "Para 2: Target paragraph"
        source_lines = markdown_file.read_text().splitlines()
        target_line = next(
            i + 1
            for i, line in enumerate(source_lines)
            if "Para 2: Target paragraph" in line
        )

        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(markdown_file),
            asset_path="image.jpg",
            line_number=target_line,
            context_snippet="unused",
        )

        context = alt_text_utils.generate_article_context(
            queue_item, trim_frontmatter=True
        )

        # Verify frontmatter is completely removed
        assert "title:" not in context
        assert "Test Article" not in context
        assert "date:" not in context
        assert "2023-01-01" not in context
        assert "tags:" not in context
        assert "test" not in context
        assert "---" not in context

        # Verify content remains
        assert "Para 1: First paragraph" in context
        assert "Para 2: Target paragraph" in context
        assert "Para 3: Third paragraph" in context

    def test_trim_frontmatter_false_preserves_yaml(
        self, temp_dir: Path
    ) -> None:
        """Test that trim_frontmatter=False explicitly preserves YAML frontmatter in context."""
        frontmatter = {"title": "Test Article", "date": "2023-01-01"}
        content = "Para 1: First paragraph\n\nPara 2: Target paragraph\n\nPara 3: Third paragraph"

        markdown_file = test_utils.create_markdown_file(
            temp_dir / "test_trim_false.md",
            frontmatter=frontmatter,
            content=content,
        )

        # Find line number for "Para 2: Target paragraph"
        source_lines = markdown_file.read_text().splitlines()
        target_line = next(
            i + 1
            for i, line in enumerate(source_lines)
            if "Para 2: Target paragraph" in line
        )

        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(markdown_file),
            asset_path="image.jpg",
            line_number=target_line,
            context_snippet="unused",
        )

        context = alt_text_utils.generate_article_context(
            queue_item, trim_frontmatter=False
        )

        # Verify frontmatter is preserved
        assert "title: Test Article" in context
        assert "date: '2023-01-01'" in context

        # Verify content remains
        assert "Para 1: First paragraph" in context
        assert "Para 2: Target paragraph" in context
        assert "Para 3: Third paragraph" in context

    def test_trim_frontmatter_with_no_frontmatter_file(
        self, temp_dir: Path
    ) -> None:
        """Test that trim_frontmatter works correctly with files that have no frontmatter."""
        content = "Para 1: First paragraph\n\nPara 2: Target paragraph\n\nPara 3: Third paragraph"

        markdown_file = test_utils.create_markdown_file(
            temp_dir / "test_no_frontmatter_trim.md",
            frontmatter=None,
            content=content,
        )

        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(markdown_file),
            asset_path="image.jpg",
            line_number=3,  # "Para 2: Target paragraph"
            context_snippet="unused",
        )

        # Test both trim_frontmatter=True and False should work the same
        context_true = alt_text_utils.generate_article_context(
            queue_item, trim_frontmatter=True
        )
        context_false = alt_text_utils.generate_article_context(
            queue_item, trim_frontmatter=False
        )

        # Both should include all content
        for context in [context_true, context_false]:
            assert "Para 1: First paragraph" in context
            assert "Para 2: Target paragraph" in context
            assert "Para 3: Third paragraph" in context

        # Results should be identical when no frontmatter exists
        assert context_true == context_false

    def test_trim_frontmatter_line_number_adjustment(
        self, temp_dir: Path
    ) -> None:
        """Test that line numbers are correctly adjusted when trim_frontmatter=True."""
        frontmatter = {"title": "Test Article", "author": "Test Author"}
        content = "Para 1\n\nPara 2\n\nTarget para\n\nPara 4"

        markdown_file = test_utils.create_markdown_file(
            temp_dir / "test_line_adjustment_trim.md",
            frontmatter=frontmatter,
            content=content,
        )

        # Find line number for "Target para" in the full file
        source_lines = markdown_file.read_text().splitlines()
        target_line = next(
            i + 1
            for i, line in enumerate(source_lines)
            if "Target para" in line
        )

        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(markdown_file),
            asset_path="image.jpg",
            line_number=target_line,
            context_snippet="unused",
        )

        # Test with trim_frontmatter=True and limited context
        context = alt_text_utils.generate_article_context(
            queue_item, max_before=1, max_after=1, trim_frontmatter=True
        )

        # Should include the paragraph before and after target, but no frontmatter
        assert "title:" not in context
        assert "author:" not in context
        assert "Para 2" in context  # One before
        assert "Target para" in context  # Target
        assert "Para 4" in context  # One after
        assert (
            "Para 1" not in context
        )  # Should be excluded due to max_before=1

    def test_trim_frontmatter_default_behavior(self, temp_dir: Path) -> None:
        """Test that the default behavior (no trim_frontmatter parameter) preserves frontmatter."""
        frontmatter = {"title": "Default Test"}
        content = "Content paragraph"

        markdown_file = test_utils.create_markdown_file(
            temp_dir / "test_default_trim.md",
            frontmatter=frontmatter,
            content=content,
        )

        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(markdown_file),
            asset_path="image.jpg",
            line_number=4,  # Content paragraph line
            context_snippet="unused",
        )

        # Call without trim_frontmatter parameter (should default to False)
        context = alt_text_utils.generate_article_context(queue_item)

        # Should preserve frontmatter by default
        assert "title: Default Test" in context
        assert "Content paragraph" in context


@pytest.mark.parametrize(
    "target_line,should_include,should_exclude",
    [
        pytest.param(
            1,
            ["Para 1", "Para 2", "Para 3"],
            ["Para 4", "Para 5", "Para 6"],
            id="target_at_beginning",
        ),
        pytest.param(
            9,
            ["Para 1", "Para 2", "Para 3", "Para 4", "Para 5", "Para 6"],
            [],
            id="target_at_end",
        ),
        pytest.param(
            5,
            ["Para 1", "Para 2", "Para 3", "Para 4", "Para 5"],
            ["Para 6"],
            id="target_in_middle",
        ),
    ],
)
def test_edge_positions(
    temp_dir: Path,
    target_line: int,
    should_include: list[str],
    should_exclude: list[str],
) -> None:
    """Test article context generation at various target positions."""
    content = "Para 1\n\nPara 2\n\nPara 3\n\nPara 4\n\nPara 5\n\nPara 6"
    test_md = test_utils.create_markdown_file(
        temp_dir / "test_edge.md", content=content
    )

    queue_item = scan_for_empty_alt.QueueItem(
        markdown_file=str(test_md),
        asset_path="image.jpg",
        line_number=target_line,
        context_snippet="unused",
    )

    context = alt_text_utils.generate_article_context(queue_item)

    for text in should_include:
        assert text in context, f"Expected '{text}' in context"
    for text in should_exclude:
        assert text not in context, f"Expected '{text}' NOT in context"


class TestBuildPromptIntegration:
    """Test integration of build_prompt with article context generation."""

    @pytest.fixture
    def extensive_markdown(self, temp_dir: Path) -> Path:
        """Create markdown with many paragraphs for testing prompt generation."""
        content = """Para 1: Should not appear

Para 2: Should not appear

Para 3: Should appear

Para 4: Should appear

Para 5: Should appear

Para 6: Should appear

Para 7: Should appear

Para 8: Target paragraph with image

Para 9: Should appear

Para 10: Should appear

Para 11: Should not appear"""

        return test_utils.create_markdown_file(
            temp_dir / "test_prompt.md", content=content
        )

    def test_uses_limited_context_not_original(
        self, extensive_markdown: Path
    ) -> None:
        """Test that build_prompt uses full context before target."""
        text = extensive_markdown.read_text(encoding="utf-8")
        lines = text.splitlines()
        line_number = lines.index("Para 8: Target paragraph with image") + 1
        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(extensive_markdown),
            asset_path="image.jpg",
            line_number=line_number,
            context_snippet="This is the original full context that includes everything",
        )

        prompt = alt_text_utils.build_prompt(queue_item, max_chars=200)

        # Verify full context before target is used (all before + target + 2 after)
        should_be_in_prompt = [
            "Para 1",
            "Para 2",
            "Para 3",
            "Para 4",
            "Para 5",
            "Para 6",
            "Para 7",
            "Para 8",
            "Para 9",
            "Para 10",
        ]
        should_not_be_in_prompt = ["Para 11"]

        for text in should_be_in_prompt:
            assert text in prompt, f"Expected '{text}' in prompt"
        for text in should_not_be_in_prompt:
            assert text not in prompt, f"Expected '{text}' NOT in prompt"

        # Verify original context_snippet is ignored
        assert "original full context" not in prompt

    @pytest.mark.parametrize(
        "max_chars,expected_in_prompt",
        [
            pytest.param(100, ["Under 100 characters"], id="small_limit"),
            pytest.param(500, ["Under 500 characters"], id="large_limit"),
        ],
    )
    def test_prompt_includes_char_limit(
        self,
        extensive_markdown: Path,
        max_chars: int,
        expected_in_prompt: list[str],
    ) -> None:
        """Test that prompt includes the specified character limit."""
        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(extensive_markdown),
            asset_path="image.jpg",
            line_number=17,
            context_snippet="unused",
        )

        prompt = alt_text_utils.build_prompt(queue_item, max_chars=max_chars)

        for expected in expected_in_prompt:
            assert expected in prompt


class TestConvertAvifToPng:
    """Test the AVIF to PNG conversion function."""

    def test_non_avif_passthrough(self, temp_dir: Path) -> None:
        """Test that non-AVIF files are passed through unchanged."""
        test_file = temp_dir / "test.jpg"
        test_utils.create_test_image(test_file, "100x100")

        result = alt_text_utils._convert_avif_to_png(test_file, temp_dir)
        assert result == test_file

    def test_avif_conversion_success(self, temp_dir: Path) -> None:
        avif_file = temp_dir / "test.avif"
        png_file = temp_dir / "test.png"

        test_utils.create_test_image(avif_file, "100x100")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = None
            result = alt_text_utils._convert_avif_to_png(avif_file, temp_dir)

            assert result == png_file
            mock_run.assert_called_once()

            # Verify exact command structure
            call_args = mock_run.call_args[0][0]
            assert call_args[0].endswith("magick")
            assert call_args[1] == str(avif_file)
            assert call_args[2] == str(png_file)
            assert len(call_args) == 3  # Should be exactly 3 arguments

            # Verify subprocess.run parameters
            call_kwargs = mock_run.call_args[1]
            assert call_kwargs["check"] is True
            assert call_kwargs["capture_output"] is True
            assert call_kwargs["text"] is True

    def test_avif_conversion_failure(self, temp_dir: Path) -> None:
        """Test AVIF to PNG conversion failure handling."""
        avif_file = temp_dir / "test.avif"
        avif_file.write_bytes(b"invalid avif data")

        with patch("subprocess.run") as mock_run:
            mock_run.side_effect = subprocess.CalledProcessError(
                1, "magick", stderr="Conversion failed"
            )

            with pytest.raises(
                alt_text_utils.AltGenerationError,
                match="Failed to convert AVIF to PNG",
            ):
                alt_text_utils._convert_avif_to_png(avif_file, temp_dir)


class TestConvertGifToMp4:
    """Test the GIF to MP4 conversion function."""

    def test_non_gif_raises_error(self, temp_dir: Path) -> None:
        """Test that non-GIF files raise ValueError."""
        test_file = temp_dir / "test.jpg"
        test_utils.create_test_image(test_file, "100x100")

        with pytest.raises(ValueError, match="Unsupported file type"):
            alt_text_utils._convert_gif_to_mp4(test_file, temp_dir)

    def test_gif_conversion_success(self, temp_dir: Path) -> None:
        """Test successful GIF to MP4 conversion."""
        gif_file = temp_dir / "test.gif"
        mp4_file = temp_dir / "test.mp4"
        test_utils.create_test_image(gif_file, "100x100")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = None
            result = alt_text_utils._convert_gif_to_mp4(gif_file, temp_dir)

            assert result == mp4_file
            mock_run.assert_called_once()

            call_args = mock_run.call_args[0][0]
            assert str(mp4_file) in call_args

            call_kwargs = mock_run.call_args[1]
            assert call_kwargs["check"] is True
            assert call_kwargs["capture_output"] is True
            assert call_kwargs["text"] is True
            assert "timeout" in call_kwargs

    def test_gif_conversion_failure(self, temp_dir: Path) -> None:
        """Test GIF to MP4 conversion failure handling."""
        gif_file = temp_dir / "test.gif"
        gif_file.write_bytes(b"invalid gif data")

        with patch("subprocess.run") as mock_run:
            exc = subprocess.CalledProcessError(
                1, "ffmpeg", stderr="Conversion failed"
            )
            mock_run.side_effect = exc

            with pytest.raises(
                alt_text_utils.AltGenerationError,
                match=f"Failed to convert GIF to MP4: {exc!s}",
            ):
                alt_text_utils._convert_gif_to_mp4(gif_file, temp_dir)


class TestConvertAssetForLlm:
    """Test the asset conversion router function."""

    @patch("scripts.alt_text_utils._convert_avif_to_png")
    def test_avif_calls_avif_converter(
        self, mock_convert: Mock, temp_dir: Path
    ) -> None:
        """Test that .avif files are routed to the AVIF converter."""
        avif_file = temp_dir / "test.avif"
        alt_text_utils._convert_asset_for_llm(avif_file, temp_dir)
        mock_convert.assert_called_once_with(avif_file, temp_dir)

    @patch("scripts.alt_text_utils._convert_gif_to_mp4")
    def test_gif_calls_gif_converter(
        self, mock_convert: Mock, temp_dir: Path
    ) -> None:
        """Test that .gif files are routed to the GIF converter."""
        gif_file = temp_dir / "test.gif"
        alt_text_utils._convert_asset_for_llm(gif_file, temp_dir)
        mock_convert.assert_called_once_with(gif_file, temp_dir)

    def test_unsupported_file_passthrough(self, temp_dir: Path) -> None:
        """Test that unsupported files are passed through."""
        jpg_file = temp_dir / "test.jpg"
        result = alt_text_utils._convert_asset_for_llm(jpg_file, temp_dir)
        assert result == jpg_file


class TestDownloadAsset:
    """Test the asset download function."""

    def test_local_file_exists_non_avif(
        self, temp_dir: Path, base_queue_item: scan_for_empty_alt.QueueItem
    ) -> None:
        """Test downloading local non-AVIF file."""
        test_file = temp_dir / "image.jpg"
        test_file.write_bytes(b"fake image data")

        base_queue_item.asset_path = "image.jpg"

        result = alt_text_utils.download_asset(base_queue_item, temp_dir)

        # Should return the original file since it's not AVIF
        assert result == test_file.resolve()

    def test_local_file_exists_avif(
        self, temp_dir: Path, base_queue_item: scan_for_empty_alt.QueueItem
    ) -> None:
        """Test downloading local AVIF file gets converted."""
        avif_file = temp_dir / "image.avif"
        test_utils.create_test_image(avif_file, "100x100")

        base_queue_item.asset_path = "image.avif"

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = None
            result = alt_text_utils.download_asset(base_queue_item, temp_dir)

            assert result.suffix == ".png"
            assert result.parent == temp_dir

    def test_url_download_success(
        self, temp_dir: Path, base_queue_item: scan_for_empty_alt.QueueItem
    ) -> None:
        """Test successful URL download."""
        base_queue_item.asset_path = "https://example.com/image.jpg"

        mock_response = Mock()
        mock_response.iter_content.return_value = [b"fake", b"image", b"data"]
        mock_response.raise_for_status.return_value = None

        with patch("requests.get", return_value=mock_response) as mock_get:
            result = alt_text_utils.download_asset(base_queue_item, temp_dir)

            mock_get.assert_called_once()
            call_kwargs = mock_get.call_args[1]
            assert "User-Agent" in call_kwargs["headers"]
            assert "timeout" in call_kwargs
            assert "stream" in call_kwargs

            assert result.parent == temp_dir
            assert result.name.startswith("asset")

    def test_url_download_avif_conversion(
        self, temp_dir: Path, base_queue_item: scan_for_empty_alt.QueueItem
    ) -> None:
        """Test URL download of AVIF file with conversion."""
        base_queue_item.asset_path = "https://example.com/image.avif"

        mock_response = Mock()
        mock_response.iter_content.return_value = [b"fake", b"avif", b"data"]
        mock_response.raise_for_status.return_value = None

        with patch("requests.get", return_value=mock_response):
            with patch("subprocess.run") as mock_run:
                mock_run.return_value = None
                result = alt_text_utils.download_asset(
                    base_queue_item, temp_dir
                )

                # Should have converted to PNG
                assert result.suffix == ".png"
                mock_run.assert_called_once()

    def test_file_not_found(
        self, temp_dir: Path, base_queue_item: scan_for_empty_alt.QueueItem
    ) -> None:
        base_queue_item.asset_path = "nonexistent.jpg"

        with pytest.raises(FileNotFoundError, match="Unable to locate asset"):
            alt_text_utils.download_asset(base_queue_item, temp_dir)

    def test_url_download_http_error(
        self, temp_dir: Path, base_queue_item: scan_for_empty_alt.QueueItem
    ) -> None:
        base_queue_item.asset_path = "https://turntrout.com/error.jpg"

        mock_response = Mock()
        mock_response.raise_for_status.side_effect = requests.HTTPError(
            "404 Not Found"
        )

        with (
            patch("requests.get", return_value=mock_response),
            pytest.raises(requests.HTTPError),
        ):
            alt_text_utils.download_asset(base_queue_item, temp_dir)

    @pytest.mark.parametrize(
        "exception_type, exception_args",
        [
            (requests.Timeout, ("Request timed out",)),
            (requests.ConnectionError, ("Connection failed",)),
            (requests.RequestException, ("Network error",)),
        ],
    )
    def test_url_download_request_errors(
        self,
        temp_dir: Path,
        base_queue_item: scan_for_empty_alt.QueueItem,
        exception_type,
        exception_args,
    ) -> None:
        base_queue_item.asset_path = "https://turntrout.com/error.jpg"

        with patch("requests.get") as mock_get, pytest.raises(exception_type):
            mock_get.side_effect = exception_type(*exception_args)
            alt_text_utils.download_asset(base_queue_item, temp_dir)

    def test_url_download_partial_content(
        self, temp_dir: Path, base_queue_item: scan_for_empty_alt.QueueItem
    ) -> None:
        base_queue_item.asset_path = "https://example.com/partial.jpg"

        mock_response = Mock()
        mock_response.iter_content.return_value = [
            b"partial"
        ]  # Incomplete data
        mock_response.raise_for_status.return_value = None

        with patch("requests.get", return_value=mock_response):
            result = alt_text_utils.download_asset(base_queue_item, temp_dir)

            # Should still create file even with partial content
            assert result.exists()
            assert result.read_bytes() == b"partial"


def test_write_output(temp_dir: Path) -> None:
    """Test writing results to JSON file."""
    results = [
        alt_text_utils.AltGenerationResult(
            markdown_file="test1.md",
            asset_path="image1.jpg",
            suggested_alt="First image",
            final_alt="First image",
            model="gemini-2.5-flash",
            context_snippet="First context",
            line_number=1,
        ),
        alt_text_utils.AltGenerationResult(
            markdown_file="test2.md",
            asset_path="image2.jpg",
            suggested_alt="Second image",
            final_alt="Second image FINAL",
            model="gemini-2.5-flash",
            context_snippet="Second context",
            line_number=2,
        ),
    ]

    output_file = temp_dir / "output.json"
    alt_text_utils.write_output(results, output_file)

    assert output_file.exists()
    with output_file.open("r", encoding="utf-8") as f:
        data = json.load(f)

    assert len(data) == 2
    assert data[0]["markdown_file"] == "test1.md"
    assert data[1]["suggested_alt"] == "Second image"
    assert data[1]["final_alt"] == "Second image FINAL"


def _create_test_result(
    markdown_file: str, asset_path: str, final_alt: str
) -> alt_text_utils.AltGenerationResult:
    """Helper to create a test result with minimal boilerplate."""
    return alt_text_utils.AltGenerationResult(
        markdown_file=markdown_file,
        asset_path=asset_path,
        suggested_alt=final_alt,
        final_alt=final_alt,
        model="gemini-2.5-flash",
        context_snippet="Test context",
        line_number=1,
    )


@pytest.mark.parametrize(
    "initial_data,append_data,expected_count,description",
    [
        # Normal append case
        (
            [_create_test_result("test1.md", "image1.jpg", "First image")],
            [_create_test_result("test2.md", "image2.jpg", "Second image")],
            2,
            "normal append",
        ),
        # Append to non-existent file
        (
            None,
            [_create_test_result("test.md", "image.jpg", "Only image")],
            1,
            "append to non-existent file",
        ),
        # Multiple items in each batch
        (
            [
                _create_test_result(
                    "batch1_1.md", "image1.jpg", "Batch 1 Image 1"
                ),
                _create_test_result(
                    "batch1_2.md", "image2.jpg", "Batch 1 Image 2"
                ),
            ],
            [
                _create_test_result(
                    "batch2_1.md", "image3.jpg", "Batch 2 Image 1"
                )
            ],
            3,
            "multiple batches",
        ),
    ],
)
def test_write_output_append_mode(
    temp_dir: Path, initial_data, append_data, expected_count, description
) -> None:
    """Test writing results with append_mode=True in various scenarios."""
    output_file = temp_dir / f"{description.replace(' ', '_')}.json"

    # Write initial data if provided
    if initial_data:
        alt_text_utils.write_output(initial_data, output_file)

    # Append the additional results
    alt_text_utils.write_output(append_data, output_file, append_mode=True)

    # Verify results
    assert output_file.exists()
    with output_file.open("r", encoding="utf-8") as f:
        data = json.load(f)

    assert len(data) == expected_count

    # Verify order preservation for multiple batches case
    if description == "multiple batches":
        assert data[0]["markdown_file"] == "batch1_1.md"
        assert data[1]["markdown_file"] == "batch1_2.md"
        assert data[2]["markdown_file"] == "batch2_1.md"


def test_write_output_append_mode_corrupted_file(temp_dir: Path) -> None:
    """Test append mode gracefully handles corrupted existing files."""
    output_file = temp_dir / "corrupted.json"
    output_file.write_text("{ invalid json", encoding="utf-8")

    result = _create_test_result("test.md", "image.jpg", "Test image")
    alt_text_utils.write_output([result], output_file, append_mode=True)

    with output_file.open("r", encoding="utf-8") as f:
        data = json.load(f)

    assert len(data) == 1
    assert data[0]["markdown_file"] == "test.md"


class TestLoadExistingCaptions:
    """Test the load_existing_captions function."""

    @pytest.mark.parametrize(
        "captions_data, expected_paths",
        [
            # Empty file
            ([], set()),
            # Valid captions with asset_path
            (
                [
                    {"asset_path": "image1.jpg", "suggested_alt": "Alt 1"},
                    {"asset_path": "image2.png", "suggested_alt": "Alt 2"},
                ],
                {"image1.jpg", "image2.png"},
            ),
            # Mixed data with some missing asset_path
            (
                [
                    {"asset_path": "image1.jpg", "suggested_alt": "Alt 1"},
                    {"suggested_alt": "Alt without path"},
                    {"asset_path": "image2.png", "suggested_alt": "Alt 2"},
                ],
                {"image1.jpg", "image2.png"},
            ),
            # Data with non-dict items (should be filtered out)
            (
                [
                    {"asset_path": "image1.jpg", "suggested_alt": "Alt 1"},
                    "invalid_entry",
                    {"asset_path": "image2.png", "suggested_alt": "Alt 2"},
                ],
                {"image1.jpg", "image2.png"},
            ),
        ],
    )
    def test_load_existing_captions_valid_file(
        self, temp_dir: Path, captions_data: list, expected_paths: set[str]
    ) -> None:
        """Test loading existing captions from valid JSON file."""
        captions_file = temp_dir / "captions.json"
        captions_file.write_text(json.dumps(captions_data), encoding="utf-8")

        result = alt_text_utils.load_existing_captions(captions_file)
        assert result == expected_paths

    def test_load_existing_captions_nonexistent_file(
        self, temp_dir: Path
    ) -> None:
        """Test loading captions from non-existent file returns empty set."""
        nonexistent_file = temp_dir / "nonexistent.json"
        result = alt_text_utils.load_existing_captions(nonexistent_file)
        assert result == set()

    def test_load_existing_captions_invalid_json(self, temp_dir: Path) -> None:
        """Test loading captions from invalid JSON file returns empty set."""
        invalid_file = temp_dir / "invalid.json"
        invalid_file.write_text("{ invalid json", encoding="utf-8")

        result = alt_text_utils.load_existing_captions(invalid_file)
        assert result == set()

    def test_load_existing_captions_non_list_json(
        self, temp_dir: Path
    ) -> None:
        """Test loading captions from JSON that's not a list returns empty set."""
        non_list_file = temp_dir / "non_list.json"
        non_list_file.write_text('{"not": "a list"}', encoding="utf-8")

        result = alt_text_utils.load_existing_captions(non_list_file)
        assert result == set()


# ---------------------------------------------------------------------------
# Tests for is_url
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "path, expected",
    [
        ("https://example.com/image.jpg", True),
        ("http://example.com/image.png", True),
        ("ftp://example.com/file.txt", True),
        ("./local/file.jpg", False),
        ("../parent/file.png", False),
        ("/absolute/path/file.jpg", False),
        ("relative/path/file.png", False),
        ("file.jpg", False),
        ("", False),
        ("   ", False),  # Whitespace only
        ("not-a-url", False),
        ("http://", False),  # Incomplete URL
        ("://missing-scheme", False),
    ],
)
def test_is_url(path: str, expected: bool) -> None:
    """Test URL detection functionality."""
    assert alt_text_utils.is_url(path) is expected


# ---------------------------------------------------------------------------
# Tests for paragraph_context
# ---------------------------------------------------------------------------


def test_paragraph_context_grabs_neighboring_paragraphs() -> None:
    """Ensure that the context snippet contains adjacent paragraphs."""
    lines = [
        "Para A line 1\n",
        "\n",
        "Para B line 1\n",
        "Para B line 2\n",
        "\n",
        "Para C line 1\n",
        "\n",
        "Para D is outside of the context\n",
    ]

    snippet = alt_text_utils.paragraph_context(lines, 2, max_after=0)

    # Should include paragraphs A and B (target is line 2 which is in Para B)
    assert "Para A" in snippet
    assert "Para B line 1" in snippet and "Para B line 2" in snippet
    assert "Para C" not in snippet
    assert "Para D" not in snippet


class TestParagraphContext:
    """Test suite for paragraph_context function."""

    @pytest.fixture
    def sample_text_lines(self) -> list[str]:
        """Sample text with multiple paragraphs for testing."""
        return [
            "Para A line 1",  # Para 0
            "",
            "Para B line 1",  # Para 1
            "Para B line 2",
            "",
            "Para C line 1",  # Para 2
            "",
            "Para D line 1",  # Para 3
            "",
            "Para E line 1",  # Para 4
            "",
            "Para F line 1",  # Para 5 (target paragraph at line 10)
            "",
            "Para G line 1",  # Para 6 (after target)
            "",
            "Para H line 1",  # Para 7 (after target)
        ]

    @pytest.mark.parametrize(
        "max_before,should_include,should_exclude",
        [
            pytest.param(
                None,
                ["Para A", "Para B", "Para C", "Para D", "Para E", "Para F"],
                ["Para G", "Para H"],
                id="no_limit_all_before",
            ),
            pytest.param(
                2,
                ["Para D", "Para E", "Para F"],
                ["Para A", "Para B", "Para C", "Para G", "Para H"],
                id="limit_2_before",
            ),
            pytest.param(
                1,
                ["Para E", "Para F"],
                ["Para A", "Para B", "Para C", "Para D", "Para G", "Para H"],
                id="limit_1_before",
            ),
            pytest.param(
                0,
                ["Para F"],
                [
                    "Para A",
                    "Para B",
                    "Para C",
                    "Para D",
                    "Para E",
                    "Para G",
                    "Para H",
                ],
                id="no_paragraphs_before",
            ),
            pytest.param(
                10,
                ["Para A", "Para B", "Para C", "Para D", "Para E", "Para F"],
                ["Para G", "Para H"],
                id="limit_exceeds_available",
            ),
        ],
    )
    def test_max_before_parameter(
        self,
        sample_text_lines: list[str],
        max_before: int | None,
        should_include: list[str],
        should_exclude: list[str],
    ) -> None:
        """Test paragraph_context with various max_before values."""
        target_line = sample_text_lines.index("Para F line 1")
        snippet = alt_text_utils.paragraph_context(
            sample_text_lines, target_line, max_before=max_before, max_after=0
        )

        for text in should_include:
            assert text in snippet, f"Expected '{text}' in snippet"

        for text in should_exclude:
            assert text not in snippet, f"Expected '{text}' NOT in snippet"

    @pytest.mark.parametrize(
        "lines,target_line,expected_result",
        [
            pytest.param(["Only line"], 0, "Only line", id="single_line"),
            pytest.param([], 0, "", id="empty_input"),
            pytest.param(["", "", ""], 1, "", id="only_blank_lines"),
        ],
    )
    def test_edge_cases(
        self, lines: list[str], target_line: int, expected_result: str
    ) -> None:
        """Test edge cases for paragraph_context."""
        result = alt_text_utils.paragraph_context(
            lines, target_line, max_after=0
        )
        assert result == expected_result

    def test_preserves_formatting(self) -> None:
        """Test that original formatting is preserved."""
        lines = [
            "# Header",
            "",
            "First **bold** text",
            "and a second line",
            "",
            "Second [link](url)",
            "",
            "Third paragraph",
        ]

        snippet = alt_text_utils.paragraph_context(
            lines, 4, max_before=1, max_after=0
        )

        assert "**bold**" in snippet
        assert "[link](url)" in snippet
        assert "# Header" not in snippet

    @pytest.mark.parametrize(
        "max_before,expected_present,expected_absent",
        [
            pytest.param(
                0, ["Para 3"], ["Para 1", "Para 2"], id="zero_before"
            ),
            pytest.param(
                2, ["Para 1", "Para 2", "Para 3"], [], id="exact_available"
            ),
        ],
    )
    def test_boundary_conditions(
        self,
        max_before: int,
        expected_present: list[str],
        expected_absent: list[str],
    ) -> None:
        """Test boundary conditions for max_before parameter."""
        lines = [
            "Para 1",
            "",
            "Para 2",
            "",
            "Para 3",
            "",
            "Para 4",
            "",
            "Para 5",
        ]
        target_line = 4  # "Para 3"

        snippet = alt_text_utils.paragraph_context(
            lines, target_line, max_before=max_before, max_after=0
        )

        for text in expected_present:
            assert text in snippet
        for text in expected_absent:
            assert text not in snippet

    def test_out_of_bounds_target(self) -> None:
        """Test behavior when target line is out of bounds."""
        lines = ["Line 1", "", "Line 2"]
        result = alt_text_utils.paragraph_context(
            lines, 10, max_before=2, max_after=0
        )
        assert isinstance(result, str)  # Should not crash


# ---------------------------------------------------------------------------
# Tests for utility functions copied from script_utils
# ---------------------------------------------------------------------------


def test_find_git_root(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test finding the git root directory."""
    expected_output = "/path/to/git/root"

    def mock_subprocess_run(*args, **_kwargs) -> subprocess.CompletedProcess:
        return subprocess.CompletedProcess(
            args=args,
            returncode=0,
            stdout=expected_output,
        )

    monkeypatch.setattr(alt_text_utils.subprocess, "run", mock_subprocess_run)
    assert alt_text_utils.get_git_root() == Path(expected_output)


def test_get_git_root_raises_error() -> None:
    """Test that get_git_root raises RuntimeError when git command fails."""

    def mock_subprocess_run(*args, **_kwargs) -> subprocess.CompletedProcess:
        return subprocess.CompletedProcess(
            args=args,
            returncode=1,
            stdout="",
        )

    with (
        mock.patch.object(
            alt_text_utils.subprocess, "run", mock_subprocess_run
        ),
        pytest.raises(RuntimeError),
    ):
        alt_text_utils.get_git_root()


def test_find_executable_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that find_executable raises FileNotFoundError for an executable
    that does not exist."""
    monkeypatch.setattr(alt_text_utils, "_executable_cache", {})
    monkeypatch.setattr(shutil, "which", lambda name: None)
    with pytest.raises(FileNotFoundError):
        alt_text_utils.find_executable("non_existent_executable")


def test_find_executable_success_and_cache(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Test that find_executable finds an executable and caches the result."""
    monkeypatch.setattr(alt_text_utils, "_executable_cache", {})
    mock_which = mock.Mock(return_value="/fake/path/to/git")
    monkeypatch.setattr(shutil, "which", mock_which)

    # First call, should call `which`
    path = alt_text_utils.find_executable("git")
    assert path == "/fake/path/to/git"
    mock_which.assert_called_once_with("git")

    # Second call, should use cache and not call `which` again
    path2 = alt_text_utils.find_executable("git")
    assert path2 == "/fake/path/to/git"
    mock_which.assert_called_once()


def test_get_files_no_dir() -> None:
    """Test when no directory is provided."""
    result = alt_text_utils.get_files()
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
def test_get_files_specific_dir(
    tmp_path: Path, file_paths: list[str], expected_files: list[str]
) -> None:
    """Test file discovery by inferring structure from file paths."""
    # Create test files and directories
    for file_path in file_paths:
        file: Path = tmp_path / file_path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.touch()  # Just create empty files

    # Get files based on the file extensions in the file paths
    filetypes_to_match = list({p.suffix for p in map(Path, expected_files)})
    result = alt_text_utils.get_files(
        dir_to_search=tmp_path,
        filetypes_to_match=filetypes_to_match,
        use_git_ignore=False,
    )

    # Normalize file paths and compare
    result_paths = [str(p.relative_to(tmp_path)) for p in result]
    assert sorted(result_paths) == sorted(expected_files)


def test_get_files_gitignore(tmp_path: Path) -> None:
    """Test with a .gitignore file."""
    try:
        # Create a git repository in tmp_path
        repo = git.Repo.init(tmp_path)
        (tmp_path / ".gitignore").write_text("*.txt\n")  # Ignore text files

        md_file = tmp_path / "test.md"
        txt_file = tmp_path / "test.txt"
        md_file.write_text("Markdown content")
        txt_file.write_text("Text content")
        repo.index.add([".gitignore", "test.md", "test.txt"])
        repo.index.commit("Initial commit")

        # Test getting files with gitignore
        result = alt_text_utils.get_files(dir_to_search=tmp_path)
        assert len(result) == 1
        assert result[0] == md_file
    except git.GitCommandError:
        pytest.skip("Git not installed or not in PATH")


def test_get_files_ignore_dirs(tmp_path: Path) -> None:
    """Test that specified directories are ignored."""
    # Create test directory structure
    templates_dir = tmp_path / "templates"
    regular_dir = tmp_path / "regular"
    nested_templates = tmp_path / "docs" / "templates"

    # Create directories
    for dir_path in [templates_dir, regular_dir, nested_templates]:
        dir_path.mkdir(parents=True, exist_ok=True)

    # Create test files
    test_files = [
        templates_dir / "template.md",
        regular_dir / "regular.md",
        nested_templates / "nested.md",
        tmp_path / "root.md",
    ]

    for file in test_files:
        file.write_text("test content")

    # Get files, ignoring 'templates' directories
    result = alt_text_utils.get_files(
        dir_to_search=tmp_path,
        filetypes_to_match=(".md",),
        ignore_dirs=["templates"],
        use_git_ignore=False,
    )

    # Convert results to set of strings for easier comparison
    result_paths = {str(p.relative_to(tmp_path)) for p in result}

    # Expected files (only files not in 'templates' directories)
    expected_paths = {"regular/regular.md", "root.md"}

    assert result_paths == expected_paths


def test_split_yaml_invalid_format(tmp_path: Path) -> None:
    """Test handling of invalid YAML format."""
    file_path = tmp_path / "invalid.md"
    file_path.write_text(
        "Invalid content without proper frontmatter", encoding="utf-8"
    )

    metadata, content = alt_text_utils.split_yaml(file_path)
    assert metadata == {}
    assert content == ""


def test_split_yaml_empty_frontmatter(tmp_path: Path) -> None:
    """Test handling of empty frontmatter."""
    file_path = tmp_path / "empty.md"
    file_path.write_text("---\n---\nContent", encoding="utf-8")

    metadata, content = alt_text_utils.split_yaml(file_path)
    assert metadata == {}
    assert content == "\nContent"


def test_split_yaml_malformed_yaml(tmp_path: Path) -> None:
    """Test handling of malformed YAML."""
    file_path = tmp_path / "malformed.md"
    file_path.write_text(
        '---\ntitle: "Unclosed quote\n---\nContent', encoding="utf-8"
    )

    # Expect split_yaml to return empty metadata and content for malformed files
    metadata, content = alt_text_utils.split_yaml(file_path, verbose=True)
    assert metadata == {}
    assert content == ""
