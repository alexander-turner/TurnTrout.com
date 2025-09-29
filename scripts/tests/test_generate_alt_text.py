"""Tests for generate_alt_text.py module."""

import sys
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

sys.path.append(str(Path(__file__).parent.parent))

from .. import alt_text_utils, generate_alt_text, scan_for_empty_alt


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

    result = generate_alt_text.estimate_cost(
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
    result = generate_alt_text.estimate_cost(model, queue_count)

    # Check format consistency
    assert result.startswith("Estimated cost: $")
    assert " input + $" in result
    assert " output)" in result
    assert result.count("$") == 3  # Total, input, output


def test_estimate_cost_invalid_model() -> None:
    """Test cost estimation with invalid model returns informative message."""
    result = generate_alt_text.estimate_cost("invalid-model", 10)

    assert result.startswith("Can't estimate cost for unknown model")


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
        alt_text_utils,
        "load_existing_captions",
        fake_load_existing_captions,
    )

    console_mock = Mock()
    console_mock.print = Mock()

    filtered = generate_alt_text.filter_existing_captions(
        queue_items,
        [Path("captions.json")],
        console_mock,
    )

    assert len(filtered) == 1
    assert filtered[0].asset_path == "image2.jpg"
    console_mock.print.assert_called_once()


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
            alt_text_utils.AltGenerationError,
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
            alt_text_utils.AltGenerationError,
            match="LLM returned empty caption",
        ):
            generate_alt_text._run_llm(attachment, prompt, model, timeout)


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
        alt_text_utils,
        "download_asset",
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
        alt_text_utils,
        "generate_article_context",
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

    results = await generate_alt_text.async_generate_suggestions(
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
