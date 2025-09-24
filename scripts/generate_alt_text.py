"""Generate AI alt text suggestions for assets lacking meaningful alt text."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import textwrap
from dataclasses import asdict, dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Iterable
from urllib.parse import urlparse

import requests
from rich.box import ROUNDED
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt

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
    model: str
    ai_generated: bool
    context_snippet: str
    video_sources: tuple[str, ...]

    def to_json(self) -> dict[str, object]:
        """Convert to JSON-serializable dict."""
        return asdict(self)


class AltGenerationError(Exception):
    """Raised when caption generation fails."""


def _is_url(path: str) -> bool:
    """Check if path is a URL."""
    parsed = urlparse(path)
    return bool(parsed.scheme and parsed.netloc)


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
        return target

    # Try relative to markdown file first
    markdown_path = Path(queue_item.markdown_file)
    candidate = markdown_path.parent / asset_path
    if candidate.exists():
        return candidate.resolve()

    # Try relative to git root
    git_root = script_utils.get_git_root()
    alternative = git_root / asset_path.lstrip("/")
    if alternative.exists():
        return alternative.resolve()

    raise FileNotFoundError(
        f"Unable to locate asset '{asset_path}' referenced in {queue_item.markdown_file}"
    )


def _extract_video_sources(context_snippet: str) -> tuple[str, ...]:
    """Extract video source URLs from HTML context."""
    sources: list[str] = []
    for line in context_snippet.splitlines():
        line_stripped = line.strip()
        if "<source" not in line_stripped:
            continue
        parts = line_stripped.split("src=")
        if len(parts) < 2:
            continue
        fragment = parts[1].split('"')
        if len(fragment) < 2:
            continue
        sources.append(fragment[1])
    return tuple(sources)


def _build_prompt(
    queue_item: scan_for_empty_alt.QueueItem, max_chars: int
) -> str:
    """Build prompt for LLM caption generation."""
    return textwrap.dedent(
        f"""
        Generate concise alt text for accessibility and SEO. Describe what's in the image clearly and accurately.

        Context from {queue_item.markdown_file}:
        {queue_item.context_snippet}

        Critical requirements:
        - Under {max_chars} characters (aim for 1-2 sentences when possible)
        - Skip "image of" or "picture of" phrases  
        - For text-heavy images: transcribe key text content, then describe visual elements
        - Include relevant keywords naturally
        - Describe spatial relationships and visual hierarchy when important
        - Return only the alt text, no quotes

        Prioritize completeness over brevity - include both textual content and visual description as needed.
        """
    ).strip()


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


class DisplayManager:
    """Handles rich console display operations."""

    def __init__(self, console: Console) -> None:
        self.console = console

    def show_context(self, queue_item: scan_for_empty_alt.QueueItem) -> None:
        """Display context information for the queue item."""
        self.console.print(
            Panel(
                queue_item.context_snippet.strip(),
                title="Context",
                subtitle=f"{queue_item.markdown_file}:{queue_item.line_number}",
                box=ROUNDED,
            )
        )

    def show_video_sources(self, sources: Iterable[str]) -> None:
        """Display related video sources if any."""
        entries = list(sources)
        if entries:
            display = "\n".join(entries)
            self.console.print(
                Panel(display, title="Related video sources", box=ROUNDED)
            )

    def show_image(self, path: Path) -> None:
        """Display image path information."""
        if sys.stdout.isatty():
            self.console.print(f"[dim]Image: {path}[/dim]")

    def show_suggestion(self, suggestion: str) -> None:
        """Display the generated alt text suggestion."""
        self.console.print(
            Panel(suggestion, title="Suggested alt text", box=ROUNDED)
        )

    def prompt_for_edit(self, suggestion: str) -> str:
        """Prompt user to edit the suggestion."""
        return Prompt.ask(
            "\n[bold blue]Edit alt text (or press Enter to accept)[/bold blue]",
            default=suggestion,
            console=self.console,
        )

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


def _process_queue_item(
    queue_item: scan_for_empty_alt.QueueItem,
    display: DisplayManager,
    model: str,
    max_chars: int,
    timeout: int,
) -> AltGenerationResult:
    """Process a single queue item and generate alt text."""
    with TemporaryDirectory() as temp_dir:
        workspace = Path(temp_dir)
        attachment = _download_asset(queue_item, workspace)
        prompt = _build_prompt(queue_item, max_chars=max_chars)
        suggestion = _run_llm(attachment, prompt, model=model, timeout=timeout)

        # Display results
        display.show_rule(queue_item.asset_path)
        display.show_context(queue_item)

        video_sources = _extract_video_sources(queue_item.context_snippet)
        display.show_video_sources(video_sources)
        display.show_image(attachment)
        display.refocus_terminal()
        display.show_suggestion(suggestion)

        # Allow user to edit the suggestion
        final_alt = suggestion
        if sys.stdout.isatty():
            final_alt = display.prompt_for_edit(suggestion)

        return AltGenerationResult(
            markdown_file=queue_item.markdown_file,
            asset_path=queue_item.asset_path,
            suggested_alt=final_alt,
            model=model,
            ai_generated=True,
            context_snippet=queue_item.context_snippet,
            video_sources=video_sources,
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


def generate_alt_text(
    root: Path,
    model: str,
    limit: int | None,
    max_chars: int,
    timeout: int,
) -> list[AltGenerationResult]:
    """Generate alt text suggestions for assets in the queue."""
    console = Console()
    display = DisplayManager(console)

    queue_items = scan_for_empty_alt.build_queue(root)
    if limit is not None:
        queue_items = queue_items[:limit]

    # Show cost estimation
    cost_estimate = _estimate_cost(model, len(queue_items))
    console.print(
        f"\n[bold blue]Processing {len(queue_items)} items with model '{model}'[/bold blue]"
    )
    console.print(f"[dim]{cost_estimate}[/dim]\n")
    input("Press Enter to continue...")

    results: list[AltGenerationResult] = []
    for queue_item in queue_items:
        try:
            result = _process_queue_item(
                queue_item=queue_item,
                display=display,
                model=model,
                max_chars=max_chars,
                timeout=timeout,
            )
            results.append(result)
        except (
            AltGenerationError,
            FileNotFoundError,
            requests.RequestException,
        ) as err:
            display.show_error(str(err))

    return results


def _write_output(
    results: Iterable[AltGenerationResult], output_path: Path
) -> None:
    """Write results to JSON file."""
    payload = [result.to_json() for result in results]
    output_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _parse_args() -> argparse.Namespace:
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
        "--limit",
        type=int,
        help="Only process the first N queue items.",
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
    return parser.parse_args()


def main() -> None:
    """Main entry point."""
    args = _parse_args()
    results = generate_alt_text(
        root=args.root,
        model=args.model,
        limit=args.limit,
        max_chars=args.max_chars,
        timeout=args.timeout,
    )
    _write_output(results, args.output)
    print(f"Wrote {len(results)} result(s) to {args.output}")


if __name__ == "__main__":
    main()
