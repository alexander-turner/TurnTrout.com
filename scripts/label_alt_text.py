"""Interactive labeling interface for alt text suggestions."""

import json
import os
import readline
import subprocess
import sys
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory

import requests
from rich.box import ROUNDED
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel

# pylint: disable=C0413
sys.path.append(str(Path(__file__).parent.parent))

from scripts import alt_text_utils, scan_for_empty_alt

UNDO_REQUESTED = "UNDO_REQUESTED"


class LabelingSession:
    """Manages the labeling session state and navigation."""

    def __init__(
        self, suggestions: list[alt_text_utils.AltGenerationResult]
    ) -> None:
        self.suggestions = suggestions
        self.current_index = 0
        self.processed_results: list[alt_text_utils.AltGenerationResult] = []

    def can_undo(self) -> bool:
        """Check if undo is possible."""
        return len(self.processed_results) > 0

    def undo(self) -> alt_text_utils.AltGenerationResult | None:
        """Undo the last processed result and return to previous item."""
        if not self.can_undo():
            return None

        undone_result = self.processed_results.pop()
        self.current_index = max(0, self.current_index - 1)
        return undone_result

    def add_result(self, result: alt_text_utils.AltGenerationResult) -> None:
        """Add a processed result and advance to next item."""
        self.processed_results.append(result)
        self.current_index += 1

    def get_current_suggestion(
        self,
    ) -> alt_text_utils.AltGenerationResult | None:
        """Get the current suggestion to process."""
        if self.current_index >= len(self.suggestions):
            return None
        return self.suggestions[self.current_index]

    def is_complete(self) -> bool:
        """Check if all suggestions have been processed."""
        return self.current_index >= len(self.suggestions)

    def get_progress(self) -> tuple[int, int]:
        """Get current position and total count."""
        return self.current_index + 1, len(self.suggestions)

    def skip_current(self) -> None:
        """Skip the current suggestion due to error and advance index."""
        self.current_index += 1


class DisplayManager:
    """Handles rich console display operations."""

    def __init__(self, console: Console) -> None:
        self.console = console

    def show_context(self, queue_item: scan_for_empty_alt.QueueItem) -> None:
        """Display context information for the queue item."""
        context = alt_text_utils.generate_article_context(
            queue_item, max_before=4, max_after=1, trim_frontmatter=True
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
            f"Progress: {current}/{total} ({(current-1)/total*100:.1f}%)"
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
            "\n[bold blue]Edit alt text (or press Enter to accept, 'undo' to go back):[/bold blue]"
        )
        result = input("> ")
        readline.set_startup_hook(None)

        # Check for undo command
        if result.strip().lower() in ("undo", "u"):
            return UNDO_REQUESTED

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


def _process_single_suggestion_for_labeling(
    suggestion_data: alt_text_utils.AltGenerationResult,
    display: DisplayManager,
    current: int | None = None,
    total: int | None = None,
) -> alt_text_utils.AltGenerationResult:
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
        attachment = alt_text_utils.download_asset(queue_item, workspace)

        # Display results
        display.show_rule(queue_item.asset_path)
        display.show_context(queue_item)
        display.show_image(attachment)

        # Allow user to edit the suggestion
        prefill_text = (
            suggestion_data.final_alt
            if suggestion_data.final_alt is not None
            else suggestion_data.suggested_alt
        )
        final_alt = prefill_text
        if sys.stdout.isatty():
            final_alt = display.prompt_for_edit(prefill_text, current, total)

        return alt_text_utils.AltGenerationResult(
            markdown_file=suggestion_data.markdown_file,
            asset_path=suggestion_data.asset_path,
            suggested_alt=suggestion_data.suggested_alt,
            final_alt=final_alt,
            model=suggestion_data.model,
            context_snippet=suggestion_data.context_snippet,
            line_number=suggestion_data.line_number,
        )


def _filter_suggestions_by_existing(
    suggestions: list[alt_text_utils.AltGenerationResult],
    output_path: Path,
    console: Console,
) -> list[alt_text_utils.AltGenerationResult]:
    """Filter out suggestions that already have captions."""
    existing_captions = alt_text_utils.load_existing_captions(output_path)
    filtered = [
        s for s in suggestions if s.asset_path not in existing_captions
    ]

    skipped_count = len(suggestions) - len(filtered)
    if skipped_count > 0:
        console.print(
            f"[dim]Skipped {skipped_count} items with existing captions[/dim]"
        )

    return filtered


def _handle_undo_request(
    session: LabelingSession,
    console: Console,
) -> None:
    """Handle undo request by reverting to previous suggestion."""
    undone_result = session.undo()

    if undone_result is None:
        console.print("[yellow]Nothing to undo - at the beginning[/yellow]")
        return

    console.print(f"[yellow]Undoing: {undone_result.asset_path}[/yellow]")

    # Prefill with the previous final_alt value
    prefill_text = (
        undone_result.final_alt
        if undone_result.final_alt is not None
        else undone_result.suggested_alt
    )
    session.suggestions[session.current_index] = replace(
        session.suggestions[session.current_index],
        final_alt=prefill_text,
    )


def _process_labeling_loop(
    session: LabelingSession,
    display: DisplayManager,
    console: Console,
) -> None:
    """Process all suggestions in the labeling session."""
    while not session.is_complete():
        current_suggestion = session.get_current_suggestion()
        if current_suggestion is None:
            break

        try:
            current, total = session.get_progress()
            result = _process_single_suggestion_for_labeling(
                current_suggestion, display, current=current, total=total
            )

            if result.final_alt == UNDO_REQUESTED:
                _handle_undo_request(session, console)
            else:
                session.add_result(result)

        except (
            alt_text_utils.AltGenerationError,
            FileNotFoundError,
            requests.RequestException,
        ) as err:
            display.show_error(str(err))
            session.skip_current()


def label_suggestions(
    suggestions: list[alt_text_utils.AltGenerationResult],
    console: Console,
    output_path: Path,
    append_mode: bool,
) -> int:
    """Load suggestions and allow user to label them, collecting results."""
    console.print(
        f"\n[bold blue]Labeling {len(suggestions)} suggestions[/bold blue]\n"
    )

    suggestions_to_process = (
        _filter_suggestions_by_existing(suggestions, output_path, console)
        if append_mode
        else suggestions
    )

    session = LabelingSession(suggestions_to_process)
    display = DisplayManager(console)

    try:
        _process_labeling_loop(session, display, console)
    finally:
        if session.processed_results:
            alt_text_utils.write_output(
                session.processed_results, output_path, append_mode=append_mode
            )
            console.print(
                f"[green]Saved {len(session.processed_results)} results to {output_path}[/green]"
            )

    return len(session.processed_results)


def label_from_suggestions_file(
    suggestions_file: Path,
    output_path: Path,
    skip_existing: bool = False,
) -> None:
    """Load suggestions from file and start labeling process."""
    console = Console()

    with open(suggestions_file, encoding="utf-8") as f:
        suggestions_from_file = json.load(f)

    # Convert loaded data to AltGenerationResult, filtering out extra fields
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
        suggestions.append(alt_text_utils.AltGenerationResult(**filtered_data))

    console.print(
        f"[green]Loaded {len(suggestions)} suggestions from {suggestions_file}[/green]"
    )

    processed_count = label_suggestions(
        suggestions, console, output_path, skip_existing
    )

    # Write final results
    console.print(
        f"\n[green]Completed! Wrote {processed_count} results to {output_path}[/green]"
    )
