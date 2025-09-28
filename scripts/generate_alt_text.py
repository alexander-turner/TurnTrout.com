"""Generate AI alt text suggestions for assets lacking meaningful alt text."""

import argparse
import asyncio
import json
import os
import readline
import shutil
import subprocess
import sys
import tempfile
import textwrap
import warnings
from dataclasses import asdict, dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Iterable, Sequence
from urllib.parse import urlparse

import requests
from rich.box import ROUNDED
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from tqdm.rich import tqdm
from tqdm.std import TqdmExperimentalWarning

# Add the project root to sys.path
# pylint: disable=C0413
sys.path.append(str(Path(__file__).parent.parent))

from scripts import scan_for_empty_alt
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


@dataclass(slots=True)
class AltGenerationResult:
    """Container for AI-generated alt text suggestions."""

    markdown_file: str
    asset_path: str
    suggested_alt: str
    final_alt: str
    model: str
    context_snippet: str

    def to_json(self) -> dict[str, object]:
        """Convert to JSON-serializable dict."""
        return asdict(self)


class AltGenerationError(Exception):
    """Raised when caption generation fails."""


def _convert_avif_to_png(asset_path: Path, workspace: Path) -> Path:
    """Convert AVIF images to PNG format for LLM compatibility."""
    if asset_path.suffix.lower() != ".avif":
        return asset_path

    png_target = workspace / f"{asset_path.stem}.png"
    magick_executable = script_utils.find_executable("magick")

    try:
        subprocess.run(
            [magick_executable, str(asset_path), str(png_target)],
            check=True,
            capture_output=True,
            text=True,
        )
        return png_target
    except subprocess.CalledProcessError as err:
        raise AltGenerationError(
            f"Failed to convert AVIF to PNG: {err.stderr or err.stdout}"
        ) from err


def _convert_gif_to_mp4(asset_path: Path, workspace: Path) -> Path:
    """Convert GIF files to MP4 format for LLM compatibility."""
    if asset_path.suffix.lower() != ".gif":
        raise ValueError(f"Unsupported file type '{asset_path.suffix}'.")

    mp4_target = workspace / f"{asset_path.stem}.mp4"
    ffmpeg_executable = script_utils.find_executable("ffmpeg")

    try:
        subprocess.run(
            [
                ffmpeg_executable,
                "-i",
                str(asset_path),
                "-vf",
                "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                "-y",
                str(mp4_target),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return mp4_target
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as err:
        raise AltGenerationError(
            f"Failed to convert GIF to MP4: {err}"
        ) from err


def _convert_asset_for_llm(asset_path: Path, workspace: Path) -> Path:
    """Converts asset to a format compatible with the LLM if needed."""
    if asset_path.suffix.lower() == ".avif":
        return _convert_avif_to_png(asset_path, workspace)
    if asset_path.suffix.lower() == ".gif":
        return _convert_gif_to_mp4(asset_path, workspace)
    return asset_path


def _download_asset(
    queue_item: scan_for_empty_alt.QueueItem, workspace: Path
) -> Path:
    """Download or locate asset file, returning path to accessible copy."""
    asset_path = queue_item.asset_path

    if script_utils.is_url(asset_path):
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/91.0.4472.124 Safari/537.36"
            )
        }
        response = requests.get(
            asset_path, timeout=20, stream=True, headers=headers
        )
        response.raise_for_status()
        suffix = Path(urlparse(asset_path).path).suffix or ".bin"
        target = workspace / f"asset{suffix}"
        with target.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=8192):
                handle.write(chunk)
        return _convert_asset_for_llm(target, workspace)

    # Try relative to markdown file first
    markdown_path = Path(queue_item.markdown_file)
    candidate = markdown_path.parent / asset_path
    if candidate.exists():
        return _convert_asset_for_llm(candidate.resolve(), workspace)

    # Try relative to git root
    git_root = script_utils.get_git_root()
    alternative = git_root / asset_path.lstrip("/")
    if alternative.exists():
        return _convert_asset_for_llm(alternative.resolve(), workspace)

    raise FileNotFoundError(
        f"Unable to locate asset '{asset_path}' referenced in {queue_item.markdown_file}"
    )


def _generate_article_context(
    queue_item: scan_for_empty_alt.QueueItem,
    max_before: int | None = None,
    max_after: int = 2,
) -> str:
    """Generate context with all preceding paragraphs and 2 after for LLM
    prompts."""
    markdown_path = Path(queue_item.markdown_file)
    source_text = markdown_path.read_text(encoding="utf-8")

    # Try to split YAML frontmatter and get content only
    _, split_content = script_utils.split_yaml(markdown_path, verbose=False)

    lines_to_show = source_lines = source_text.splitlines()
    # If no frontmatter found, split_yaml returns empty split_content, so use original
    if not split_content.strip():
        adjusted_line_number = queue_item.line_number - 1
    else:
        lines_to_show = split_content.splitlines()
        num_frontmatter_lines = len(source_lines) - len(lines_to_show)
        adjusted_line_number = (
            queue_item.line_number - 1 - num_frontmatter_lines
        )

    return script_utils.paragraph_context(
        lines_to_show,
        adjusted_line_number,
        max_before=max_before,
        max_after=max_after,
    )


def _build_prompt(
    queue_item: scan_for_empty_alt.QueueItem,
    max_chars: int,
) -> str:
    """Build prompt for LLM caption generation."""
    base_prompt = textwrap.dedent(
        """
        Generate concise alt text for accessibility and SEO. 
        Describe the intended information of the image clearly and accurately.
        """
    ).strip()

    # TODO add an "IMAGE HERE" marker?
    article_context = _generate_article_context(queue_item)
    main_prompt = textwrap.dedent(
        f"""
        Context from {queue_item.markdown_file}:
        {article_context}

        Critical requirements:
        - Under {max_chars} characters (aim for 1-2 sentences when possible)
        - Do not include redundant information (e.g. "image of", "picture of", "diagram illustrating", "a diagram of")
        - Return only the alt text, no quotes
        - For text-heavy images: transcribe key text content, then describe visual elements
        - Don't reintroduce acronyms
        - Describe spatial relationships and visual hierarchy when important

        Prioritize completeness over brevity - include both textual content and visual description as needed. 
        While thinking quietly, propose a candidate alt text. Then critique the candidate alt text—
        does it accurately describe the information the image is meant to convey? 
        Incorporate the critique into the alt text to improve it. Only output the improved alt text.
        """
    ).strip()

    return f"{base_prompt}\n{main_prompt}"


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
        raise AltGenerationError(
            f"Caption generation failed for {attachment}: {error_output}"
        )

    cleaned = result.stdout.strip()
    if not cleaned:
        raise AltGenerationError("LLM returned empty caption")
    return cleaned


class DisplayManager:
    """Handles rich console display operations."""

    def __init__(self, console: Console) -> None:
        self.console = console

    def show_context(self, queue_item: scan_for_empty_alt.QueueItem) -> None:
        """Display context information for the queue item."""
        context = _generate_article_context(
            queue_item, max_before=4, max_after=1
        )
        rendered_context = Markdown(context)
        basename = Path(queue_item.markdown_file).name
        self.console.print(
            Panel(
                rendered_context,
                title="Context",
                subtitle=f"{basename}:{queue_item.line_number}",
                box=ROUNDED,
            )
        )

    def show_image(self, path: Path) -> None:
        """Display the image using imgcat."""
        if "TMUX" in os.environ:
            raise ValueError("Cannot open image in tmux")
        try:
            subprocess.run(["imgcat", str(path)], check=True)
        except subprocess.CalledProcessError as err:
            raise ValueError(
                f"Failed to open image: {err}; is imgcat installed?"
            ) from err

    def show_progress(self, current: int, total: int) -> None:
        """Display progress information."""
        progress_text = (
            f"Progress: {current}/{total} ({current/total*100:.1f}%)"
        )
        self.console.print(f"[dim]{progress_text}[/dim]")

    def prompt_for_edit(
        self,
        suggestion: str,
        current: int | None = None,
        total: int | None = None,
    ) -> str:
        """Prompt user to edit the suggestion with prefilled editable text."""
        # Show progress if provided
        if current is not None and total is not None:
            self.show_progress(current, total)

        # Enable vim keybindings for readline
        readline.parse_and_bind("set editing-mode vi")
        readline.set_startup_hook(lambda: readline.insert_text(suggestion))
        self.console.print(
            "\n[bold blue]Edit alt text (or press Enter to accept):[/bold blue]"
        )
        result = input("> ")
        readline.set_startup_hook(None)
        return result if result.strip() else suggestion

    def show_rule(self, title: str) -> None:
        """Display a separator rule."""
        self.console.rule(title)

    def show_error(self, error_message: str) -> None:
        """Display error message."""
        self.console.print(
            Panel(
                error_message,
                title="Alt generation error",
                box=ROUNDED,
                style="red",
            )
        )


@dataclass(slots=True)
class GenerateAltTextOptions:
    """Options for generating alt text."""

    root: Path
    model: str
    max_chars: int
    timeout: int
    output_path: Path
    skip_existing: bool = False


def _process_queue_item(
    queue_item: scan_for_empty_alt.QueueItem,
    display: DisplayManager,
    options: GenerateAltTextOptions,
) -> AltGenerationResult:
    """Process a single queue item and generate alt text."""
    with TemporaryDirectory() as temp_dir:
        workspace = Path(temp_dir)
        attachment = _download_asset(queue_item, workspace)

        prompt = _build_prompt(
            queue_item,
            max_chars=options.max_chars,
        )
        suggestion = _run_llm(
            attachment, prompt, model=options.model, timeout=options.timeout
        )

        # Display results
        display.show_rule(queue_item.asset_path)
        display.show_context(queue_item)
        display.show_image(attachment)

        # Allow user to edit the suggestion
        final_alt = suggestion
        if sys.stdout.isatty():
            final_alt = display.prompt_for_edit(suggestion)

        return AltGenerationResult(
            markdown_file=queue_item.markdown_file,
            asset_path=queue_item.asset_path,
            suggested_alt=suggestion,
            final_alt=final_alt,
            model=options.model,
            context_snippet=queue_item.context_snippet,
        )


def _estimate_cost(
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


def _load_existing_captions(captions_path: Path) -> set[str]:
    """Load existing asset paths from captions file."""
    try:
        with open(captions_path, encoding="utf-8") as f:
            data = json.load(f)
        return {item["asset_path"] for item in data if "asset_path" in item}
    except (FileNotFoundError, json.JSONDecodeError, KeyError, TypeError):
        return set()


def _filter_existing_captions(
    queue_items: Sequence[scan_for_empty_alt.QueueItem],
    output_paths: Sequence[Path],
    console: Console,
    verbose: bool = True,
) -> list[scan_for_empty_alt.QueueItem]:
    """Filter out items that already have captions in the output paths."""
    existing_captions = set()
    for output_path in output_paths:
        existing_captions.update(_load_existing_captions(output_path))
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


@dataclass(slots=True)
class AltTextResult:  # pylint: disable=C0115
    markdown_file: str
    asset_path: str
    suggested_alt: str
    model: str
    context_snippet: str
    line_number: int


async def _run_llm_async(
    queue_item: scan_for_empty_alt.QueueItem,
    options: GenerateAltTextOptions,
    sem: asyncio.Semaphore,
) -> AltTextResult:
    """Download asset, run LLM in a thread; clean up; return suggestion
    payload."""
    workspace = Path(tempfile.mkdtemp())
    try:
        async with sem:
            attachment = await asyncio.to_thread(
                _download_asset, queue_item, workspace
            )
            prompt = _build_prompt(queue_item, options.max_chars)
            caption = await asyncio.to_thread(
                _run_llm,
                attachment,
                prompt,
                options.model,
                options.timeout,
            )
        return AltTextResult(
            markdown_file=queue_item.markdown_file,
            asset_path=queue_item.asset_path,
            suggested_alt=caption,
            model=options.model,
            context_snippet=queue_item.context_snippet,
            line_number=queue_item.line_number,
        )
    finally:
        shutil.rmtree(workspace, ignore_errors=True)


async def _async_generate_suggestions(
    queue_items: Sequence[scan_for_empty_alt.QueueItem],
    options: GenerateAltTextOptions,
) -> list[AltTextResult]:
    """Generate suggestions concurrently for *queue_items*."""
    sem = asyncio.Semaphore(_CONCURRENCY_LIMIT)
    tasks: list[asyncio.Task[AltTextResult]] = []

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

    suggestions: list[AltTextResult] = []
    with tqdm(total=task_count, desc="Generating alt text") as progress_bar:
        try:
            for finished in asyncio.as_completed(tasks):
                try:
                    result = await finished
                    suggestions.append(result)
                except (
                    AltGenerationError,
                    FileNotFoundError,
                    requests.RequestException,
                ) as err:
                    # Skip individual items that fail (e.g., unsupported file types)
                    progress_bar.write(f"Skipped item due to error: {err}")
                progress_bar.update(1)
        except asyncio.CancelledError:
            progress_bar.set_description(
                "Generating alt text (cancelled, finishing up...)"
            )

    return suggestions


def _process_single_suggestion_for_labeling(
    suggestion_data: AltTextResult,
    display: DisplayManager,
    current: int | None = None,
    total: int | None = None,
) -> AltGenerationResult:
    # Recreate queue item for display
    queue_item = scan_for_empty_alt.QueueItem(
        markdown_file=suggestion_data.markdown_file,
        asset_path=suggestion_data.asset_path,
        line_number=suggestion_data.line_number,
        context_snippet=suggestion_data.context_snippet,
    )

    # Download asset for display
    with TemporaryDirectory() as temp_dir:
        workspace = Path(temp_dir)
        attachment = _download_asset(queue_item, workspace)

        # Display results
        display.show_rule(queue_item.asset_path)
        display.show_context(queue_item)
        display.show_image(attachment)

        # Allow user to edit the suggestion
        final_alt = suggestion_data.suggested_alt
        if sys.stdout.isatty():
            final_alt = display.prompt_for_edit(
                suggestion_data.suggested_alt, current, total
            )

        return AltGenerationResult(
            markdown_file=suggestion_data.markdown_file,
            asset_path=suggestion_data.asset_path,
            suggested_alt=suggestion_data.suggested_alt,
            final_alt=final_alt,
            model=suggestion_data.model,
            context_snippet=suggestion_data.context_snippet,
        )


def _label_suggestions(
    suggestions: list[AltTextResult],
    console: Console,
    output_path: Path,
    append_mode: bool,
) -> int:
    """Load suggestions and allow user to label them, collecting results."""
    display = DisplayManager(console)
    processed_results: list[AltGenerationResult] = []

    console.print(
        f"\n[bold blue]Labeling {len(suggestions)} suggestions[/bold blue]\n"
    )

    suggestions_to_process = suggestions
    if append_mode:
        existing_captions = _load_existing_captions(output_path)
        original_count = len(suggestions_to_process)
        suggestions_to_process = [
            s for s in suggestions if s.asset_path not in existing_captions
        ]
        skipped_count = original_count - len(suggestions_to_process)
        if skipped_count > 0:
            console.print(
                f"[dim]Skipped {skipped_count} items with existing captions[/dim]"
            )

    try:
        total_count = len(suggestions_to_process)
        for i, suggestion_data in enumerate(suggestions_to_process, 1):
            try:
                result = _process_single_suggestion_for_labeling(
                    suggestion_data, display, current=i, total=total_count
                )
                processed_results.append(result)
            # Individual errors don't halt the loop
            except (
                AltGenerationError,
                FileNotFoundError,
                requests.RequestException,
            ) as err:
                display.show_error(str(err))
                continue
            # Let KeyboardInterrupt and other critical exceptions bubble up
            # but ensure we save any processed results in the finally block
    finally:
        # Always save results regardless of how we exit
        if processed_results:
            _write_output(
                processed_results, output_path, append_mode=append_mode
            )
            console.print(
                f"[green]Saved {len(processed_results)} results to {output_path}[/green]"
            )

    return len(processed_results)


def _write_output(
    results: Iterable[AltGenerationResult],
    output_path: Path,
    append_mode: bool = False,
) -> None:
    """Write results to JSON file."""
    payload = [result.to_json() for result in results]

    if append_mode and output_path.exists():
        # Load existing data and append new results
        try:
            with open(output_path, encoding="utf-8") as f:
                existing_data = json.load(f)
            if isinstance(existing_data, list):
                payload = existing_data + payload
        except (json.JSONDecodeError, TypeError):
            # If existing file is corrupted, just use new data
            print(f"Existing file {output_path} is corrupted, using new data")

    print(f"Writing {len(payload)} results to {output_path}")
    output_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def label_from_suggestions_file(
    suggestions_file: Path,
    output_path: Path,
    skip_existing: bool = False,
) -> None:
    """Load suggestions from file and start labeling process."""
    console = Console()

    with open(suggestions_file, encoding="utf-8") as f:
        suggestions_from_file = json.load(f)

    # Convert loaded data to AltTextResult, filtering out extra fields
    suggestions = []
    for s in suggestions_from_file:
        filtered_data = {
            "markdown_file": s["markdown_file"],
            "asset_path": s["asset_path"],
            "suggested_alt": s["suggested_alt"],
            "model": s["model"],
            "context_snippet": s["context_snippet"],
            "line_number": int(s["line_number"]),
        }
        suggestions.append(AltTextResult(**filtered_data))

    console.print(
        f"[green]Loaded {len(suggestions)} suggestions from {suggestions_file}[/green]"
    )

    processed_count = _label_suggestions(
        suggestions, console, output_path, skip_existing
    )

    # Write final results
    console.print(
        f"\n[green]Completed! Wrote {processed_count} results to {output_path}[/green]"
    )


# ---------------------------------------------------------------------------
# Sub-command CLI helpers
# ---------------------------------------------------------------------------


def _run_estimate(
    options: GenerateAltTextOptions, suggestions_path: Path
) -> None:
    """Estimate and print LLM cost for the current queue."""
    console = Console()
    queue_items = scan_for_empty_alt.build_queue(options.root)
    if options.skip_existing:
        queue_items = _filter_existing_captions(
            queue_items,
            [options.output_path, suggestions_path],
            console,
        )

    cost_est = _estimate_cost(options.model, len(queue_items))
    console.print(
        f"[bold blue]{len(queue_items)} items → {cost_est} using model '{options.model}'[/bold blue]"
    )


def _run_generate(
    options: GenerateAltTextOptions, suggestions_path: Path
) -> None:
    """Batch-generate suggestions and save them to *suggestions_path*."""
    console = Console()
    queue_items = scan_for_empty_alt.build_queue(options.root)
    if options.skip_existing:
        queue_items = _filter_existing_captions(
            queue_items,
            [options.output_path, suggestions_path],
            console,
            verbose=False,
        )

    if not queue_items:
        console.print("[yellow]No items to process.[/yellow]")
        return

    console.print(
        f"[bold green]Generating {len(queue_items)} suggestions with '{options.model}'[/bold green]"
    )

    try:
        suggestions = asyncio.run(
            _async_generate_suggestions(queue_items, options)
        )
    finally:
        # Convert suggestions to the same format as AltGenerationResult for consistency
        suggestion_results = [
            AltGenerationResult(
                markdown_file=s.markdown_file,
                asset_path=s.asset_path,
                suggested_alt=s.suggested_alt,
                final_alt=s.suggested_alt,  # For suggestions, these are the same
                model=s.model,
                context_snippet=s.context_snippet,
            )
            for s in suggestions
        ]

        # Use the same append logic as the main output writing
        _write_output(suggestion_results, suggestions_path, append_mode=True)
        console.print(
            f"[green]Saved {len(suggestions)} suggestions to {suggestions_path}[/green]"
        )


# ---------------------------------------------------------------------------
# CLI parsing
# ---------------------------------------------------------------------------


def _parse_args() -> argparse.Namespace:
    """Return parsed CLI arguments using sub-commands."""
    git_root = script_utils.get_git_root()

    parser = argparse.ArgumentParser(description="Alt-text assistant")
    sub = parser.add_subparsers(dest="cmd")

    # Arguments shared by generate/estimate
    shared_args = argparse.ArgumentParser(add_help=False)
    shared_args.add_argument(
        "--root",
        type=Path,
        default=git_root / "website_content",
        help="Markdown root directory",
    )
    shared_args.add_argument("--model")
    shared_args.add_argument(
        "--max-chars",
        type=int,
        default=300,
        help="Max characters for generated alt text",
    )
    shared_args.add_argument(
        "--timeout", type=int, default=120, help="LLM command timeout seconds"
    )
    shared_args.add_argument(
        "--process-existing",
        dest="skip_existing",
        action="store_false",
        help="Also process assets that already have captions (default is to skip)",
    )
    shared_args.add_argument(
        "--suggestions-file",
        type=Path,
        default=git_root / "scripts" / "suggested_alts.json",
        help="Path to read/write suggestions JSON",
    )
    shared_args.set_defaults(skip_existing=True)

    # generate (default command)
    sp_gen = sub.add_parser(
        "generate", parents=[shared_args], help="Batch-generate suggestions"
    )
    sp_gen.add_argument(
        "--captions",
        type=Path,
        default=git_root / "scripts" / "asset_captions.json",
        help="Existing/final captions JSON path (used to skip existing unless --process-existing)",
    )

    sp_gen.add_argument(
        "--estimate-only",
        action="store_true",
        help="Only estimate cost without generating suggestions",
    )
    sp_gen.set_defaults(cmd="generate")

    # label
    sp_label = sub.add_parser(
        "label", parents=[shared_args], help="Label suggestions JSON"
    )
    sp_label.add_argument(
        "--output",
        type=Path,
        default=git_root / "scripts" / "asset_captions.json",
        help="Final captions JSON path",
    )
    sp_label.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip captions already present in output file",
    )
    sp_label.set_defaults(cmd="label")

    # If no subcommand is given, parse as if 'generate' was provided
    args = parser.parse_args()
    if args.cmd is None:
        # Re-parse with 'generate' as the default command
        args = parser.parse_args(["generate"] + sys.argv[1:])

    return args


# ---------------------------------------------------------------------------
# Main entry
# ---------------------------------------------------------------------------


def main() -> None:  # pylint: disable=C0116
    args = _parse_args()

    if args.cmd == "generate":
        if not args.model:
            print("Error: --model is required for the generate command")
            sys.exit(1)

        opts = GenerateAltTextOptions(
            root=args.root,
            model=args.model,
            max_chars=args.max_chars,
            timeout=args.timeout,
            output_path=args.captions,
            skip_existing=args.skip_existing,
        )
        _run_estimate(opts, args.suggestions_file)
        _run_generate(opts, args.suggestions_file)

    elif args.cmd == "label":
        label_from_suggestions_file(
            args.suggestions_file, args.output, args.skip_existing
        )


if __name__ == "__main__":
    main()
