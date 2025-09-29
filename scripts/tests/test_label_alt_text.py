"""Tests for label_alt_text.py module."""

import json
import subprocess
import sys
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import Mock, patch

import pytest
from rich import console
from rich.console import Console

sys.path.append(str(Path(__file__).parent.parent))

from .. import alt_text_utils, label_alt_text, scan_for_empty_alt
from . import utils as test_utils

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def create_alt(
    idx: int, *, final_alt: str | None = None
) -> alt_text_utils.AltGenerationResult:
    """Factory for AltGenerationResult with deterministic dummy fields."""
    return alt_text_utils.AltGenerationResult(
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


@pytest.fixture
def test_suggestions() -> list[alt_text_utils.AltGenerationResult]:
    """Test suggestions for error handling tests."""
    return [
        alt_text_utils.AltGenerationResult(
            markdown_file="test1.md",
            asset_path="image1.jpg",
            suggested_alt="First",
            model="test",
            context_snippet="ctx1",
            line_number=1,
        ),
        alt_text_utils.AltGenerationResult(
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
            alt_text_utils,
            "download_asset",
            side_effect=mock_download_asset,
        ),
        patch.object(label_alt_text.DisplayManager, "show_error"),
        patch.object(label_alt_text.DisplayManager, "show_context"),
        patch.object(label_alt_text.DisplayManager, "show_rule"),
        patch.object(label_alt_text.DisplayManager, "show_image"),
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


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestDisplayManager:
    """Test the DisplayManager class."""

    @pytest.fixture
    def display_manager(self) -> label_alt_text.DisplayManager:
        """Create a DisplayManager with mocked console for testing."""
        richConsole = console.Console(file=Mock())
        return label_alt_text.DisplayManager(richConsole)

    def test_display_manager_creation(self) -> None:
        richConsole = console.Console()
        display = label_alt_text.DisplayManager(richConsole)
        assert display.console is richConsole

    def test_show_context(
        self,
        display_manager: label_alt_text.DisplayManager,
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
        self, display_manager: label_alt_text.DisplayManager, temp_dir: Path
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
        self, display_manager: label_alt_text.DisplayManager, temp_dir: Path
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
        self, display_manager: label_alt_text.DisplayManager, temp_dir: Path
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
        self, display_manager: label_alt_text.DisplayManager, temp_dir: Path
    ) -> None:
        test_image = temp_dir / "test.jpg"
        test_utils.create_test_image(test_image, "100x100")

        with patch.dict("os.environ", {"TMUX": "1"}):
            with pytest.raises(ValueError, match="Cannot open image in tmux"):
                display_manager.show_image(test_image)


def test_label_suggestions_handles_file_errors(
    temp_dir: Path,
    test_suggestions: list[alt_text_utils.AltGenerationResult],
) -> None:
    """Test that individual file errors are handled gracefully and processing continues."""
    output_file = temp_dir / "test_output.json"

    with _setup_error_mocks(FileNotFoundError, "image2.jpg"):
        result_count = label_alt_text.label_suggestions(
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
    test_suggestions: list[alt_text_utils.AltGenerationResult],
    error_type,
    error_on_item: str,
    expected_saved_count: int,
) -> None:
    """Test that results are saved when exceptions occur during processing."""
    output_file = temp_dir / "test_output.json"

    with _setup_error_mocks(error_type, error_on_item):
        with pytest.raises(error_type):
            label_alt_text.label_suggestions(
                test_suggestions, Mock(), output_file, append_mode=False
            )

    _maybe_assert_saved_results(output_file, expected_saved_count)


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

    with patch.object(label_alt_text, "label_suggestions") as mock_label:
        mock_label.return_value = 1
        label_alt_text.label_from_suggestions_file(
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
        label_alt_text.label_from_suggestions_file(
            suggestions_file, temp_dir / "output.json", skip_existing=False
        )


@pytest.mark.parametrize("user_input", ["undo", "u", "UNDO"])
def test_prompt_for_edit_undo_command(user_input: str) -> None:
    """prompt_for_edit returns sentinel on various undo inputs."""
    console = Console()
    display = label_alt_text.DisplayManager(console)

    with patch("builtins.input", return_value=user_input):
        result = display.prompt_for_edit("test suggestion")
        assert result == label_alt_text.UNDO_REQUESTED


def test_labeling_session() -> None:
    """Test the LabelingSession helper class."""
    suggestions = [create_alt(1), create_alt(2)]

    session = label_alt_text.LabelingSession(suggestions)

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
                label_alt_text.UNDO_REQUESTED,
                "modified 1",
                "accepted 2",
            ],
            ["modified 1", "accepted 2"],
        ),
        # Undo at beginning then accept
        (
            [label_alt_text.UNDO_REQUESTED, "accepted"],
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
        label_alt_text,
        "_process_single_suggestion_for_labeling",
        side_effect=mock_process_single_suggestion,
    ):
        label_alt_text.label_suggestions(
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
        label_alt_text.UNDO_REQUESTED,
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
        label_alt_text,
        "_process_single_suggestion_for_labeling",
        side_effect=mock_process_single_suggestion,
    ):
        label_alt_text.label_suggestions(
            suggestions, console, output_path, append_mode=False
        )

    # First prompt: no prefill; re-prompt after undo: prefilled with prior accepted text
    assert [observed_final_alts[0], observed_final_alts[2]] == [
        None,
        "accepted first",
    ]
