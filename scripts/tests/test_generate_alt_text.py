"""Tests for generate_alt_text.py module."""

import json
import subprocess
import sys
from dataclasses import asdict
from pathlib import Path
from unittest.mock import Mock, patch

import pytest
import requests
from rich import console

sys.path.append(str(Path(__file__).parent.parent))

from .. import generate_alt_text, scan_for_empty_alt
from . import utils as test_utils


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

    prompt = generate_alt_text._build_prompt(base_queue_item, max_chars)

    for expected in expected_in_prompt:
        assert expected in prompt


@pytest.mark.parametrize(
    "context_snippet, expected",
    [
        ("Single paragraph", "Single paragraph"),
        ("First\n\nSecond", "First\n\nSecond"),
        ("Intro\n\nMiddle\n\nFinal", "Middle\n\nFinal"),
        (
            "  Intro paragraph  \n\n\n\nSecond paragraph\n\nThird paragraph  ",
            "Second paragraph\n\nThird paragraph",
        ),
    ],
)
def test_truncate_context_for_display(
    context_snippet: str, expected: str
) -> None:
    truncated = generate_alt_text._truncate_context_for_display(
        context_snippet
    )

    assert truncated == expected


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

    def _mock_running_process(self) -> Mock:
        """Helper to create a mock running process."""
        mock_process = Mock()
        mock_process.poll.return_value = None  # Process is running
        mock_process.terminate.return_value = None
        mock_process.wait.return_value = None
        return mock_process

    def test_display_manager_creation(self) -> None:
        richConsole = console.Console()
        display = generate_alt_text.DisplayManager(richConsole)
        assert display.console is richConsole

    def test_show_context(
        self,
        display_manager: generate_alt_text.DisplayManager,
        base_queue_item: scan_for_empty_alt.QueueItem,
    ) -> None:
        # Should not raise an exception
        display_manager.show_context(base_queue_item)

    def test_show_image_not_tty(
        self, display_manager: generate_alt_text.DisplayManager, temp_dir: Path
    ) -> None:
        test_image = temp_dir / "test.jpg"
        test_utils.create_test_image(test_image, "100x100")

        with patch("sys.stdout.isatty", return_value=False):
            # Should not raise an exception and should not try to open image
            display_manager.show_image(test_image)

    def test_show_image_success(
        self, display_manager: generate_alt_text.DisplayManager, temp_dir: Path
    ) -> None:
        test_image = temp_dir / "test.jpg"
        test_utils.create_test_image(test_image, "100x100")

        mock_process = self._mock_running_process()
        with (
            patch("sys.stdout.isatty", return_value=True),
            patch("subprocess.Popen", return_value=mock_process) as mock_popen,
        ):
            display_manager.show_image(test_image)

            # Should have attempted to create subprocess to open the image
            mock_popen.assert_called_once()
            call_args = mock_popen.call_args[0][0]  # Get the command list
            assert str(test_image) in call_args

    def test_show_image_subprocess_error(
        self, display_manager: generate_alt_text.DisplayManager, temp_dir: Path
    ) -> None:
        test_image = temp_dir / "test.jpg"
        test_utils.create_test_image(test_image, "100x100")

        with (
            patch("sys.stdout.isatty", return_value=True),
            patch("subprocess.Popen") as mock_popen,
        ):
            mock_popen.side_effect = subprocess.SubprocessError(
                "Failed to start"
            )
            with pytest.raises(ValueError, match="Failed to open image"):
                display_manager.show_image(test_image)

    def test_show_image_file_not_found_error(
        self, display_manager: generate_alt_text.DisplayManager, temp_dir: Path
    ) -> None:
        test_image = temp_dir / "test.jpg"
        test_utils.create_test_image(test_image, "100x100")

        with (
            patch("sys.stdout.isatty", return_value=True),
            patch("subprocess.Popen") as mock_popen,
        ):
            mock_popen.side_effect = OSError("open command not found")
            with pytest.raises(ValueError, match="Failed to open image"):
                display_manager.show_image(test_image)

    def test_show_image_unsupported_platform(
        self, display_manager: generate_alt_text.DisplayManager, temp_dir: Path
    ) -> None:
        test_image = temp_dir / "test.jpg"
        test_utils.create_test_image(test_image, "100x100")

        with (
            patch("sys.stdout.isatty", return_value=True),
            patch("sys.platform", "unsupported_os"),
        ):
            with pytest.raises(ValueError, match="Unsupported platform"):
                display_manager.show_image(test_image)

    def test_close_current_image_no_processes(
        self, display_manager: generate_alt_text.DisplayManager
    ) -> None:
        # Should not raise an exception
        display_manager.close_current_image()

    def test_close_current_image_with_running_process(
        self, display_manager: generate_alt_text.DisplayManager, temp_dir: Path
    ) -> None:
        test_image = temp_dir / "test.jpg"
        test_utils.create_test_image(test_image, "100x100")

        mock_process = self._mock_running_process()

        with (
            patch("sys.stdout.isatty", return_value=True),
            patch("subprocess.Popen", return_value=mock_process),
            patch("subprocess.run"),
        ):
            display_manager.show_image(test_image)
            assert len(display_manager._image_processes) == 1

            display_manager.close_current_image()

            mock_process.terminate.assert_called_once()
            mock_process.wait.assert_called_once_with(timeout=2)
            assert len(display_manager._image_processes) == 0

    def test_close_current_image_force_kill(
        self, display_manager: generate_alt_text.DisplayManager, temp_dir: Path
    ) -> None:
        test_image = temp_dir / "test.jpg"
        test_utils.create_test_image(test_image, "100x100")

        mock_process = Mock()
        mock_process.poll.return_value = None  # Process is running
        mock_process.terminate.return_value = None
        mock_process.wait.side_effect = subprocess.TimeoutExpired("cmd", 2)
        mock_process.kill.return_value = None

        with (
            patch("sys.stdout.isatty", return_value=True),
            patch("subprocess.Popen", return_value=mock_process),
            patch("subprocess.run"),
        ):
            display_manager.show_image(test_image)
            display_manager.close_current_image()

            mock_process.terminate.assert_called_once()
            mock_process.kill.assert_called_once()
            assert len(display_manager._image_processes) == 0

    def test_close_current_image_dead_process(
        self, display_manager: generate_alt_text.DisplayManager, temp_dir: Path
    ) -> None:
        test_image = temp_dir / "test.jpg"
        test_utils.create_test_image(test_image, "100x100")

        mock_process = Mock()
        mock_process.poll.return_value = 0  # Process already terminated
        mock_process.terminate.side_effect = OSError("Process already dead")

        with (
            patch("sys.stdout.isatty", return_value=True),
            patch("subprocess.Popen", return_value=mock_process),
            patch("subprocess.run"),
        ):
            display_manager.show_image(test_image)
            display_manager.close_current_image()

            # Should handle the OSError gracefully
            assert len(display_manager._image_processes) == 0

    def test_close_all_images(
        self, display_manager: generate_alt_text.DisplayManager, temp_dir: Path
    ) -> None:
        test_image1 = temp_dir / "test1.jpg"
        test_utils.create_test_image(test_image1, "100x100")

        test_image2 = temp_dir / "test2.jpg"
        test_utils.create_test_image(test_image2, "100x100")

        mock_process1 = self._mock_running_process()
        mock_process2 = self._mock_running_process()

        with (
            patch("sys.stdout.isatty", return_value=True),
            patch(
                "subprocess.Popen", side_effect=[mock_process1, mock_process2]
            ),
            patch("subprocess.run"),  # Mock the osascript call
        ):
            display_manager.show_image(test_image1)
            display_manager.show_image(test_image2)
            assert len(display_manager._image_processes) == 2

            display_manager.close_all_images()

            # Both processes should be terminated
            mock_process1.terminate.assert_called_once()
            mock_process2.terminate.assert_called_once()
            assert len(display_manager._image_processes) == 0

    def test_image_process_tracking(
        self, display_manager: generate_alt_text.DisplayManager, temp_dir: Path
    ) -> None:
        test_image = temp_dir / "test.jpg"
        test_utils.create_test_image(test_image, "100x100")

        mock_process = self._mock_running_process()

        with (
            patch("sys.stdout.isatty", return_value=True),
            patch("subprocess.Popen", return_value=mock_process),
        ):
            # Initially no processes
            assert len(display_manager._image_processes) == 0

            # Show image should add process
            display_manager.show_image(test_image)
            assert len(display_manager._image_processes) == 1
            assert display_manager._image_processes[0] is mock_process


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
        ),
        generate_alt_text.AltGenerationResult(
            markdown_file="test2.md",
            asset_path="image2.jpg",
            suggested_alt="Second image",
            final_alt="Second image FINAL",
            model="gemini-2.5-flash",
            context_snippet="Second context",
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


class TestGenerateAltTextSkipExisting:
    """Test the generate_alt_text function with skip_existing parameter."""

    @pytest.fixture
    def mock_dependencies(self):
        """Mock external dependencies for batch_generate_alt_text testing."""
        with (
            patch.object(
                generate_alt_text.scan_for_empty_alt, "build_queue"
            ) as mock_build_queue,
            patch.object(
                generate_alt_text,
                "_async_generate_suggestions",
                return_value=[],
            ) as mock_async_generate,
            patch.object(
                generate_alt_text, "_write_output"
            ) as mock_write_output,
            patch.object(
                generate_alt_text,
                "_estimate_cost",
                return_value="Test cost: $0.000",
            ),
            patch("builtins.input", return_value=""),
            patch("atexit.register"),
            patch.object(
                generate_alt_text, "_label_suggestions", return_value=[]
            ),
        ):
            yield {
                "build_queue": mock_build_queue,
                "async_generate": mock_async_generate,
                "write_output": mock_write_output,
            }

    def _create_queue_items(self, *asset_paths: str) -> list:
        """Helper to create test queue items."""
        return [
            scan_for_empty_alt.QueueItem(
                markdown_file=f"test{i}.md",
                asset_path=path,
                line_number=1,
                context_snippet=f"context{i}",
            )
            for i, path in enumerate(asset_paths, 1)
        ]

    def _create_captions_file(
        self, temp_dir: Path, captions: dict[str, str]
    ) -> Path:
        """Helper to create a captions file."""
        captions_file = temp_dir / "captions.json"
        captions_data = [
            {"asset_path": path, "suggested_alt": alt}
            for path, alt in captions.items()
        ]
        captions_file.write_text(json.dumps(captions_data), encoding="utf-8")
        return captions_file

    @pytest.fixture
    def base_options(
        self, temp_dir: Path
    ) -> generate_alt_text.GenerateAltTextOptions:
        """Base options for generate_alt_text testing."""
        return generate_alt_text.GenerateAltTextOptions(
            root=temp_dir,
            model="test-model",
            max_chars=100,
            timeout=60,
            output_path=temp_dir / "captions.json",
            skip_existing=False,
        )

    def _create_options(
        self,
        base_options: generate_alt_text.GenerateAltTextOptions,
        **overrides,
    ) -> generate_alt_text.GenerateAltTextOptions:
        """Helper to create options with overrides."""
        return generate_alt_text.GenerateAltTextOptions(
            **{**asdict(base_options), **overrides}
        )

    def _run_generate_alt_text(
        self,
        options: generate_alt_text.GenerateAltTextOptions,
        queue_items: list,
        mock_dependencies,
    ):
        """Helper to run generate_alt_text with options."""
        mock_dependencies["build_queue"].return_value = queue_items
        generate_alt_text.batch_generate_alt_text(options)

    def test_skip_existing_false_processes_all_items(
        self,
        base_options: generate_alt_text.GenerateAltTextOptions,
        mock_dependencies,
    ) -> None:
        """Test skip_existing=False processes all items regardless of existing captions."""
        queue_items = self._create_queue_items("image1.jpg", "image2.jpg")
        captions_file = self._create_captions_file(
            base_options.root, {"image1.jpg": "Existing"}
        )
        options = self._create_options(
            base_options,
            output_path=captions_file,
            skip_existing=False,
        )

        self._run_generate_alt_text(options, queue_items, mock_dependencies)
        mock_dependencies["async_generate"].assert_called_once()
        processed_items = mock_dependencies["async_generate"].call_args[0][0]
        assert len(processed_items) == 2

    def test_skip_existing_true_filters_existing_items(
        self,
        base_options: generate_alt_text.GenerateAltTextOptions,
        mock_dependencies,
    ) -> None:
        """Test skip_existing=True filters out items that already have captions."""
        queue_items = self._create_queue_items("image1.jpg", "image2.jpg")
        captions_file = self._create_captions_file(
            base_options.root, {"image1.jpg": "Existing"}
        )
        options = self._create_options(
            base_options,
            output_path=captions_file,
            skip_existing=True,
        )

        self._run_generate_alt_text(options, queue_items, mock_dependencies)
        mock_dependencies["async_generate"].assert_called_once()
        processed_items = mock_dependencies["async_generate"].call_args[0][0]
        assert len(processed_items) == 1

    def test_skip_existing_no_captions_file_processes_all(
        self,
        base_options: generate_alt_text.GenerateAltTextOptions,
        mock_dependencies,
    ) -> None:
        """Test skip_existing=True processes all items when no captions file exists."""
        queue_items = self._create_queue_items("image1.jpg")
        options = self._create_options(base_options, skip_existing=True)

        self._run_generate_alt_text(options, queue_items, mock_dependencies)
        mock_dependencies["async_generate"].assert_called_once()
        processed_items = mock_dependencies["async_generate"].call_args[0][0]
        assert len(processed_items) == 1

    def test_skip_existing_all_items_filtered(
        self,
        base_options: generate_alt_text.GenerateAltTextOptions,
        mock_dependencies,
    ) -> None:
        """Test skip_existing=True processes no items when all exist in captions."""
        queue_items = self._create_queue_items("image1.jpg", "image2.jpg")
        captions_file = self._create_captions_file(
            base_options.root, {"image1.jpg": "Alt 1", "image2.jpg": "Alt 2"}
        )
        options = self._create_options(
            base_options,
            output_path=captions_file,
            skip_existing=True,
        )

        self._run_generate_alt_text(options, queue_items, mock_dependencies)
        mock_dependencies["async_generate"].assert_not_called()

    def test_skip_existing_filters_correct_item(
        self,
        base_options: generate_alt_text.GenerateAltTextOptions,
        mock_dependencies,
    ) -> None:
        """Test that skip_existing filters the correct items."""
        queue_items = self._create_queue_items("image1.jpg", "image2.jpg")
        captions_file = self._create_captions_file(
            base_options.root, {"image1.jpg": "Existing"}
        )

        options = self._create_options(
            base_options, output_path=captions_file, skip_existing=True
        )

        self._run_generate_alt_text(options, queue_items, mock_dependencies)

        # Should only process image2.jpg
        mock_dependencies["async_generate"].assert_called_once()
        processed_items = mock_dependencies["async_generate"].call_args[0][0]
        assert len(processed_items) == 1
        assert processed_items[0].asset_path == "image2.jpg"


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


class TestLoadLearningExamples:
    """Test the _load_learning_examples function."""

    @pytest.mark.parametrize(
        "captions_data, expected_count, max_examples",
        [
            # Empty file
            ([], 0, 5),
            # No examples with different suggested/final alt
            (
                [
                    {
                        "suggested_alt": "Same text",
                        "final_alt": "Same text",
                        "context_snippet": "context",
                    }
                ],
                0,
                5,
            ),
            # One example with different alt text
            (
                [
                    {
                        "suggested_alt": "Initial suggestion",
                        "final_alt": "Final version",
                        "context_snippet": "test context",
                    }
                ],
                1,
                5,
            ),
            # Multiple examples, limited by max_examples
            (
                [
                    {
                        "suggested_alt": f"Suggestion {i}",
                        "final_alt": f"Final {i}",
                        "context_snippet": f"context {i}",
                    }
                    for i in range(10)
                ],
                3,
                3,
            ),
        ],
    )
    def test_load_learning_examples_valid_file(
        self,
        temp_dir: Path,
        captions_data: list,
        expected_count: int,
        max_examples: int,
    ) -> None:
        """Test loading learning examples from valid JSON file."""
        captions_file = temp_dir / "captions.json"
        captions_file.write_text(json.dumps(captions_data), encoding="utf-8")

        result = generate_alt_text._load_learning_examples(
            captions_file, max_examples=max_examples
        )
        assert len(result) == expected_count

    def test_load_learning_examples_nonexistent_file(
        self, temp_dir: Path
    ) -> None:
        """Test loading examples from non-existent file returns empty list."""
        nonexistent_file = temp_dir / "nonexistent.json"
        result = generate_alt_text._load_learning_examples(nonexistent_file)
        assert result == []

    def test_load_learning_examples_invalid_json(self, temp_dir: Path) -> None:
        """Test loading examples from invalid JSON file returns empty list."""
        invalid_file = temp_dir / "invalid.json"
        invalid_file.write_text("{ invalid json", encoding="utf-8")

        result = generate_alt_text._load_learning_examples(invalid_file)
        assert result == []

    def test_load_learning_examples_content_structure(
        self, temp_dir: Path
    ) -> None:
        """Test that loaded examples have the correct structure."""
        captions_data = [
            {
                "suggested_alt": "Initial suggestion",
                "final_alt": "Improved final version",
                "markdown_file": "test.md",
                "asset_path": "image.jpg",
            }
        ]
        captions_file = temp_dir / "captions.json"
        captions_file.write_text(json.dumps(captions_data), encoding="utf-8")

        result = generate_alt_text._load_learning_examples(captions_file)
        assert len(result) == 1
        assert result[0]["suggested_alt"] == "Initial suggestion"
        assert result[0]["final_alt"] == "Improved final version"


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
