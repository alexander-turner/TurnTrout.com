"""Shared utilities for alt text generation and labeling."""

import json
import subprocess
import sys
import textwrap
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable, Sequence
from urllib.parse import urlparse

import requests

# pylint: disable=C0413
sys.path.append(str(Path(__file__).parent.parent))

from scripts import scan_for_empty_alt
from scripts import utils as script_utils


def is_url(path: str) -> bool:
    """Check if path is a URL."""
    parsed = urlparse(path)
    return bool(parsed.scheme and parsed.netloc)


def _parse_paragraphs(
    lines: Sequence[str],
) -> tuple[list[list[str]], list[int]]:
    """Parse lines into paragraphs and their start indices."""
    paragraphs: list[list[str]] = []
    paragraph_starts: list[int] = []
    current: list[str] = []

    for idx, line in enumerate(lines):
        if line.strip() == "":
            if current:
                paragraphs.append(current)
                paragraph_starts.append(idx - len(current))
                current = []
        else:
            current.append(line.rstrip("\n"))

    if current:
        paragraphs.append(current)
        paragraph_starts.append(len(lines) - len(current))

    return paragraphs, paragraph_starts


def _find_target_paragraph(
    lines: Sequence[str],
    target_idx: int,
    paragraphs: list[list[str]],
    paragraph_starts: list[int],
) -> int | None:
    """Find the paragraph index for the target line."""
    selected_line = lines[target_idx] if target_idx < len(lines) else ""

    if selected_line.strip() != "":
        selected_stripped = selected_line.rstrip("\n")
        for i, paragraph in enumerate(paragraphs):
            if selected_stripped in paragraph:
                return i
    else:
        for i, start in enumerate(paragraph_starts):
            if start > target_idx:
                return i
    return None


def paragraph_context(
    lines: Sequence[str],
    target_idx: int,
    max_before: int | None = None,
    max_after: int = 2,
) -> str:
    """
    Return a slice of text around *target_idx* in **paragraph** units.

    A *paragraph* is any non-empty run of lines separated by at least one blank
    line.  The returned snippet includes:

    • Up to *max_before* paragraphs **before** the target paragraph.
      – ``None`` means *unlimited* (all preceding paragraphs).
      – ``0`` means *no* paragraphs before the target.
    • The target paragraph itself.
    • Up to *max_after* paragraphs **after** the target paragraph (``0`` means
      none).

    If *target_idx* is located on a blank line, the function treats the **next**
    paragraph as the target.  Requests that are out-of-bounds or that point
    past the last paragraph return an empty string instead of raising.  The
    original line formatting (including Markdown, punctuation, etc.) is
    preserved.
    """
    if (
        target_idx < 0
        or (max_before is not None and max_before < 0)
        or max_after < 0
    ):  # pragma: no cover
        raise ValueError(
            f"{target_idx=}, {max_before=}, and {max_after=} must be non-negative"
        )

    paragraphs, paragraph_starts = _parse_paragraphs(lines)
    par_idx = _find_target_paragraph(
        lines, target_idx, paragraphs, paragraph_starts
    )

    if par_idx is None:
        return ""

    if max_before is None:
        start_idx = 0
    elif max_before == 0:
        start_idx = par_idx
    else:
        start_idx = max(0, par_idx - max_before)

    end_idx = min(len(paragraphs), par_idx + max_after + 1)

    snippet_lines: list[str] = []
    for para in paragraphs[start_idx:end_idx]:
        snippet_lines.extend(para)
        snippet_lines.append("")

    return "\n".join(snippet_lines).strip()


@dataclass(slots=True)
class AltGenerationResult:
    """Container for AI-generated alt text suggestions."""

    markdown_file: str
    asset_path: str
    suggested_alt: str
    model: str
    context_snippet: str
    line_number: int
    final_alt: str | None = None

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


def download_asset(
    queue_item: scan_for_empty_alt.QueueItem, workspace: Path
) -> Path:
    """Download or locate asset file, returning path to accessible copy."""
    asset_path = queue_item.asset_path

    if is_url(asset_path):
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


def generate_article_context(
    queue_item: scan_for_empty_alt.QueueItem,
    max_before: int | None = None,
    max_after: int = 2,
    trim_frontmatter: bool = False,
) -> str:
    """Generate context with all preceding paragraphs and 2 after for LLM
    prompts."""
    markdown_path = Path(queue_item.markdown_file)
    source_text = markdown_path.read_text(encoding="utf-8")
    source_lines = source_text.splitlines()

    # Convert from 1-based line number to 0-based index
    line_number_to_pass = queue_item.line_number - 1
    lines_to_show = source_lines

    if trim_frontmatter:
        # Try to split YAML frontmatter and get content only
        _, split_content = script_utils.split_yaml(
            markdown_path, verbose=False
        )

        # If frontmatter found, use content without frontmatter
        if split_content.strip():
            lines_to_show = split_content.splitlines()
            num_frontmatter_lines = len(source_lines) - len(lines_to_show)
            line_number_to_pass = (
                queue_item.line_number - 1 - num_frontmatter_lines
            )

    return paragraph_context(
        lines_to_show,
        line_number_to_pass,
        max_before=max_before,
        max_after=max_after,
    )


def build_prompt(
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

    article_context = generate_article_context(
        queue_item, trim_frontmatter=False
    )
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
        - Don't describe purely visual elements unless directly relevant for
        understanding the content (e.g. don't say "the line in this scientific chart is green")
        - Describe spatial relationships and visual hierarchy when important

        Prioritize completeness over brevity - include both textual content and visual description as needed. 
        While thinking quietly, propose a candidate alt text. Then critique the candidate alt text—
        does it accurately describe the information the image is meant to convey? 
        Incorporate the critique into the alt text to improve it. Only output the improved alt text.
        """
    ).strip()

    return f"{base_prompt}\n{main_prompt}"


def load_existing_captions(captions_path: Path) -> set[str]:
    """Load existing asset paths from captions file."""
    try:
        with open(captions_path, encoding="utf-8") as f:
            data = json.load(f)
        return {item["asset_path"] for item in data if "asset_path" in item}
    except (FileNotFoundError, json.JSONDecodeError, KeyError, TypeError):
        return set()


def write_output(
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
