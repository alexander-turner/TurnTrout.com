"""Tests for generate_alt_text.py module."""

import json
import subprocess
import sys
from dataclasses import asdict
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

import pytest
import requests
from rich import console

sys.path.append(str(Path(__file__).parent.parent))

from .. import generate_alt_text, scan_for_empty_alt
from . import utils as test_utils


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
    assert generate_alt_text._is_url(path) is expected


def test_build_prompt() -> None:
    """Test prompt building function."""
    queue_item = scan_for_empty_alt.QueueItem(
        markdown_file="test.md",
        asset_path="image.jpg",
        line_number=5,
        context_snippet="This is a test image context.",
    )
    max_chars = 150

    prompt = generate_alt_text._build_prompt(queue_item, max_chars)

    assert "test.md" in prompt
    assert "This is a test image context." in prompt
    assert str(max_chars) in prompt
    assert "Under 150 characters" in prompt
    assert "Return only the alt text" in prompt


def test_build_prompt_respects_max_chars() -> None:
    long_context = "x" * 1000
    queue_item = scan_for_empty_alt.QueueItem(
        markdown_file="test.md",
        asset_path="image.jpg",
        line_number=5,
        context_snippet=long_context,  # Very long context
    )

    prompt_150 = generate_alt_text._build_prompt(queue_item, 150)
    prompt_50 = generate_alt_text._build_prompt(queue_item, 50)

    assert "Under 150 characters" in prompt_150
    assert "Under 50 characters" in prompt_50
    # Both should contain the long context
    assert long_context in prompt_150
    assert long_context in prompt_50


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
    markdown_file: str,
    context_snippet: str,
    max_chars: int,
    expected_in_prompt: list[str],
) -> None:
    queue_item = scan_for_empty_alt.QueueItem(
        markdown_file=markdown_file,
        asset_path="image.jpg",
        line_number=1,
        context_snippet=context_snippet,
    )
    prompt = generate_alt_text._build_prompt(queue_item, max_chars)

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
    """Test cost estimation with invalid model raises ValueError."""
    with pytest.raises(ValueError, match="Unknown model"):
        generate_alt_text._estimate_cost("invalid-model", 10)


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


class TestDownloadAsset:
    """Test the asset download function."""

    def test_local_file_exists_non_avif(self, temp_dir: Path) -> None:
        """Test downloading local non-AVIF file."""
        test_file = temp_dir / "image.jpg"
        test_file.write_bytes(b"fake image data")

        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(temp_dir / "test.md"),
            asset_path="image.jpg",
            line_number=1,
            context_snippet="test context",
        )

        with TemporaryDirectory() as workspace_str:
            workspace = Path(workspace_str)
            result = generate_alt_text._download_asset(queue_item, workspace)

            # Should return the original file since it's not AVIF
            assert result == test_file.resolve()

    def test_local_file_exists_avif(self, temp_dir: Path) -> None:
        """Test downloading local AVIF file gets converted."""
        avif_file = temp_dir / "image.avif"
        test_utils.create_test_image(avif_file, "100x100")

        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(temp_dir / "test.md"),
            asset_path="image.avif",
            line_number=1,
            context_snippet="test context",
        )

        with TemporaryDirectory() as workspace_str:
            workspace = Path(workspace_str)
            with patch("subprocess.run") as mock_run:
                mock_run.return_value = None
                result = generate_alt_text._download_asset(
                    queue_item, workspace
                )

                assert result.suffix == ".png"
                assert result.parent == workspace

    def test_url_download_success(self, temp_dir: Path) -> None:
        """Test successful URL download."""
        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(temp_dir / "test.md"),
            asset_path="https://example.com/image.jpg",
            line_number=1,
            context_snippet="test context",
        )

        mock_response = Mock()
        mock_response.iter_content.return_value = [b"fake", b"image", b"data"]
        mock_response.raise_for_status.return_value = None

        with (
            TemporaryDirectory() as workspace_str,
            patch("requests.get", return_value=mock_response) as mock_get,
        ):
            workspace = Path(workspace_str)
            result = generate_alt_text._download_asset(queue_item, workspace)

            mock_get.assert_called_once()
            call_kwargs = mock_get.call_args[1]
            assert "User-Agent" in call_kwargs["headers"]
            assert "timeout" in call_kwargs
            assert "stream" in call_kwargs

            assert result.parent == workspace
            assert result.name.startswith("asset")

    def test_url_download_avif_conversion(self, temp_dir: Path) -> None:
        """Test URL download of AVIF file with conversion."""
        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(temp_dir / "test.md"),
            asset_path="https://example.com/image.avif",
            line_number=1,
            context_snippet="test context",
        )

        mock_response = Mock()
        mock_response.iter_content.return_value = [b"fake", b"avif", b"data"]
        mock_response.raise_for_status.return_value = None

        with TemporaryDirectory() as workspace_str:
            workspace = Path(workspace_str)
            with patch("requests.get", return_value=mock_response):
                with patch("subprocess.run") as mock_run:
                    mock_run.return_value = None
                    result = generate_alt_text._download_asset(
                        queue_item, workspace
                    )

                    # Should have converted to PNG
                    assert result.suffix == ".png"
                    mock_run.assert_called_once()

    def test_file_not_found(self, temp_dir: Path) -> None:
        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(temp_dir / "test.md"),
            asset_path="nonexistent.jpg",
            line_number=1,
            context_snippet="test context",
        )

        with TemporaryDirectory() as workspace_str:
            workspace = Path(workspace_str)
            with pytest.raises(
                FileNotFoundError, match="Unable to locate asset"
            ):
                generate_alt_text._download_asset(queue_item, workspace)

    def test_url_download_http_error(self, temp_dir: Path) -> None:
        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(temp_dir / "test.md"),
            asset_path="https://turntrout.com/error.jpg",
            line_number=1,
            context_snippet="test context",
        )

        mock_response = Mock()
        mock_response.raise_for_status.side_effect = requests.HTTPError(
            "404 Not Found"
        )

        with (
            TemporaryDirectory() as workspace_str,
            patch("requests.get", return_value=mock_response),
            pytest.raises(requests.HTTPError),
        ):
            generate_alt_text._download_asset(queue_item, Path(workspace_str))

    @pytest.mark.parametrize(
        "exception_type, exception_args",
        [
            (requests.Timeout, ("Request timed out",)),
            (requests.ConnectionError, ("Connection failed",)),
            (requests.RequestException, ("Network error",)),
        ],
    )
    def test_url_download_request_errors(
        self, temp_dir: Path, exception_type, exception_args
    ) -> None:
        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(temp_dir / "test.md"),
            asset_path="https://turntrout.com/error.jpg",
            line_number=1,
            context_snippet="test context",
        )

        with (
            TemporaryDirectory() as workspace_str,
            patch("requests.get") as mock_get,
            pytest.raises(exception_type),
        ):
            mock_get.side_effect = exception_type(*exception_args)
            generate_alt_text._download_asset(queue_item, Path(workspace_str))

    def test_url_download_partial_content(self, temp_dir: Path) -> None:
        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file=str(temp_dir / "test.md"),
            asset_path="https://example.com/partial.jpg",
            line_number=1,
            context_snippet="test context",
        )

        mock_response = Mock()
        mock_response.iter_content.return_value = [
            b"partial"
        ]  # Incomplete data
        mock_response.raise_for_status.return_value = None

        with (
            TemporaryDirectory() as workspace_str,
            patch("requests.get", return_value=mock_response),
        ):
            result = generate_alt_text._download_asset(
                queue_item, Path(workspace_str)
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
        self, display_manager: generate_alt_text.DisplayManager
    ) -> None:
        queue_item = scan_for_empty_alt.QueueItem(
            markdown_file="test.md",
            asset_path="image.jpg",
            line_number=5,
            context_snippet="Test context snippet",
        )

        # Should not raise an exception
        display_manager.show_context(queue_item)

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


class TestAltGenerationResult:
    """Test the AltGenerationResult dataclass."""

    def test_to_json(self) -> None:
        """Test converting result to JSON."""
        result = generate_alt_text.AltGenerationResult(
            markdown_file="test.md",
            asset_path="image.jpg",
            suggested_alt="A test image",
            final_alt="A test image",
            model="gemini-2.5-flash",
            context_snippet="Test context",
        )

        json_data = result.to_json()

        assert json_data["markdown_file"] == "test.md"
        assert json_data["asset_path"] == "image.jpg"
        assert json_data["suggested_alt"] == "A test image"
        assert json_data["model"] == "gemini-2.5-flash"
        assert json_data["context_snippet"] == "Test context"


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
        """Mock external dependencies for generate_alt_text testing."""
        with (
            patch.object(
                generate_alt_text.scan_for_empty_alt, "build_queue"
            ) as mock_build_queue,
            patch.object(
                generate_alt_text, "_process_queue_item"
            ) as mock_process_item,
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
        ):
            yield {
                "build_queue": mock_build_queue,
                "process_item": mock_process_item,
                "write_output": mock_write_output,
            }

    @pytest.fixture
    def sample_queue_items(self) -> list[scan_for_empty_alt.QueueItem]:
        """Sample queue items for testing."""
        return [
            scan_for_empty_alt.QueueItem(
                markdown_file="test1.md",
                asset_path="image1.jpg",
                line_number=1,
                context_snippet="context1",
            ),
            scan_for_empty_alt.QueueItem(
                markdown_file="test2.md",
                asset_path="image2.jpg",
                line_number=1,
                context_snippet="context2",
            ),
        ]

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

    @pytest.fixture
    def sample_captions(self, temp_dir: Path) -> dict[str, Path]:
        """Sample captions files for testing."""

        def create_captions_file(captions: dict[str, str]) -> Path:
            captions_file = temp_dir / "captions.json"
            captions_data = [
                {"asset_path": path, "suggested_alt": alt}
                for path, alt in captions.items()
            ]
            captions_file.write_text(
                json.dumps(captions_data), encoding="utf-8"
            )
            return captions_file

        return {
            "single": create_captions_file({"image1.jpg": "Existing"}),
            "multiple": create_captions_file(
                {"image1.jpg": "Alt 1", "image2.jpg": "Alt 2"}
            ),
            "empty": create_captions_file({}),
        }

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
        generate_alt_text.generate_alt_text(options)

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
        assert mock_dependencies["process_item"].call_count == 2

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
        assert mock_dependencies["process_item"].call_count == 1

    def test_skip_existing_no_captions_file_processes_all(
        self,
        base_options: generate_alt_text.GenerateAltTextOptions,
        mock_dependencies,
    ) -> None:
        """Test skip_existing=True processes all items when no captions file exists."""
        queue_items = self._create_queue_items("image1.jpg")
        options = self._create_options(base_options, skip_existing=True)

        self._run_generate_alt_text(options, queue_items, mock_dependencies)
        assert mock_dependencies["process_item"].call_count == 1

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
        assert mock_dependencies["process_item"].call_count == 0

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
        assert mock_dependencies["process_item"].call_count == 1
        processed_item = mock_dependencies["process_item"].call_args[1][
            "queue_item"
        ]
        assert processed_item.asset_path == "image2.jpg"


class TestSkipExistingCLI:
    """Test CLI argument parsing for --skip-existing."""

    @pytest.mark.parametrize(
        "args, expected_skip_existing",
        [
            (["generate_alt_text.py", "--model", "test-model"], False),
            (
                [
                    "generate_alt_text.py",
                    "--model",
                    "test-model",
                    "--skip-existing",
                ],
                True,
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
