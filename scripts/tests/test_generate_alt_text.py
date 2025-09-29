"""Tests for generate_alt_text.py module."""

import json
import subprocess
import sys
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import Mock, patch

import pytest
import requests
from rich import console
from rich.console import Console

sys.path.append(str(Path(__file__).parent.parent))

from .. import generate_alt_text, scan_for_empty_alt
from . import utils as test_utils

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def create_alt(idx: int, *, final_alt: str | None = None) -> generate_alt_text.AltGenerationResult:  # type: ignore
    """Factory for AltGenerationResult with deterministic dummy fields."""
    return generate_alt_text.AltGenerationResult(
        markdown_file=f"test{idx}.md",
        asset_path=f"image{idx}.jpg",
        suggested_alt=f"suggestion {idx}",
        final_alt=final_alt,
        model="test-model",
        context_snippet=f"context {idx}",
        line_number=idx,
    )


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

    # Mock _generate_article_context to return the context_snippet
    with patch.object(
        generate_alt_text,
        "_generate_article_context",
        return_value=context_snippet,
    ):
        prompt = generate_alt_text._build_prompt(base_queue_item, max_chars)

    for expected in expected_in_prompt:
        assert expected in prompt


class TestGenerateArticleContext:
    """Test suite for _generate_article_context function."""

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
        context = generate_alt_text._generate_article_context(queue_item)

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
        context = generate_alt_text._generate_article_context(queue_item)

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

        context = generate_alt_text._generate_article_context(queue_item)

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

        context = generate_alt_text._generate_article_context(
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

        context = generate_alt_text._generate_article_context(
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

        context = generate_alt_text._generate_article_context(
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
        context_true = generate_alt_text._generate_article_context(
            queue_item, trim_frontmatter=True
        )
        context_false = generate_alt_text._generate_article_context(
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
        context = generate_alt_text._generate_article_context(
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
        context = generate_alt_text._generate_article_context(queue_item)

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

    context = generate_alt_text._generate_article_context(queue_item)

    for text in should_include:
        assert text in context, f"Expected '{text}' in context"
    for text in should_exclude:
        assert text not in context, f"Expected '{text}' NOT in context"


class TestBuildPromptIntegration:
    """Test integration of _build_prompt with article context generation."""

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
        """Test that _build_prompt uses full context before target."""
        text = extensive_markdown.read_text(encoding="utf-8")
        lines = text.splitlines()
        line_number = lines.index("Para 8: Target paragraph with image") + 1
        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(extensive_markdown),
            asset_path="image.jpg",
            line_number=line_number,
            context_snippet="This is the original full context that includes everything",
        )

        prompt = generate_alt_text._build_prompt(queue_item, max_chars=200)

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

        prompt = generate_alt_text._build_prompt(
            queue_item, max_chars=max_chars
        )

        for expected in expected_in_prompt:
            assert expected in prompt


@pytest.mark.parametrize(
    "model, queue_count, avg_prompt_tokens, avg_output_tokens",
    [
        ("gemini-2.5-flash", 10, 300, 50),
        ("gemini-2.5-flash-lite", 100, 300, 50),
        ("gemini-2.5-flash", 1, 200, 30),
        ("gemini-2.5-flash-lite", 50, 400, 80),
    ],
)
def test_estimate_cost_calculation_parametrized(
    model: str,
    queue_count: int,
    avg_prompt_tokens: int,
    avg_output_tokens: int,
) -> None:
    # Retrieve costs from the actual MODEL_COSTS constant
    model_costs = generate_alt_text.MODEL_COSTS[model]
    input_cost_per_1k = model_costs["input"]
    output_cost_per_1k = model_costs["output"]

    expected_input = (
        avg_prompt_tokens * queue_count / 1000
    ) * input_cost_per_1k
    expected_output = (
        avg_output_tokens * queue_count / 1000
    ) * output_cost_per_1k
    expected_total = expected_input + expected_output

    result = generate_alt_text._estimate_cost(
        model, queue_count, avg_prompt_tokens, avg_output_tokens
    )

    assert f"${expected_total:.3f}" in result
    assert f"${expected_input:.3f} input" in result
    assert f"${expected_output:.3f} output" in result


@pytest.mark.parametrize(
    "model, queue_count",
    [
        ("gemini-2.5-flash", 1),
        ("gemini-2.5-flash", 10),
        ("gemini-2.5-flash-lite", 5),
        ("gemini-2.5-flash-lite", 100),
    ],
)
def test_estimate_cost_format_consistency(
    model: str, queue_count: int
) -> None:
    """Test that cost estimation returns consistently formatted results."""
    result = generate_alt_text._estimate_cost(model, queue_count)

    # Check format consistency
    assert result.startswith("Estimated cost: $")
    assert " input + $" in result
    assert " output)" in result
    assert result.count("$") == 3  # Total, input, output


def test_estimate_cost_invalid_model() -> None:
    """Test cost estimation with invalid model returns informative message."""
    result = generate_alt_text._estimate_cost("invalid-model", 10)

    assert result.startswith("Can't estimate cost for unknown model")


class TestConvertAvifToPng:
    """Test the AVIF to PNG conversion function."""

    def test_non_avif_passthrough(self, temp_dir: Path) -> None:
        """Test that non-AVIF files are passed through unchanged."""
        test_file = temp_dir / "test.jpg"
        test_utils.create_test_image(test_file, "100x100")

        result = generate_alt_text._convert_avif_to_png(test_file, temp_dir)
        assert result == test_file

    def test_avif_conversion_success(self, temp_dir: Path) -> None:
        avif_file = temp_dir / "test.avif"
        png_file = temp_dir / "test.png"

        test_utils.create_test_image(avif_file, "100x100")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = None
            result = generate_alt_text._convert_avif_to_png(
                avif_file, temp_dir
            )

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
                generate_alt_text.AltGenerationError,
                match="Failed to convert AVIF to PNG",
            ):
                generate_alt_text._convert_avif_to_png(avif_file, temp_dir)


class TestConvertGifToMp4:
    """Test the GIF to MP4 conversion function."""

    def test_non_gif_raises_error(self, temp_dir: Path) -> None:
        """Test that non-GIF files raise ValueError."""
        test_file = temp_dir / "test.jpg"
        test_utils.create_test_image(test_file, "100x100")

        with pytest.raises(ValueError, match="Unsupported file type"):
            generate_alt_text._convert_gif_to_mp4(test_file, temp_dir)

    def test_gif_conversion_success(self, temp_dir: Path) -> None:
        """Test successful GIF to MP4 conversion."""
        gif_file = temp_dir / "test.gif"
        mp4_file = temp_dir / "test.mp4"
        test_utils.create_test_image(gif_file, "100x100")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = None
            result = generate_alt_text._convert_gif_to_mp4(gif_file, temp_dir)

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
                generate_alt_text.AltGenerationError,
                match=f"Failed to convert GIF to MP4: {exc!s}",
            ):
                generate_alt_text._convert_gif_to_mp4(gif_file, temp_dir)


class TestConvertAssetForLlm:
    """Test the asset conversion router function."""

    @patch("scripts.generate_alt_text._convert_avif_to_png")
    def test_avif_calls_avif_converter(
        self, mock_convert: Mock, temp_dir: Path
    ) -> None:
        """Test that .avif files are routed to the AVIF converter."""
        avif_file = temp_dir / "test.avif"
        generate_alt_text._convert_asset_for_llm(avif_file, temp_dir)
        mock_convert.assert_called_once_with(avif_file, temp_dir)

    @patch("scripts.generate_alt_text._convert_gif_to_mp4")
    def test_gif_calls_gif_converter(
        self, mock_convert: Mock, temp_dir: Path
    ) -> None:
        """Test that .gif files are routed to the GIF converter."""
        gif_file = temp_dir / "test.gif"
        generate_alt_text._convert_asset_for_llm(gif_file, temp_dir)
        mock_convert.assert_called_once_with(gif_file, temp_dir)

    def test_unsupported_file_passthrough(self, temp_dir: Path) -> None:
        """Test that unsupported files are passed through."""
        jpg_file = temp_dir / "test.jpg"
        result = generate_alt_text._convert_asset_for_llm(jpg_file, temp_dir)
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

        result = generate_alt_text._download_asset(base_queue_item, temp_dir)

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
            result = generate_alt_text._download_asset(
                base_queue_item, temp_dir
            )

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
            result = generate_alt_text._download_asset(
                base_queue_item, temp_dir
            )

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
                result = generate_alt_text._download_asset(
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
            generate_alt_text._download_asset(base_queue_item, temp_dir)

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
            generate_alt_text._download_asset(base_queue_item, temp_dir)

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
            generate_alt_text._download_asset(base_queue_item, temp_dir)

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
            result = generate_alt_text._download_asset(
                base_queue_item, temp_dir
            )

            # Should still create file even with partial content
            assert result.exists()
            assert result.read_bytes() == b"partial"


class TestDisplayManager:
    """Test the DisplayManager class."""

    @pytest.fixture
    def display_manager(self) -> generate_alt_text.DisplayManager:
        """Create a DisplayManager with mocked console for testing."""
        richConsole = console.Console(file=Mock())
        return generate_alt_text.DisplayManager(richConsole)

    def test_display_manager_creation(self) -> None:
        richConsole = console.Console()
        display = generate_alt_text.DisplayManager(richConsole)
        assert display.console is richConsole

    def test_show_context(
        self,
        display_manager: generate_alt_text.DisplayManager,
        base_queue_item: scan_for_empty_alt.QueueItem,
    ) -> None:
        # Create the markdown file that the queue item references
        markdown_file = Path(base_queue_item.markdown_file)
        test_utils.create_markdown_file(
            markdown_file, content="Test content for context display."
        )

        # Should not raise an exception
        display_manager.show_context(base_queue_item)

    def test_show_image_not_tty(
        self, display_manager: generate_alt_text.DisplayManager, temp_dir: Path
    ) -> None:
        test_image = temp_dir / "test.jpg"
        test_utils.create_test_image(test_image, "100x100")

        with (
            patch("sys.stdout.isatty", return_value=False),
            patch.dict("os.environ", {}, clear=True),  # Clear TMUX env var
            patch("subprocess.run") as mock_run,
        ):
            # Should not raise an exception and should call imgcat
            display_manager.show_image(test_image)
            mock_run.assert_called_once_with(
                ["imgcat", str(test_image)], check=True
            )

    def test_show_image_success(
        self, display_manager: generate_alt_text.DisplayManager, temp_dir: Path
    ) -> None:
        test_image = temp_dir / "test.jpg"
        test_utils.create_test_image(test_image, "100x100")

        with (
            patch("subprocess.run") as mock_run,
            patch.dict("os.environ", {}, clear=True),  # Clear TMUX env var
        ):
            display_manager.show_image(test_image)

            # Should have called imgcat with the image path
            mock_run.assert_called_once_with(
                ["imgcat", str(test_image)], check=True
            )

    def test_show_image_subprocess_error(
        self, display_manager: generate_alt_text.DisplayManager, temp_dir: Path
    ) -> None:
        test_image = temp_dir / "test.jpg"
        test_utils.create_test_image(test_image, "100x100")

        with (
            patch("subprocess.run") as mock_run,
            patch.dict("os.environ", {}, clear=True),  # Clear TMUX env var
        ):
            mock_run.side_effect = subprocess.CalledProcessError(
                1, ["imgcat", str(test_image)]
            )
            with pytest.raises(ValueError):
                display_manager.show_image(test_image)

    def test_show_image_tmux_error(
        self, display_manager: generate_alt_text.DisplayManager, temp_dir: Path
    ) -> None:
        test_image = temp_dir / "test.jpg"
        test_utils.create_test_image(test_image, "100x100")

        with patch.dict("os.environ", {"TMUX": "1"}):
            with pytest.raises(ValueError, match="Cannot open image in tmux"):
                display_manager.show_image(test_image)


def test_write_output(temp_dir: Path) -> None:
    """Test writing results to JSON file."""
    results = [
        generate_alt_text.AltGenerationResult(
            markdown_file="test1.md",
            asset_path="image1.jpg",
            suggested_alt="First image",
            final_alt="First image",
            model="gemini-2.5-flash",
            context_snippet="First context",
            line_number=1,
        ),
        generate_alt_text.AltGenerationResult(
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
    generate_alt_text._write_output(results, output_file)

    assert output_file.exists()
    with output_file.open("r", encoding="utf-8") as f:
        data = json.load(f)

    assert len(data) == 2
    assert data[0]["markdown_file"] == "test1.md"
    assert data[1]["suggested_alt"] == "Second image"
    assert data[1]["final_alt"] == "Second image FINAL"


def _create_test_result(
    markdown_file: str, asset_path: str, final_alt: str
) -> generate_alt_text.AltGenerationResult:
    """Helper to create a test result with minimal boilerplate."""
    return generate_alt_text.AltGenerationResult(
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
        generate_alt_text._write_output(initial_data, output_file)

    # Append the additional results
    generate_alt_text._write_output(append_data, output_file, append_mode=True)

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
    generate_alt_text._write_output([result], output_file, append_mode=True)

    with output_file.open("r", encoding="utf-8") as f:
        data = json.load(f)

    assert len(data) == 1
    assert data[0]["markdown_file"] == "test.md"


def test_run_llm_success(temp_dir: Path) -> None:
    """Test successful LLM execution."""
    attachment = temp_dir / "test.jpg"
    attachment.write_bytes(b"fake image")
    prompt = "Generate alt text for this image"
    model = "gemini-2.5-flash"
    timeout = 60

    mock_result = Mock()
    mock_result.returncode = 0
    mock_result.stdout = "Generated alt text"
    mock_result.stderr = ""

    with patch("subprocess.run", return_value=mock_result) as mock_run:
        result = generate_alt_text._run_llm(attachment, prompt, model, timeout)

        assert result == "Generated alt text"
        mock_run.assert_called_once()
        call_args = mock_run.call_args[0][0]
        assert "llm" in call_args[0]
        assert "-m" in call_args
        assert model in call_args
        assert "-a" in call_args
        assert str(attachment) in call_args
        assert prompt in call_args


class TestLoadExistingCaptions:
    """Test the _load_existing_captions function."""

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

        result = generate_alt_text._load_existing_captions(captions_file)
        assert result == expected_paths

    def test_load_existing_captions_nonexistent_file(
        self, temp_dir: Path
    ) -> None:
        """Test loading captions from non-existent file returns empty set."""
        nonexistent_file = temp_dir / "nonexistent.json"
        result = generate_alt_text._load_existing_captions(nonexistent_file)
        assert result == set()

    def test_load_existing_captions_invalid_json(self, temp_dir: Path) -> None:
        """Test loading captions from invalid JSON file returns empty set."""
        invalid_file = temp_dir / "invalid.json"
        invalid_file.write_text("{ invalid json", encoding="utf-8")

        result = generate_alt_text._load_existing_captions(invalid_file)
        assert result == set()

    def test_load_existing_captions_non_list_json(
        self, temp_dir: Path
    ) -> None:
        """Test loading captions from JSON that's not a list returns empty set."""
        non_list_file = temp_dir / "non_list.json"
        non_list_file.write_text('{"not": "a list"}', encoding="utf-8")

        result = generate_alt_text._load_existing_captions(non_list_file)
        assert result == set()


def test_run_generate_appends_to_suggestions_file(temp_dir: Path) -> None:
    """Test that _run_generate appends to existing suggestions file instead of overwriting."""
    suggestions_file = temp_dir / "suggested_alts.json"

    existing_data = [{"asset_path": "existing.jpg", "suggested_alt": "Old"}]
    suggestions_file.write_text(json.dumps(existing_data), encoding="utf-8")

    new_suggestion = generate_alt_text.AltGenerationResult(
        markdown_file="new.md",
        asset_path="new.jpg",
        suggested_alt="New",
        model="test",
        context_snippet="ctx",
        line_number=1,
    )

    options = generate_alt_text.GenerateAltTextOptions(
        root=temp_dir,
        model="test",
        max_chars=100,
        timeout=60,
        output_path=temp_dir / "captions.json",
        skip_existing=False,
    )

    # Create a dummy queue item that will trigger the async suggestions call
    dummy_queue_item = generate_alt_text.scan_for_empty_alt.QueueItem(
        markdown_file="test.md",
        asset_path="test.jpg",
        line_number=1,
        context_snippet="test context",
    )

    with (
        patch.object(
            generate_alt_text.scan_for_empty_alt,
            "build_queue",
            return_value=[dummy_queue_item],
        ),
        patch.object(
            generate_alt_text,
            "_async_generate_suggestions",
            return_value=[new_suggestion],
        ),
    ):
        generate_alt_text._run_generate(options, suggestions_file)

    data = json.loads(suggestions_file.read_text())
    assert len(data) == 2
    assert data[0]["asset_path"] == "existing.jpg"
    assert data[1]["asset_path"] == "new.jpg"


def test_filter_existing_captions_filters_items(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    queue_items = [
        scan_for_empty_alt.QueueItem(
            markdown_file="test1.md",
            asset_path="image1.jpg",
            line_number=1,
            context_snippet="context1",
        ),
        scan_for_empty_alt.QueueItem(
            markdown_file="test2.md",
            asset_path="image2.jpg",
            line_number=2,
            context_snippet="context2",
        ),
    ]

    def fake_load_existing_captions(_path: Path) -> set[str]:
        return {"image1.jpg"}

    monkeypatch.setattr(
        generate_alt_text,
        "_load_existing_captions",
        fake_load_existing_captions,
    )

    console_mock = Mock()
    console_mock.print = Mock()

    filtered = generate_alt_text._filter_existing_captions(
        queue_items,
        [Path("captions.json")],
        console_mock,
    )

    assert len(filtered) == 1
    assert filtered[0].asset_path == "image2.jpg"
    console_mock.print.assert_called_once()


class TestSkipExistingCLI:
    """Test CLI argument parsing for --skip-existing."""

    @pytest.mark.parametrize(
        "args, expected_skip_existing",
        [
            (
                ["generate_alt_text.py", "generate", "--model", "test-model"],
                True,
            ),
            (
                [
                    "generate_alt_text.py",
                    "generate",
                    "--model",
                    "test-model",
                    "--process-existing",
                ],
                False,
            ),
        ],
    )
    def test_parse_args_skip_existing(
        self, args: list[str], expected_skip_existing: bool
    ) -> None:
        """Test --skip-existing argument parsing."""
        with patch("sys.argv", args):
            parsed_args = generate_alt_text._parse_args()
            assert parsed_args.skip_existing is expected_skip_existing


def test_run_llm_failure(temp_dir: Path) -> None:
    """Test LLM execution failure."""
    attachment = temp_dir / "test.jpg"
    attachment.write_bytes(b"fake image")
    prompt = "Generate alt text for this image"
    model = "gemini-2.5-flash"
    timeout = 60

    mock_result = Mock()
    mock_result.returncode = 1
    mock_result.stdout = ""
    mock_result.stderr = "LLM error"

    with patch("subprocess.run", return_value=mock_result):
        with pytest.raises(
            generate_alt_text.AltGenerationError,
            match="Caption generation failed",
        ):
            generate_alt_text._run_llm(attachment, prompt, model, timeout)


def test_run_llm_empty_output(temp_dir: Path) -> None:
    """Test LLM returning empty output."""
    attachment = temp_dir / "test.jpg"
    attachment.write_bytes(b"fake image")
    prompt = "Generate alt text for this image"
    model = "gemini-2.5-flash"
    timeout = 60

    mock_result = Mock()
    mock_result.returncode = 0
    mock_result.stdout = "   "  # Only whitespace
    mock_result.stderr = ""

    with patch("subprocess.run", return_value=mock_result):
        with pytest.raises(
            generate_alt_text.AltGenerationError,
            match="LLM returned empty caption",
        ):
            generate_alt_text._run_llm(attachment, prompt, model, timeout)


@pytest.fixture
def test_suggestions() -> list[generate_alt_text.AltGenerationResult]:
    """Test suggestions for error handling tests."""
    return [
        generate_alt_text.AltGenerationResult(
            markdown_file="test1.md",
            asset_path="image1.jpg",
            suggested_alt="First",
            model="test",
            context_snippet="ctx1",
            line_number=1,
        ),
        generate_alt_text.AltGenerationResult(
            markdown_file="test2.md",
            asset_path="image2.jpg",
            suggested_alt="Second",
            model="test",
            context_snippet="ctx2",
            line_number=2,
        ),
    ]


@contextmanager
def _setup_error_mocks(error_type, error_on_item: str):
    """Helper to set up mocks that raise errors on specific items."""

    def mock_download_asset(queue_item, workspace):
        if error_on_item in queue_item.asset_path:
            raise error_type(f"Error on {queue_item.asset_path}")
        test_file = workspace / "test.jpg"
        test_file.write_bytes(b"fake image")
        return test_file

    with (
        patch("sys.stdout.isatty", return_value=False),
        patch.object(
            generate_alt_text,
            "_download_asset",
            side_effect=mock_download_asset,
        ),
        patch.object(generate_alt_text.DisplayManager, "show_error"),
        patch.object(generate_alt_text.DisplayManager, "show_context"),
        patch.object(generate_alt_text.DisplayManager, "show_rule"),
        patch.object(generate_alt_text.DisplayManager, "show_image"),
    ):
        yield


def _maybe_assert_saved_results(
    output_file: Path, expected_count: int
) -> None:
    """Helper to assert saved results match expectations."""
    if expected_count > 0:
        assert output_file.exists()
        with output_file.open("r", encoding="utf-8") as f:
            saved_data = json.load(f)
        assert len(saved_data) == expected_count


def test_label_suggestions_handles_file_errors(
    temp_dir: Path,
    test_suggestions: list[generate_alt_text.AltGenerationResult],
) -> None:
    """Test that individual file errors are handled gracefully and processing continues."""
    output_file = temp_dir / "test_output.json"

    with _setup_error_mocks(FileNotFoundError, "image2.jpg"):
        result_count = generate_alt_text._label_suggestions(
            test_suggestions, Mock(), output_file, append_mode=False
        )

    assert result_count == 1  # Only first item processed successfully
    _maybe_assert_saved_results(output_file, 1)


@pytest.mark.parametrize(
    "error_type, error_on_item, expected_saved_count",
    [
        (KeyboardInterrupt, "image2.jpg", 1),  # Interrupt after first item
        (RuntimeError, "image1.jpg", 0),  # Error before any processing
    ],
)
def test_label_suggestions_saves_on_exceptions(
    temp_dir: Path,
    test_suggestions: list[generate_alt_text.AltGenerationResult],
    error_type,
    error_on_item: str,
    expected_saved_count: int,
) -> None:
    """Test that results are saved when exceptions occur during processing."""
    output_file = temp_dir / "test_output.json"

    with _setup_error_mocks(error_type, error_on_item):
        with pytest.raises(error_type):
            generate_alt_text._label_suggestions(
                test_suggestions, Mock(), output_file, append_mode=False
            )

    _maybe_assert_saved_results(output_file, expected_saved_count)


@pytest.mark.asyncio
async def test_async_generate_suggestions(
    monkeypatch: pytest.MonkeyPatch, temp_dir: Path
) -> None:
    queue_items = [
        scan_for_empty_alt.QueueItem(
            markdown_file="test1.md",
            asset_path="image1.jpg",
            line_number=1,
            context_snippet="context1",
        ),
        scan_for_empty_alt.QueueItem(
            markdown_file="test2.md",
            asset_path="image2.jpg",
            line_number=2,
            context_snippet="context2",
        ),
    ]

    def fake_download_asset(
        queue_item: scan_for_empty_alt.QueueItem, workspace: Path
    ) -> Path:
        asset_filename = Path(queue_item.asset_path).name or "asset"
        target_path = workspace / asset_filename
        target_path.write_bytes(b"data")
        return target_path

    monkeypatch.setattr(
        generate_alt_text,
        "_download_asset",
        fake_download_asset,
    )

    def fake_run_llm(
        attachment: Path, prompt: str, model: str, timeout: int
    ) -> str:
        return f"{attachment.name}-caption"

    monkeypatch.setattr(generate_alt_text, "_run_llm", fake_run_llm)

    def fake_generate_article_context(
        queue_item: scan_for_empty_alt.QueueItem,
        max_before: int | None = None,
        max_after: int = 2,
        trim_frontmatter: bool = False,
    ) -> str:
        return queue_item.context_snippet

    monkeypatch.setattr(
        generate_alt_text,
        "_generate_article_context",
        fake_generate_article_context,
    )

    options = generate_alt_text.GenerateAltTextOptions(
        root=temp_dir,
        model="test-model",
        max_chars=50,
        timeout=10,
        output_path=temp_dir / "captions.json",
        skip_existing=False,
    )

    results = await generate_alt_text._async_generate_suggestions(
        queue_items, options
    )

    assert len(results) == len(queue_items)
    result_asset_paths = {result.asset_path for result in results}
    expected_asset_paths = {item.asset_path for item in queue_items}
    assert result_asset_paths == expected_asset_paths

    expected_suggestions = {
        f"{Path(item.asset_path).name}-caption" for item in queue_items
    }
    actual_suggestions = {result.suggested_alt for result in results}
    assert actual_suggestions == expected_suggestions


def test_label_from_suggestions_file_loads_and_filters_data(
    temp_dir: Path,
) -> None:
    """Test that label_from_suggestions_file loads suggestions and filters extra fields."""
    suggestions_file = temp_dir / "suggestions.json"
    output_file = temp_dir / "output.json"

    suggestions_data = [
        {
            "markdown_file": "test.md",
            "asset_path": "image.jpg",
            "suggested_alt": "Test suggestion",
            "final_alt": "Extra field",  # Should be filtered out
            "model": "test-model",
            "context_snippet": "context",
            "line_number": 10,
        }
    ]

    suggestions_file.write_text(json.dumps(suggestions_data), encoding="utf-8")

    with patch.object(generate_alt_text, "_label_suggestions") as mock_label:
        mock_label.return_value = 1
        generate_alt_text.label_from_suggestions_file(
            suggestions_file, output_file, skip_existing=False
        )

    loaded_suggestions = mock_label.call_args[0][0]
    assert len(loaded_suggestions) == 1
    assert loaded_suggestions[0].asset_path == "image.jpg"
    assert loaded_suggestions[0].line_number == 10
    assert loaded_suggestions[0].final_alt is None


@pytest.mark.parametrize(
    "error,file_content",
    [
        (json.JSONDecodeError, "invalid json"),
        (FileNotFoundError, None),  # File doesn't exist
        (
            KeyError,
            '[{"markdown_file": "test.md"}]',
        ),  # Missing required fields
    ],
)
def test_label_from_suggestions_file_error_handling(
    temp_dir: Path, error: type, file_content: str | None
) -> None:
    """Test error handling for various file and data issues."""
    suggestions_file = temp_dir / "suggestions.json"

    if file_content is not None:
        suggestions_file.write_text(file_content, encoding="utf-8")

    with pytest.raises(error):
        generate_alt_text.label_from_suggestions_file(
            suggestions_file, temp_dir / "output.json", skip_existing=False
        )


@pytest.mark.parametrize("user_input", ["undo", "u", "UNDO"])
def test_prompt_for_edit_undo_command(user_input: str) -> None:
    """prompt_for_edit returns sentinel on various undo inputs."""
    console = Console()
    display = generate_alt_text.DisplayManager(console)

    with patch("builtins.input", return_value=user_input):
        result = display.prompt_for_edit("test suggestion")
        assert result == generate_alt_text.UNDO_REQUESTED


def test_labeling_session() -> None:
    """Test the LabelingSession helper class."""
    suggestions = [create_alt(1), create_alt(2)]

    session = generate_alt_text.LabelingSession(suggestions)

    # Initial state
    assert not session.is_complete()
    assert not session.can_undo()
    assert session.get_progress() == (1, 2)
    assert session.get_current_suggestion() == suggestions[0]

    # Process first item
    result1 = create_alt(1, final_alt="final 1")
    session.add_result(result1)

    # After processing first item
    assert not session.is_complete()
    assert session.can_undo()
    assert session.get_progress() == (2, 2)
    assert session.get_current_suggestion() == suggestions[1]

    # Test undo
    undone = session.undo()
    assert undone == result1
    assert session.get_progress() == (1, 2)
    assert session.get_current_suggestion() == suggestions[0]
    assert not session.can_undo()

    # Process both items
    session.add_result(result1)
    result2 = create_alt(2, final_alt="final 2")
    session.add_result(result2)

    # Complete
    assert session.is_complete()
    assert session.get_current_suggestion() is None
    assert len(session.processed_results) == 2


@pytest.mark.parametrize(
    "sequence,expected_saved",
    [
        # Undo in middle then accept second item
        (
            [
                "accepted 1",
                generate_alt_text.UNDO_REQUESTED,
                "modified 1",
                "accepted 2",
            ],
            ["modified 1", "accepted 2"],
        ),
        # Undo at beginning then accept
        (
            [generate_alt_text.UNDO_REQUESTED, "accepted"],
            ["accepted"],
        ),
    ],
)
def test_label_suggestions_sequences(
    temp_dir: Path, sequence: list[str], expected_saved: list[str]
) -> None:
    """Parametrized test covering various undo/accept sequences."""

    console = Console()
    output_path = temp_dir / "output.json"

    # Build suggestions equal to length of unique images needed (max 3)
    suggestions = [create_alt(i + 1) for i in range(max(3, len(sequence)))]

    call_count = 0

    def mock_process_single_suggestion(
        suggestion_data, display, current=None, total=None
    ):
        nonlocal call_count
        final = (
            sequence[call_count]
            if call_count < len(sequence)
            else "accepted tail"
        )
        call_count += 1
        return create_alt(suggestion_data.line_number, final_alt=final)

    with patch.object(
        generate_alt_text,
        "_process_single_suggestion_for_labeling",
        side_effect=mock_process_single_suggestion,
    ):
        generate_alt_text._label_suggestions(
            suggestions, console, output_path, append_mode=True
        )

    saved = [
        r["final_alt"]
        for r in json.loads(output_path.read_text(encoding="utf-8"))
    ]
    assert saved[: len(expected_saved)] == expected_saved


def test_prefill_after_undo(temp_dir: Path) -> None:
    """Ensure that after an undo, the previous final_alt is used as prefill."""

    console = Console()
    output_path = temp_dir / "output.json"

    suggestions = [create_alt(1), create_alt(2)]

    # Sequence: accept → undo → modify → accept next
    sequence: list[str] = [
        "accepted first",
        generate_alt_text.UNDO_REQUESTED,
        "modified first",
        "accepted second",
    ]

    call_index = 0
    observed_final_alts: list[str | None] = []

    def mock_process_single_suggestion(
        suggestion_data, display, current=None, total=None
    ):
        nonlocal call_index
        # Record the final_alt that arrives as prefill for this prompt
        observed_final_alts.append(suggestion_data.final_alt)

        final = (
            sequence[call_index]
            if call_index < len(sequence)
            else "accepted tail"
        )
        call_index += 1
        return create_alt(suggestion_data.line_number, final_alt=final)

    with patch.object(
        generate_alt_text,
        "_process_single_suggestion_for_labeling",
        side_effect=mock_process_single_suggestion,
    ):
        generate_alt_text._label_suggestions(
            suggestions, console, output_path, append_mode=False
        )

    # First prompt: no prefill; re-prompt after undo: prefilled with prior accepted text
    assert [observed_final_alts[0], observed_final_alts[2]] == [
        None,
        "accepted first",
    ]
