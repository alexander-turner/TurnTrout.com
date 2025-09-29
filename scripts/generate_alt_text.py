"""Generate AI alt text suggestions for assets lacking meaningful alt text."""

import asyncio
import shutil
import subprocess
import sys
import tempfile
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from rich.console import Console
from tqdm.rich import tqdm
from tqdm.std import TqdmExperimentalWarning

# Add the project root to sys.path
# pylint: disable=C0413
sys.path.append(str(Path(__file__).parent.parent))

from scripts import alt_text_utils, scan_for_empty_alt
from scripts import utils as script_utils

warnings.filterwarnings("ignore", category=TqdmExperimentalWarning)

# Approximate cost estimates per 1000 tokens (as of Sep 2025)
MODEL_COSTS = {
    # https://www.helicone.ai/llm-cost
    "gemini-2.5-pro": {"input": 0.00125, "output": 0.01},
    "gemini-2.5-flash": {"input": 0.0003, "output": 0.0025},
    "gemini-2.5-flash-lite": {"input": 0.00001, "output": 0.00004},
    # https://developers.googleblog.com/en/continuing-to-bring-you-our-latest-models-with-an-improved-gemini-2-5-flash-and-flash-lite-release/?ref=testingcatalog.com
    "gemini-2.5-flash-lite-preview-09-2025": {
        "input": 0.00001,
        "output": 0.00004,
    },
    "gemini-2.5-flash-preview-09-2025": {"input": 0.00001, "output": 0.00004},
}


def _run_llm(
    attachment: Path,
    prompt: str,
    model: str,
    timeout: int,
) -> str:
    """Execute LLM command and return generated caption."""
    llm_path = script_utils.find_executable("llm")

    result = subprocess.run(
        [llm_path, "-m", model, "-a", str(attachment), "--usage", prompt],
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )

    if result.returncode != 0:
        error_output = result.stderr.strip() or result.stdout.strip()
        raise alt_text_utils.AltGenerationError(
            f"Caption generation failed for {attachment}: {error_output}"
        )

    cleaned = result.stdout.strip()
    if not cleaned:
        raise alt_text_utils.AltGenerationError("LLM returned empty caption")
    return cleaned


@dataclass(slots=True)
class GenerateAltTextOptions:
    """Options for generating alt text."""

    root: Path
    model: str
    max_chars: int
    timeout: int
    output_path: Path
    skip_existing: bool = False


def estimate_cost(
    model: str,
    queue_count: int,
    avg_prompt_tokens: int = 4500,
    avg_output_tokens: int = 1500,
) -> str:
    """Estimate the cost of processing the queue with the given model."""
    # Normalize model name for cost lookup
    model_lower = model.lower()

    if model_lower in MODEL_COSTS:
        cost_info = MODEL_COSTS[model_lower]
    else:
        return f"Can't estimate cost for unknown model: {model}. Available models: {MODEL_COSTS.keys()}"

    # Calculate costs
    input_cost = (avg_prompt_tokens * queue_count / 1000) * cost_info["input"]
    output_cost = (avg_output_tokens * queue_count / 1000) * cost_info[
        "output"
    ]
    total_cost = input_cost + output_cost

    return f"Estimated cost: ${total_cost:.3f} (${input_cost:.3f} input + ${output_cost:.3f} output)"


def filter_existing_captions(
    queue_items: Sequence[scan_for_empty_alt.QueueItem],
    output_paths: Sequence[Path],
    console: Console,
    verbose: bool = True,
) -> list[scan_for_empty_alt.QueueItem]:
    """Filter out items that already have captions in the output paths."""
    existing_captions = set()
    for output_path in output_paths:
        existing_captions.update(
            alt_text_utils.load_existing_captions(output_path)
        )
    original_count = len(queue_items)
    filtered_items = [
        item
        for item in queue_items
        if item.asset_path not in existing_captions
    ]
    skipped_count = original_count - len(filtered_items)
    if skipped_count > 0 and verbose:
        console.print(
            f"[dim]Skipped {skipped_count} items with existing captions[/dim]"
        )
    return filtered_items


# ---------------------------------------------------------------------------
# Async helpers for parallel LLM calls
# ---------------------------------------------------------------------------


_CONCURRENCY_LIMIT = 32


async def _run_llm_async(
    queue_item: scan_for_empty_alt.QueueItem,
    options: GenerateAltTextOptions,
    sem: asyncio.Semaphore,
) -> alt_text_utils.AltGenerationResult:
    """Download asset, run LLM in a thread; clean up; return suggestion
    payload."""
    workspace = Path(tempfile.mkdtemp())
    try:
        async with sem:
            attachment = await asyncio.to_thread(
                alt_text_utils.download_asset, queue_item, workspace
            )
            prompt = alt_text_utils.build_prompt(queue_item, options.max_chars)
            caption = await asyncio.to_thread(
                _run_llm,
                attachment,
                prompt,
                options.model,
                options.timeout,
            )
        return alt_text_utils.AltGenerationResult(
            markdown_file=queue_item.markdown_file,
            asset_path=queue_item.asset_path,
            suggested_alt=caption,
            model=options.model,
            context_snippet=queue_item.context_snippet,
            line_number=queue_item.line_number,
        )
    finally:
        shutil.rmtree(workspace, ignore_errors=True)


async def async_generate_suggestions(
    queue_items: Sequence[scan_for_empty_alt.QueueItem],
    options: GenerateAltTextOptions,
) -> list[alt_text_utils.AltGenerationResult]:
    """Generate suggestions concurrently for *queue_items*."""
    sem = asyncio.Semaphore(_CONCURRENCY_LIMIT)
    tasks: list[asyncio.Task[alt_text_utils.AltGenerationResult]] = []

    for qi in queue_items:
        tasks.append(
            asyncio.create_task(
                _run_llm_async(
                    qi,
                    options,
                    sem,
                )
            )
        )

    task_count = len(tasks)
    if task_count == 0:
        return []

    suggestions: list[alt_text_utils.AltGenerationResult] = []
    with tqdm(total=task_count, desc="Generating alt text") as progress_bar:
        try:
            for finished in asyncio.as_completed(tasks):
                try:
                    result = await finished
                    suggestions.append(result)
                except (
                    alt_text_utils.AltGenerationError,
                    FileNotFoundError,
                ) as err:
                    # Skip individual items that fail (e.g., unsupported file types)
                    progress_bar.write(f"Skipped item due to error: {err}")
                progress_bar.update(1)
        except asyncio.CancelledError:
            progress_bar.set_description(
                "Generating alt text (cancelled, finishing up...)"
            )

    return suggestions
