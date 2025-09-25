"""Generate AI alt text suggestions for assets lacking meaningful alt text."""

import argparse
import atexit
import json
import readline
import shutil
import signal
import subprocess
import sys
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

# Add the project root to sys.path
# pylint: disable=C0413
sys.path.append(str(Path(__file__).parent.parent))

from scripts import scan_for_empty_alt
from scripts import utils as script_utils

# Approximate cost estimates per 1000 tokens (as of Sep 2025)
MODEL_COSTS = {
    # https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash
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
        return _convert_avif_to_png(target, workspace)

    # Try relative to markdown file first
    markdown_path = Path(queue_item.markdown_file)
    candidate = markdown_path.parent / asset_path
    if candidate.exists():
        return _convert_avif_to_png(candidate.resolve(), workspace)

    # Try relative to git root
    git_root = script_utils.get_git_root()
    alternative = git_root / asset_path.lstrip("/")
    if alternative.exists():
        return _convert_avif_to_png(alternative.resolve(), workspace)

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
        Generate concise alt text for accessibility and SEO. Describe the intended information of the image clearly and accurately.
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
        - Do not include redundant information (e.g. "image of", "picture of")
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
        [llm_path, "-m", model, "-a", str(attachment), prompt],
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
    avg_prompt_tokens: int = 300,
    avg_output_tokens: int = 50,
) -> str:
    """Estimate the cost of processing the queue with the given model."""
    # Normalize model name for cost lookup
    model_lower = model.lower()

    if model_lower in MODEL_COSTS:
        cost_info = MODEL_COSTS[model_lower]
    else:
        raise ValueError(
            f"Unknown model: {model}. Available models: {MODEL_COSTS.keys()}"
        )

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


def generate_alt_text(
    options: GenerateAltTextOptions,
) -> None:
    """Generate alt text suggestions for assets in the queue."""
    console = Console()
    display = DisplayManager(console)
    results: list[AltGenerationResult] = []

    def cleanup() -> None:
        display.close_all_images()
        _write_output(
            results, options.output_path, append_mode=options.skip_existing
        )

    atexit.register(cleanup)

    # Handle Ctrl+C gracefully
    def signal_handler(_signum: int, _frame: object) -> None:
        console.print("\n[yellow]Interrupted by user. Cleaning up...[/yellow]")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

    queue_items = scan_for_empty_alt.build_queue(options.root)
    if options.skip_existing:
        queue_items = _filter_existing_captions(
            queue_items, options.output_path, console
        )

    # Show cost estimation
    cost_estimate = _estimate_cost(options.model, len(queue_items))
    console.print(
        f"\n[bold blue]Processing {len(queue_items)} items with model '{options.model}'[/bold blue]"
    )
    console.print(f"[dim]{cost_estimate}[/dim]\n")

    input("Press Enter to continue...")

    for queue_item in queue_items:
        try:
            result = _process_queue_item(
                queue_item=queue_item,
                display=display,
                options=options,
            )
            results.append(result)
        except (
            AltGenerationError,
            FileNotFoundError,
            requests.RequestException,
        ) as err:
            display.show_error(str(err))
            # Close any image that might be open for this failed item
            display.close_current_image()
    cleanup()


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


def _parse_args() -> GenerateAltTextOptions:
    """Parse command line arguments."""
    git_root = script_utils.get_git_root()
    parser = argparse.ArgumentParser(
        description="Generate AI alt text suggestions for markdown assets.",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=git_root / "website_content",
        help="Directory root to search for markdown files.",
    )
    parser.add_argument(
        "--model",
        required=True,
        help="Model identifier to pass to the 'llm' CLI.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=git_root / "scripts" / "asset_captions.json",
        help="Path to write generated captions.",
    )
    parser.add_argument(
        "--max-chars",
        type=int,
        default=250,
        help="Maximum character length for generated alt text (no hard technical limit, but consider UX).",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=120,
        help="Seconds to wait for the LLM command to complete.",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip files that already have captions in asset_captions.json.",
    )
    args = parser.parse_args()
    return GenerateAltTextOptions(
        root=args.root,
        model=args.model,
        max_chars=args.max_chars,
        timeout=args.timeout,
        output_path=args.output,
        skip_existing=args.skip_existing,
    )


def main() -> None:
    """Main entry point."""
    generate_alt_text(_parse_args())


if __name__ == "__main__":
    main()
