"""
Extract chart data from an image into a ``chart`` YAML block.

Takes an image of a chart (the kind the blog embeds as AVIF) and emits the
YAML spec consumed by the `Charts` transformer (`quartz/plugins/transformers/
charts.ts`). Drop the output into a Markdown file between ```` ```chart ```` /
```` ``` ```` fences and the build-time renderer does the rest.

Model-swap story
----------------
Following the ``alt-text-llm`` pattern, we shell out to the ``llm`` CLI
(Simon Willison's, https://llm.datasette.io) with ``-m <model>``. Any model
``llm`` knows about — Claude, Gemini, GPT, local Ollama — works via a single
flag. No SDK pinning, no ``if model.startswith(...)`` branches.

Prompts and schema come from ChartGemma's published "chart-to-table"
formulation: ask for a structured table, force the output to a JSON schema
mirroring ``quartz/plugins/transformers/charts/types.ts``. Output is not
yet round-tripped through ``parseChartSpec`` — that validation is a TODO
(requires invoking Node/tsx from Python, deferred until real backfill
surfaces hallucination patterns worth catching).

Resumability, AVIF conversion, concurrency, and the JSON work-queue format
follow ``alt-text-llm`` so operators reading both scripts see the same shape.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import subprocess
import sys
import tempfile
import textwrap
import warnings
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, Sequence

import yaml
from rich.console import Console

# alt-text-llm imports tqdm the same way — matching its convention keeps the
# two tools visually consistent and silences the same experimental warning.
from tqdm.rich import tqdm
from tqdm.std import TqdmExperimentalWarning

warnings.filterwarnings("ignore", category=TqdmExperimentalWarning)

# --------------------------------------------------------------------------- #
# JSON Schema — mirrors `quartz/plugins/transformers/charts/types.ts`.        #
# Keep the shape in sync; `parseChartSpec` is the authoritative validator.    #
# --------------------------------------------------------------------------- #

CHART_SCHEMA: dict = {
    "type": "object",
    "required": ["type", "x", "y", "series"],
    "properties": {
        "type": {"const": "line"},
        "title": {"type": "string"},
        "x": {"$ref": "#/$defs/axis"},
        "y": {"$ref": "#/$defs/axis"},
        "series": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "required": ["name", "data"],
                "properties": {
                    "name": {"type": "string"},
                    "color": {"type": "string"},
                    "data": {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                            "type": "array",
                            "items": {"type": "number"},
                            "minItems": 2,
                            "maxItems": 2,
                        },
                    },
                },
            },
        },
        "annotations": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["type", "value"],
                "properties": {
                    "type": {"const": "horizontal-line"},
                    "value": {"type": "number"},
                    "label": {"type": "string"},
                    "style": {"enum": ["solid", "dashed"]},
                },
            },
        },
    },
    "$defs": {
        "axis": {
            "type": "object",
            "required": ["label"],
            "properties": {
                "label": {"type": "string"},
                "scale": {"enum": ["linear", "log"]},
                "min": {"type": "number"},
            },
        },
    },
}

# --------------------------------------------------------------------------- #
# Prompt — adapted from ChartGemma's chart-to-table formulation.              #
# --------------------------------------------------------------------------- #


def build_chart_prompt(context: str | None = None) -> str:
    base = textwrap.dedent("""
        Extract the underlying data from this chart into a structured JSON object.

        Transcribe exactly what the chart shows. Do not round, do not fabricate
        points the axes don't clearly display, do not invent series labels. If
        a value is unreadable, omit the point rather than guess.

        Required:
        - Identify the chart type (only "line" is supported for now).
        - Read every marked data point for each series, in the axis units shown.
        - Preserve exact axis labels verbatim, including units and casing.
        - Record any horizontal reference lines as annotations.
        - Detect log scale from visual tick spacing (decade steps) and report it.

        Self-check before returning:
        - Do series names match the legend text, verbatim?
        - Does the first/last point of each series match the visible start/end?
        - Are log-scale axes flagged? If yes, are all values strictly positive?

        Return only the JSON object that matches the provided schema.
        """).strip()

    if context:
        return f"{base}\n\nSurrounding prose (for disambiguating labels):\n{context}"
    return base


# Reuse alt-text-llm's cost estimator so both tools report the same way.
# Extend the shared dict with Claude/GPT entries it doesn't ship with — safe
# to mutate at import time since alt-text-llm reads via `.get()`.
from alt_text_llm.generate import MODEL_COSTS, estimate_cost  # noqa: E402

MODEL_COSTS.update(
    {
        "claude-sonnet-4-6": {"input": 0.003, "output": 0.015},
        "claude-opus-4-7": {"input": 0.015, "output": 0.075},
        "gpt-5": {"input": 0.0025, "output": 0.01},
    }
)


# --------------------------------------------------------------------------- #
# Core extraction — single invocation of the `llm` CLI.                        #
# --------------------------------------------------------------------------- #


@dataclass(slots=True)
class ChartExtractionResult:
    """
    One chart image → one structured result.

    Mirrors `AltGenerationResult`.
    """

    source_image: str
    model: str
    spec: dict | None = None
    error: str | None = None
    raw_output: str = ""
    context_used: str = ""

    def to_json(self) -> dict:
        return asdict(self)


def _find_llm() -> str:
    path = shutil.which("llm")
    if not path:
        raise FileNotFoundError(
            "The `llm` CLI is not on PATH. Install via `uv tool install llm` "
            "and configure a model plugin (e.g. `llm install llm-anthropic`)."
        )
    return path


def _convert_if_avif(image: Path, workspace: Path) -> Path:
    """
    LLM backends reject AVIF; convert to PNG in a tempdir.

    Same as alt-text-llm.
    """
    if image.suffix.lower() != ".avif":
        return image
    magick = shutil.which("magick")
    if not magick:
        raise FileNotFoundError(
            "`magick` not on PATH; install ImageMagick to process AVIF inputs."
        )
    png = workspace / f"{image.stem}.png"
    subprocess.run(
        [magick, str(image), str(png)],
        check=True,
        capture_output=True,
        timeout=30,
    )
    return png


def extract_chart(
    image: Path,
    model: str,
    context: str | None = None,
    timeout: int = 180,
) -> ChartExtractionResult:
    """
    Run `llm` once against *image* and return a `ChartExtractionResult`.

    Contract: this function MUST NOT raise on per-image failures (bad AVIF,
    `llm` non-zero exit, timeout, unparseable JSON). Each of those is
    recorded in ``result.error`` and returned normally. Raising would
    cascade through ``asyncio.gather`` in ``async_extract_batch`` and kill
    the whole run — losing work on every successful image processed so far.
    Unexpected errors (e.g. ``KeyboardInterrupt``) still propagate.
    """

    result = ChartExtractionResult(
        source_image=str(image), model=model, context_used=context or ""
    )

    with tempfile.TemporaryDirectory() as tmp:
        try:
            prepared = _convert_if_avif(image, Path(tmp))
        except (
            subprocess.CalledProcessError,
            subprocess.TimeoutExpired,
            FileNotFoundError,
        ) as err:
            result.error = f"AVIF conversion failed: {err}"
            return result

        # Pass the JSON schema via a tempfile rather than inline on argv:
        # it's ~1KB today and growing, and a path is easier to eyeball when
        # debugging a failed `llm` invocation (just re-run with the printed path).
        schema_file = Path(tmp) / "schema.json"
        schema_file.write_text(json.dumps(CHART_SCHEMA), encoding="utf-8")

        try:
            proc = subprocess.run(
                [
                    _find_llm(),
                    "-m",
                    model,
                    "-a",
                    str(prepared),
                    "--schema",
                    str(schema_file),
                    build_chart_prompt(context),
                ],
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired:
            result.error = f"llm timeout after {timeout}s"
            return result

        result.raw_output = proc.stdout

        if proc.returncode != 0:
            result.error = (proc.stderr or proc.stdout).strip()
            return result

        try:
            result.spec = json.loads(proc.stdout)
        except json.JSONDecodeError as err:
            result.error = f"invalid JSON from model: {err}"

    return result


# --------------------------------------------------------------------------- #
# Async batch — same shape as alt-text-llm's `async_generate_suggestions`.     #
# --------------------------------------------------------------------------- #


# Lower than alt-text-llm's 32 because chart extractions generate much longer
# JSON outputs (hundreds of data points) and hit output-token rate limits first.
_CONCURRENCY = 8


async def _extract_one(
    image: Path, model: str, sem: asyncio.Semaphore
) -> ChartExtractionResult:
    async with sem:
        return await asyncio.to_thread(extract_chart, image, model)


async def async_extract_batch(
    images: Sequence[Path],
    model: str,
    on_completed: Callable[[ChartExtractionResult], None] | None = None,
) -> list[ChartExtractionResult]:
    """
    Extract *images* concurrently.

    If *on_completed* is supplied, it is called once per image as soon as that
    image's extraction finishes (in completion order, not submission order). The
    CLI wires this up to a tqdm progress bar; tests inject a list-append for
    observation. Results are returned in submission order.
    """
    sem = asyncio.Semaphore(_CONCURRENCY)
    tasks = [
        asyncio.create_task(_extract_one(img, model, sem)) for img in images
    ]

    if on_completed is not None:
        for finished in asyncio.as_completed(tasks):
            on_completed(await finished)

    return await asyncio.gather(*tasks)


# --------------------------------------------------------------------------- #
# Output — JSON work-queue (resumable) + YAML chart block for pasting.         #
# --------------------------------------------------------------------------- #


def _normalize(path: str | Path) -> str:
    """
    Canonicalize paths so ``./x`` and ``x`` dedupe as the same work-item.

    Pass URLs through unchanged — ``Path.resolve()`` would mangle
    ``https://foo.avif`` into ``/cwd/https:/foo.avif``.
    """
    s = str(path)
    if s.startswith(("http://", "https://")):
        return s
    return str(Path(s).expanduser().resolve())


def load_existing(output: Path) -> set[str]:
    """Return the normalized paths of images already *successfully*
    extracted."""
    try:
        data = json.loads(output.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()
    return {
        _normalize(item["source_image"]) for item in data if item.get("spec")
    }


def write_results(
    results: Sequence[ChartExtractionResult], output: Path, append: bool = True
) -> None:
    """
    Merge *results* into *output*, keyed by source image (latest attempt wins).

    Without deduping, failing items would be re-appended on every retry.
    """
    merged: dict[str, dict] = {}
    if append and output.exists():
        try:
            existing = json.loads(output.read_text(encoding="utf-8"))
            if isinstance(existing, list):
                for item in existing:
                    src = item.get("source_image")
                    if src:
                        merged[_normalize(src)] = item
        except json.JSONDecodeError:
            pass
    for r in results:
        merged[_normalize(r.source_image)] = r.to_json()
    output.write_text(
        json.dumps(list(merged.values()), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


class _ChartYamlDumper(yaml.SafeDumper):
    """
    Dumper that keeps ``[x, y]`` data points on one line to match how.

    authors write them by hand (see ``website_content/layer-horizon.md``).
    Default block-style would produce ``- - 0 / - 8.92`` per point — ugly
    and hard to skim during review.
    """


def _represent_point(dumper: yaml.SafeDumper, data: list) -> yaml.Node:
    if len(data) == 2 and all(isinstance(v, (int, float)) for v in data):
        return dumper.represent_sequence(
            "tag:yaml.org,2002:seq", data, flow_style=True
        )
    return dumper.represent_sequence("tag:yaml.org,2002:seq", data)


_ChartYamlDumper.add_representer(list, _represent_point)


def format_as_yaml_block(spec: dict) -> str:
    """Render a spec as a ```chart fenced block ready to paste into Markdown."""
    body = yaml.dump(
        spec,
        Dumper=_ChartYamlDumper,
        sort_keys=False,
        allow_unicode=True,
        width=100,
    )
    return f"```chart\n{body.rstrip()}\n```"


# --------------------------------------------------------------------------- #
# CLI                                                                          #
# --------------------------------------------------------------------------- #


def _cli() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "images", nargs="+", type=Path, help="Chart image(s) to extract."
    )
    parser.add_argument(
        "-m",
        "--model",
        default="claude-sonnet-4-6",
        help="Any model name `llm` knows about. Swap freely.",
    )
    parser.add_argument(
        "-o", "--output", type=Path, default=Path("chart-queue.json")
    )
    parser.add_argument("--no-skip-existing", action="store_true")
    parser.add_argument(
        "--print-yaml",
        action="store_true",
        help="Print the ```chart block for each success on stdout.",
    )
    args = parser.parse_args()

    console = Console()
    targets: list[Path] = list(args.images)
    if not args.no_skip_existing:
        done = load_existing(args.output)
        targets = [p for p in targets if _normalize(p) not in done]
        if len(targets) < len(args.images):
            console.print(
                f"[dim]Skipping {len(args.images) - len(targets)} already-extracted images.[/dim]"
            )

    if not targets:
        console.print("Nothing to do.")
        return 0

    console.print(f"[bold]{estimate_cost(args.model, len(targets))}[/bold]")

    with tqdm(total=len(targets), desc="Extracting charts") as bar:
        results = asyncio.run(
            async_extract_batch(
                targets,
                args.model,
                on_completed=lambda _r: bar.update(1),
            )
        )
    write_results(results, args.output)

    ok = [r for r in results if r.spec]
    failed = [r for r in results if not r.spec]
    console.print(
        f"[green]{len(ok)} succeeded[/green], [red]{len(failed)} failed[/red]"
    )

    if args.print_yaml:
        for r in ok:
            console.print(f"\n# --- {r.source_image} ---")
            assert r.spec is not None  # narrowed by the `ok` filter above
            console.print(format_as_yaml_block(r.spec))

    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(_cli())
