"""Main entry point for alt text generation and labeling workflows."""

import argparse
import asyncio
import json
import sys
from enum import StrEnum
from pathlib import Path

from rich.console import Console

# pylint: disable=C0413
sys.path.append(str(Path(__file__).parent.parent))

from scripts import (
    alt_text_utils,
    generate_alt_text,
    label_alt_text,
    scan_for_empty_alt,
)
from scripts import utils as script_utils

_JSON_INDENT: int = 2


class Command(StrEnum):
    """Available commands for alt text workflows."""

    SCAN = "scan"
    GENERATE = "generate"
    LABEL = "label"


def _scan_command(args: argparse.Namespace) -> None:
    """Execute the scan sub-command."""
    output_path = (
        args.output
        or script_utils.get_git_root() / "scripts" / "asset_queue.json"
    )
    queue_items = scan_for_empty_alt.build_queue(args.root)

    output_path.write_text(
        json.dumps(
            [item.to_json() for item in queue_items],
            indent=_JSON_INDENT,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"Wrote {len(queue_items)} queue item(s) to {output_path}")


def _generate_command(args: argparse.Namespace) -> None:
    """Execute the generate sub-command."""
    if not args.model:
        print("Error: --model is required for the generate command")
        sys.exit(1)

    opts = generate_alt_text.GenerateAltTextOptions(
        root=args.root,
        model=args.model,
        max_chars=args.max_chars,
        timeout=args.timeout,
        output_path=args.captions,
        skip_existing=args.skip_existing,
    )

    suggestions_path = args.suggestions_file
    console = Console()
    queue_items = scan_for_empty_alt.build_queue(opts.root)

    if opts.skip_existing:
        queue_items = generate_alt_text.filter_existing_captions(
            queue_items,
            [opts.output_path, suggestions_path],
            console,
            verbose=False if args.estimate_only else True,
        )

    # Show cost estimate
    cost_est = generate_alt_text.estimate_cost(opts.model, len(queue_items))
    console.print(
        f"[bold blue]{len(queue_items)} items → {cost_est} using model '{opts.model}'[/bold blue]"
    )

    # If estimate-only mode, exit here
    if args.estimate_only:
        return

    # Run generation
    if not queue_items:
        console.print("[yellow]No items to process.[/yellow]")
        return

    console.print(
        f"[bold green]Generating {len(queue_items)} suggestions with '{opts.model}'[/bold green]"
    )

    suggestions = []
    try:
        suggestions = asyncio.run(
            generate_alt_text.async_generate_suggestions(queue_items, opts)
        )
    finally:
        alt_text_utils.write_output(
            suggestions, suggestions_path, append_mode=True
        )
        console.print(
            f"[green]Saved {len(suggestions)} suggestions to {suggestions_path}[/green]"
        )


def _label_command(args: argparse.Namespace) -> None:
    """Execute the label sub-command."""
    label_alt_text.label_from_suggestions_file(
        args.suggestions_file, args.output, args.skip_existing
    )


def _parse_args() -> argparse.Namespace:
    """Parse command-line arguments for all alt text workflows."""
    git_root = script_utils.get_git_root()

    parser = argparse.ArgumentParser(
        description="Alt text generation and labeling workflows"
    )
    subparsers = parser.add_subparsers(
        dest="command", help="Available commands"
    )

    # ---------------------------------------------------------------------------
    # scan sub-command
    # ---------------------------------------------------------------------------
    scan_parser = subparsers.add_parser(
        Command.SCAN,
        help="Scan markdown files for assets without meaningful alt text",
    )
    scan_parser.add_argument(
        "--root",
        type=Path,
        default=git_root / "website_content",
        help="Directory to search (default: website_content)",
    )
    scan_parser.add_argument(
        "--output",
        type=Path,
        help="Path for output JSON file (default: <git_root>/scripts/asset_queue.json)",
    )

    # ---------------------------------------------------------------------------
    # generate sub-command
    # ---------------------------------------------------------------------------
    generate_parser = subparsers.add_parser(
        Command.GENERATE, help="Generate AI alt text suggestions"
    )
    generate_parser.add_argument(
        "--root",
        type=Path,
        default=git_root / "website_content",
        help="Markdown root directory",
    )
    generate_parser.add_argument(
        "--model", required=True, help="LLM model to use for generation"
    )
    generate_parser.add_argument(
        "--max-chars",
        type=int,
        default=300,
        help="Max characters for generated alt text",
    )
    generate_parser.add_argument(
        "--timeout", type=int, default=120, help="LLM command timeout seconds"
    )
    generate_parser.add_argument(
        "--captions",
        type=Path,
        default=git_root / "scripts" / "asset_captions.json",
        help="Existing/final captions JSON path (used to skip existing unless --process-existing)",
    )
    generate_parser.add_argument(
        "--suggestions-file",
        type=Path,
        default=git_root / "scripts" / "suggested_alts.json",
        help="Path to read/write suggestions JSON",
    )
    generate_parser.add_argument(
        "--process-existing",
        dest="skip_existing",
        action="store_false",
        help="Also process assets that already have captions (default is to skip)",
    )
    generate_parser.add_argument(
        "--estimate-only",
        action="store_true",
        help="Only estimate cost without generating suggestions",
    )
    generate_parser.set_defaults(skip_existing=True)

    # ---------------------------------------------------------------------------
    # label sub-command
    # ---------------------------------------------------------------------------
    label_parser = subparsers.add_parser(
        Command.LABEL, help="Interactively label alt text suggestions"
    )
    label_parser.add_argument(
        "--suggestions-file",
        type=Path,
        default=git_root / "scripts" / "suggested_alts.json",
        help="Path to read suggestions JSON",
    )
    label_parser.add_argument(
        "--output",
        type=Path,
        default=git_root / "scripts" / "asset_captions.json",
        help="Final captions JSON path",
    )
    label_parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip captions already present in output file",
    )

    return parser.parse_args()


def main() -> None:
    """Main entry point for alt text workflows."""
    args = _parse_args()

    if args.command == Command.SCAN:
        _scan_command(args)
    elif args.command == Command.GENERATE:
        _generate_command(args)
    elif args.command == Command.LABEL:
        _label_command(args)
    else:
        raise ValueError(f"Invalid command: {args.command}")


if __name__ == "__main__":
    main()
