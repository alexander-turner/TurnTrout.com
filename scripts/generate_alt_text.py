"""Generate AI alt text suggestions for assets lacking meaningful alt text."""

import argparse
import asyncio
import atexit
import json
import readline
import shutil
import signal
import subprocess
import sys
import tempfile
import textwrap
from dataclasses import asdict, dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Iterable, Sequence
from urllib.parse import urlparse

import requests
from rich.box import ROUNDED
from rich.console import Console
from rich.panel import Panel
from tqdm.rich import tqdm

# Add the project root to sys.path
# pylint: disable=C0413
sys.path.append(str(Path(__file__).parent.parent))

from scripts import scan_for_empty_alt
from scripts import utils as script_utils

# Approximate cost estimates per 1000 tokens (as of Sep 2025)
MODEL_COSTS = {
    # https://www.helicone.ai/llm-cost
    "gemini-2.5-pro": {"input": 0.00125, "output": 0.01},
    "gemini-2.5-flash": {"input": 0.0003, "output": 0.0025},
    "gemini-2.5-flash-lite": {"input": 0.00001, "output": 0.00004},
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


def _is_url(path: str) -> bool:
    """Check if path is a URL."""
    parsed = urlparse(path)
    return bool(parsed.scheme and parsed.netloc)


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

    if _is_url(asset_path):
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


def _build_prompt(
    queue_item: scan_for_empty_alt.QueueItem,
    max_chars: int,
    learning_examples: list[dict[str, str]] | None = None,
) -> str:
    """Build prompt for LLM caption generation."""
    base_prompt = textwrap.dedent(
        """
        Generate concise alt text for accessibility and SEO. 
        Describe the intended information of the image clearly and accurately.
        """
    ).strip()

    # Add multi-shot examples if available
    examples_section = ""
    if learning_examples:
        examples_section = (
            "\n\nExamples of how initial suggestions were improved:\n\n"
        )
        for i, example in enumerate(learning_examples, 1):
            examples_section += textwrap.dedent(
                f"""
                Example {i}:
                Initial suggestion: {example["suggested_alt"]}
                Improved version: {example["final_alt"]}
                
                """
            )
        examples_section += "Learn from these examples to generate better initial suggestions.\n"

    main_prompt = textwrap.dedent(
        f"""
        Context from {queue_item.markdown_file}:
        {queue_item.context_snippet}

        Critical requirements:
        - Under {max_chars} characters (aim for 1-2 sentences when possible)
        - Do not include redundant information (e.g. "image of", "picture of", "diagram illustrating")
        - Return only the alt text, no quotes
        - For text-heavy images: transcribe key text content, then describe visual elements
        - Include relevant keywords naturally
        - Describe spatial relationships and visual hierarchy when important

        Prioritize completeness over brevity - include both textual content and visual description as needed.
        """
    ).strip()

    return f"{base_prompt}{examples_section}\n{main_prompt}"


def _run_llm(attachment: Path, prompt: str, model: str, timeout: int) -> str:
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


def _truncate_context_for_display(context_snippet: str) -> str:
    """Truncate context to show only the two paragraphs just before the
    image."""
    # Split context into paragraphs by double newlines
    paragraphs = context_snippet.split("\n\n")

    # Remove empty paragraphs
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    # Return the last two paragraphs (just before the image)
    if len(paragraphs) <= 2:
        return context_snippet.strip()
    return "\n\n".join(paragraphs[-2:])


class DisplayManager:
    """Handles rich console display operations."""

    def __init__(self, console: Console) -> None:
        self.console = console
        self._image_processes: list[subprocess.Popen[bytes]] = []

    def show_context(self, queue_item: scan_for_empty_alt.QueueItem) -> None:
        """Display context information for the queue item."""
        # Show only the two paragraphs just before the image
        truncated_context = _truncate_context_for_display(
            queue_item.context_snippet
        )
        self.console.print(
            Panel(
                truncated_context,
                title="Context",
                subtitle=f"{queue_item.markdown_file}:{queue_item.line_number}",
                box=ROUNDED,
            )
        )

    def show_image(self, path: Path) -> None:
        """Display the actual image using the system's default image viewer."""
        if sys.stdout.isatty():
            self.console.print(f"[dim]Image: {path}[/dim]")

            # Open the image with the default system viewer (macOS/Linux/Windows compatible)
            try:
                if sys.platform == "darwin":  # macOS
                    # Use Popen to track the process for later cleanup
                    process = subprocess.Popen(["open", str(path)])
                    self._image_processes.append(process)
                elif sys.platform.startswith("linux"):  # Linux
                    process = subprocess.Popen(["xdg-open", str(path)])
                    self._image_processes.append(process)
                elif sys.platform == "win32":  # Windows
                    process = subprocess.Popen(
                        ["start", str(path)], shell=True
                    )
                    self._image_processes.append(process)
                else:
                    raise ValueError(f"Unsupported platform: {sys.platform}")
            except (subprocess.SubprocessError, OSError) as err:
                raise ValueError(f"Failed to open image: {err}") from err

    def show_suggestion(self, suggestion: str) -> None:
        """Display the generated alt text suggestion."""
        self.console.print(
            Panel(suggestion, title="Suggested alt text", box=ROUNDED)
        )

    def prompt_for_edit(self, suggestion: str) -> str:
        """Prompt user to edit the suggestion with prefilled editable text."""
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

    def refocus_terminal(self) -> None:
        """Attempt to refocus terminal (iTerm2 specific)."""
        if sys.stdout.isatty():
            self.console.print("\033]1337;StealFocus\a", end="")
            self.console.print()

    def close_current_image(self) -> None:
        """Close the most recently opened image viewer."""
        # On macOS, the `open` command often launches Preview and returns
        # immediately, so the spawned `open` process terminates before we can
        # track or kill it. As a fallback, explicitly ask Preview to quit.
        if sys.platform == "darwin" and shutil.which("osascript") is not None:
            subprocess.run(
                [
                    "osascript",
                    "-e",
                    'tell application "Preview" to quit',
                ],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

        if not self._image_processes:
            return

        process = self._image_processes[-1]
        try:
            if process.poll() is None:  # Process is still running
                process.terminate()
                # Give it a moment to close gracefully
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    process.kill()  # Force kill if it doesn't close
        except (OSError, subprocess.SubprocessError):
            pass  # Process might already be dead
        self._image_processes.pop()

    def close_all_images(self) -> None:
        """Close all opened image viewers."""
        while self._image_processes:
            self.close_current_image()


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

        # Load learning examples for multi-shot prompting
        learning_examples = _load_learning_examples(options.output_path)
        prompt = _build_prompt(
            queue_item,
            max_chars=options.max_chars,
            learning_examples=learning_examples,
        )
        suggestion = _run_llm(
            attachment, prompt, model=options.model, timeout=options.timeout
        )

        # Display results
        display.show_rule(queue_item.asset_path)
        display.show_context(queue_item)
        display.show_image(attachment)
        display.refocus_terminal()

        # Allow user to edit the suggestion
        final_alt = suggestion
        if sys.stdout.isatty():
            final_alt = display.prompt_for_edit(suggestion)

        display.close_current_image()

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


def _load_learning_examples(
    captions_path: Path, max_examples: int = 5
) -> list[dict[str, str]]:
    """Load examples where suggested_alt differs from final_alt for multi-shot
    learning."""
    try:
        with open(captions_path, encoding="utf-8") as f:
            data = json.load(f)

        # Filter examples where suggestion was edited
        learning_examples = []
        for item in data:
            if item["suggested_alt"] != item["final_alt"]:
                learning_examples.append(
                    {
                        "suggested_alt": item["suggested_alt"],
                        "final_alt": item["final_alt"],
                    }
                )

        # Return up to max_examples, prioritizing more recent ones (later in file)
        return learning_examples[-max_examples:] if learning_examples else []
    except (FileNotFoundError, json.JSONDecodeError, KeyError, TypeError):
        return []


def _filter_existing_captions(
    queue_items: Sequence[scan_for_empty_alt.QueueItem],
    output_path: Path,
    console: Console,
) -> list[scan_for_empty_alt.QueueItem]:
    existing_captions = _load_existing_captions(output_path)
    original_count = len(queue_items)
    filtered_items = [
        item
        for item in queue_items
        if item.asset_path not in existing_captions
    ]
    skipped_count = original_count - len(filtered_items)
    if skipped_count > 0:
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
    line_number: str


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
            prompt = _build_prompt(
                queue_item, options.max_chars, learning_examples=None
            )
            caption = await asyncio.to_thread(
                _run_llm, attachment, prompt, options.model, options.timeout
            )
        return AltTextResult(
            markdown_file=queue_item.markdown_file,
            asset_path=queue_item.asset_path,
            suggested_alt=caption,
            model=options.model,
            context_snippet=queue_item.context_snippet,
            line_number=str(queue_item.line_number),
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
                suggestions.append(await finished)
                progress_bar.update(1)
        except asyncio.CancelledError:
            progress_bar.set_description(
                "Generating alt text (cancelled, finishing up...)"
            )

    return suggestions


def _process_single_suggestion_for_labeling(
    suggestion_data: AltTextResult,
    display: DisplayManager,
    output_path: Path,
) -> None:
    # Recreate queue item for display
    queue_item = scan_for_empty_alt.QueueItem(
        markdown_file=suggestion_data.markdown_file,
        asset_path=suggestion_data.asset_path,
        line_number=int(suggestion_data.line_number),
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
        display.refocus_terminal()
        display.show_suggestion(suggestion_data.suggested_alt)

        # Allow user to edit the suggestion
        final_alt = suggestion_data.suggested_alt
        if sys.stdout.isatty():
            final_alt = display.prompt_for_edit(suggestion_data.suggested_alt)

        display.close_current_image()

    result = AltGenerationResult(
        markdown_file=suggestion_data.markdown_file,
        asset_path=suggestion_data.asset_path,
        suggested_alt=suggestion_data.suggested_alt,
        final_alt=final_alt,
        model=suggestion_data.model,
        context_snippet=suggestion_data.context_snippet,
    )
    _write_output([result], output_path, append_mode=True)


def _label_suggestions(
    suggestions: list[AltTextResult],
    console: Console,
    output_path: Path,
    append_mode: bool,
) -> int:
    """Load suggestions and allow user to label them, saving after each."""
    display = DisplayManager(console)
    processed_count = 0

    def cleanup() -> None:
        display.close_all_images()

    atexit.register(cleanup)

    # Handle Ctrl+C gracefully
    def signal_handler(_signum: int, _frame: object) -> None:
        console.print(
            "\n[yellow]Interrupted by user. Progress has been saved.[/yellow]"
        )
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

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

    for suggestion_data in suggestions_to_process:
        try:
            _process_single_suggestion_for_labeling(
                suggestion_data, display, output_path
            )
            processed_count += 1

        except (
            AltGenerationError,
            FileNotFoundError,
            requests.RequestException,
        ) as err:
            display.show_error(str(err))
            display.close_current_image()

    cleanup()
    return processed_count


def batch_generate_alt_text(
    options: GenerateAltTextOptions,
) -> None:
    """Generate alt text suggestions in batch mode: estimate cost, generate all suggestions, then label."""
    console = Console()

    queue_items = scan_for_empty_alt.build_queue(options.root)
    if options.skip_existing:
        queue_items = _filter_existing_captions(
            queue_items, options.output_path, console
        )

    if not queue_items:
        console.print("[yellow]No items to process.[/yellow]")
        return

    # Step 1: Cost estimation
    cost_estimate = _estimate_cost(options.model, len(queue_items))
    console.print(
        f"\n[bold blue]Batch processing {len(queue_items)} items with model '{options.model}'[/bold blue]"
    )
    console.print(f"[dim]{cost_estimate}[/dim]\n")

    user_input = input("Press Enter to continue or 'q' to quit: ")
    if user_input.lower().strip() == "q":
        console.print("[yellow]Aborted.[/yellow]")
        return

    # Step 2: Batch generation (no user input)
    console.print(
        "\n[bold green]Step 2: Generating all suggestions (no user input required)[/bold green]"
    )
    suggestions = asyncio.run(
        _async_generate_suggestions(queue_items, options)
    )

    if not suggestions:
        console.print("[yellow]No suggestions generated.[/yellow]")
        return

    # Save suggestions to temporary file
    suggestions_file = (
        options.output_path.parent / f"suggested_alts_{options.model}.json"
    )
    suggestions_file.write_text(
        json.dumps(suggestions, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    console.print(
        f"\n[green]Saved {len(suggestions)} suggestions to {suggestions_file}[/green]"
    )

    # Step 3: User labeling
    console.print(
        "\n[bold green]Step 3: Review and edit suggestions[/bold green]"
    )
    user_input = input("Press Enter to start labeling or 'q' to quit: ")
    if user_input.lower().strip() == "q":
        console.print(
            f"[yellow]Suggestions saved to {suggestions_file}. You can resume labeling later.[/yellow]"
        )
        return

    processed_count = _label_suggestions(
        suggestions, console, options.output_path, options.skip_existing
    )

    # Write final results
    console.print(
        f"\n[green]Completed! Wrote {processed_count} results to {options.output_path}[/green]"
    )


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


def _load_suggestions_from_file(
    suggestions_file: Path,
) -> list[dict[str, str]]:
    """Load suggestions from a JSON file."""
    try:
        with open(suggestions_file, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as err:
        raise ValueError(
            f"Could not load suggestions from {suggestions_file}: {err}"
        ) from err


def label_from_suggestions_file(
    suggestions_file: Path,
    output_path: Path,
    skip_existing: bool = False,
) -> None:
    """Load suggestions from file and start labeling process."""
    console = Console()

    suggestions_from_file = _load_suggestions_from_file(suggestions_file)
    suggestions = [AltTextResult(**s) for s in suggestions_from_file]

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


def _run_estimate(options: GenerateAltTextOptions) -> None:
    """Estimate and print LLM cost for the current queue."""
    console = Console()
    queue_items = scan_for_empty_alt.build_queue(options.root)
    if options.skip_existing:
        queue_items = _filter_existing_captions(
            queue_items, options.output_path, console
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
            queue_items, options.output_path, console
        )

    if not queue_items:
        console.print("[yellow]No items to process.[/yellow]")
        return

    console.print(
        f"[bold green]Generating {len(queue_items)} suggestions with '{options.model}'[/bold green]"
    )
    suggestions = asyncio.run(
        _async_generate_suggestions(queue_items, options)
    )

    suggestions_as_dicts = [asdict(s) for s in suggestions]
    suggestions_path.write_text(
        json.dumps(suggestions_as_dicts, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    console.print(f"[green]Saved suggestions to {suggestions_path}[/green]")


def _run_label(
    suggestions_path: Path,
    output_path: Path,
    skip_existing: bool,
) -> None:
    """Load *suggestions_path* and launch the labeling flow."""
    label_from_suggestions_file(suggestions_path, output_path, skip_existing)


# ---------------------------------------------------------------------------
# CLI parsing
# ---------------------------------------------------------------------------


def _parse_args() -> argparse.Namespace:
    """Return parsed CLI arguments using sub-commands."""
    git_root = script_utils.get_git_root()

    # Common flags shared by estimate/generate sub-commands
    common_parent = argparse.ArgumentParser(add_help=False)
    common_parent.add_argument(
        "--root",
        type=Path,
        default=git_root / "website_content",
        help="Markdown root directory",
    )
    common_parent.add_argument("--model", required=False)
    common_parent.add_argument(
        "--max-chars",
        type=int,
        default=250,
        help="Max characters for generated alt text",
    )
    common_parent.add_argument(
        "--timeout", type=int, default=120, help="LLM command timeout seconds"
    )
    common_parent.add_argument(
        "--process-existing",
        dest="skip_existing",
        action="store_false",
        help="Also process assets that already have captions (default is to skip)",
    )
    common_parent.set_defaults(skip_existing=True)

    parser = argparse.ArgumentParser(description="Alt-text assistant")
    sub = parser.add_subparsers(dest="cmd", required=True)

    # estimate
    sp_est = sub.add_parser(
        "estimate", parents=[common_parent], help="Estimate LLM cost"
    )
    sp_est.set_defaults(cmd="estimate")

    # generate
    sp_gen = sub.add_parser(
        "generate", parents=[common_parent], help="Batch-generate suggestions"
    )
    sp_gen.add_argument(
        "--captions",
        type=Path,
        default=git_root / "scripts" / "asset_captions.json",
        help="Existing/final captions JSON path (used to skip existing unless --process-existing)",
    )
    sp_gen.add_argument(
        "--suggestions-out",
        type=Path,
        default=git_root / "scripts" / "suggested_alts.json",
        help="Path to write suggestions JSON",
    )
    sp_gen.set_defaults(cmd="generate")

    # label
    sp_label = sub.add_parser("label", help="Label suggestions JSON")
    sp_label.add_argument("suggestions_file", type=Path)
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

    return parser.parse_args()


# ---------------------------------------------------------------------------
# Main entry
# ---------------------------------------------------------------------------


def main() -> None:  # pylint: disable=C0116
    args = _parse_args()

    if args.cmd == "estimate":
        if args.model is None:
            raise SystemExit("--model is required for estimate")
        opts = GenerateAltTextOptions(
            root=args.root,
            model=args.model,
            max_chars=args.max_chars,
            timeout=args.timeout,
            output_path=Path(),  # unused
            skip_existing=args.skip_existing,
        )
        _run_estimate(opts)

    elif args.cmd == "generate":
        if args.model is None:
            raise SystemExit("--model is required for generate")
        opts = GenerateAltTextOptions(
            root=args.root,
            model=args.model,
            max_chars=args.max_chars,
            timeout=args.timeout,
            output_path=args.captions,
            skip_existing=args.skip_existing,
        )
        _run_generate(opts, args.suggestions_out)

    elif args.cmd == "label":
        _run_label(args.suggestions_file, args.output, args.skip_existing)


if __name__ == "__main__":
    main()
