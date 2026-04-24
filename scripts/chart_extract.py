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

import requests
import yaml
from rich.console import Console

# alt-text-llm imports tqdm the same way — matching its convention keeps the
# two tools visually consistent and silences the same experimental warning.
from tqdm.rich import tqdm
from tqdm.std import TqdmExperimentalWarning

warnings.filterwarnings("ignore", category=TqdmExperimentalWarning)

# Exported so drivers (e.g. scripts/notebooks/convert_existing_graphs.py)
# can construct a "is this image a chart we can handle?" prompt without
# duplicating the list. When we add "bar" or "scatter" support in the
# renderer, grow this tuple and everything downstream stays honest.
SUPPORTED_CHART_TYPES: tuple[str, ...] = ("line",)


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


# --------------------------------------------------------------------------- #
# Cost estimation — private to this script so the data stays co-located with  #
# the assumptions it depends on (prompt/output token sizes for chart extracts #
# are specific to this task, not shared with alt-text-llm).                   #
# --------------------------------------------------------------------------- #

_MODEL_COSTS: dict[str, dict[str, float]] = {
    "claude-sonnet-4-6": {"input": 0.003, "output": 0.015},
    "claude-opus-4-7": {"input": 0.015, "output": 0.075},
    "gemini-2.5-pro": {"input": 0.00125, "output": 0.01},
    "gemini-2.5-flash": {"input": 0.0003, "output": 0.0025},
    "gpt-5": {"input": 0.0025, "output": 0.01},
}


def estimate_cost(
    model: str, n: int, in_toks: int = 3000, out_toks: int = 800
) -> str:
    cost = _MODEL_COSTS.get(model.lower())
    if cost is None:
        return f"(no pricing known for {model})"
    total = n * (in_toks * cost["input"] + out_toks * cost["output"]) / 1000
    return f"~${total:.2f} estimated ({n} images × {model})"


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
    csv_path: str | None = None
    yaml_block: str | None = None
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


def _is_url(s: str | Path) -> bool:
    return isinstance(s, str) and s.startswith(("http://", "https://"))


# Chart images are tiny (AVIFs are a few hundred KB, PNGs a few MB). A 50 MB
# cap protects against a misdirected URL pointing at a huge file.
_DOWNLOAD_MAX_BYTES = 50 * 1024 * 1024


def _download(url: str, workspace: Path, timeout: int = 30) -> Path:
    """
    Stream *url* to a file under *workspace*.

    Propagates `requests` errors. Raises `ValueError` if the body exceeds
    `_DOWNLOAD_MAX_BYTES` — extract_chart catches and records this.
    """
    # Derive a local filename from the URL (strip query string).
    stem = Path(url.split("?", 1)[0]).name or "download.bin"
    target = workspace / stem
    # Minimal UA mirrors what alt_text_llm.utils.download_asset sends, so
    # CDNs that reject bare requests clients also accept ours.
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/91.0.4472.124 Safari/537.36"
        ),
    }
    resp = requests.get(url, timeout=timeout, stream=True, headers=headers)
    resp.raise_for_status()
    written = 0
    # `requests.iter_content` occasionally yields empty chunks for keep-alive;
    # `fh.write(b"")` is a no-op so we don't need a guard.
    with target.open("wb") as fh:
        for chunk in resp.iter_content(chunk_size=8192):
            written += len(chunk)
            if written > _DOWNLOAD_MAX_BYTES:
                raise ValueError(
                    f"download exceeded {_DOWNLOAD_MAX_BYTES // (1024 * 1024)} MB cap: {url}"
                )
            fh.write(chunk)
    return target


_VALIDATOR_TSX = Path(__file__).resolve().parent / "chart_spec_validator.ts"


def validate_spec_via_tsx(spec: dict, *, timeout: int = 30) -> str | None:
    """
    Round-trip *spec* through quartz's TypeScript `parseChartSpec`.

    Catches LLM hallucinations that pass the JSON schema but would fail at
    build time (e.g. unsupported chart type, malformed annotation). Returns
    ``None`` on success; the parser's error message on failure.

    Skipped silently (returns ``None``) if the TS toolchain (``npx`` / ``tsx``)
    isn't on PATH — makes the feature opt-in by availability, so users without
    Node installed aren't blocked from running ``chart_extract``.
    """
    # `tsx` via npx is what the repo already uses (see quartz/bootstrap-cli.ts
    # invocations in CLAUDE.md). Falling back to a bare `tsx` would also work
    # if someone globally installed it.
    runner = shutil.which("npx") or shutil.which("tsx")
    if runner is None or shutil.which("node") is None:
        return None

    yaml_text = yaml.dump(
        spec, sort_keys=False, allow_unicode=True, default_flow_style=False
    )
    cmd = (
        [runner, "tsx", str(_VALIDATOR_TSX)]
        if runner.endswith("npx")
        else [runner, str(_VALIDATOR_TSX)]
    )

    try:
        proc = subprocess.run(
            cmd,
            input=yaml_text,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        # Never raise out of here — extract_chart documents the "every failure
        # becomes result.error" contract; a hung tsx would kill the whole batch.
        return f"validator timed out after {timeout}s"
    if proc.returncode == 0:
        return None
    return (
        proc.stderr or proc.stdout
    ).strip() or "parseChartSpec rejected the spec"


def extract_chart(
    image: str | Path,
    model: str,
    context: str | None = None,
    timeout: int = 180,
) -> ChartExtractionResult:
    """
    Run `llm` once against *image* and return a `ChartExtractionResult`.

    *image* may be a local path OR an ``http(s)://`` URL; URLs are downloaded
    to a tempdir before being passed to the LLM. ``result.source_image``
    records the original URL/path so the queue keys dedupe stably.

    Contract: this function MUST NOT raise on per-image failures (bad AVIF,
    `llm` non-zero exit, timeout, unparseable JSON, download failures). Each
    of those is recorded in ``result.error`` and returned normally. Raising
    would cascade through ``asyncio.gather`` in ``async_extract_batch`` and
    kill the whole run — losing work on every successful image processed so
    far. Unexpected errors (e.g. ``KeyboardInterrupt``) still propagate.
    """

    result = ChartExtractionResult(
        source_image=str(image), model=model, context_used=context or ""
    )

    # tmpdir only needs to live as long as the `llm` subprocess — it holds the
    # downloaded image (if URL), converted PNG (if AVIF), and the JSON schema,
    # all of which the subprocess reads.
    with tempfile.TemporaryDirectory() as tmp:
        # Download URLs first; local paths pass through.
        if _is_url(image):
            try:
                local = _download(str(image), Path(tmp))
            except (requests.exceptions.RequestException, ValueError) as err:
                result.error = f"download failed: {err}"
                return result
        else:
            local = Path(image)

        try:
            prepared = _convert_if_avif(local, Path(tmp))
        except (
            subprocess.CalledProcessError,
            subprocess.TimeoutExpired,
            FileNotFoundError,
        ) as err:
            result.error = f"AVIF conversion failed: {err}"
            return result

        # Schema via tempfile rather than inline on argv: easier to eyeball
        # when debugging a failed `llm` invocation (re-run with the path).
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

    # Round-trip the LLM's spec through quartz's own parseChartSpec so a
    # hallucinated-but-schema-valid spec fails here, not mid-build. Skipped
    # transparently if the TS toolchain isn't available.
    validation_error = validate_spec_via_tsx(result.spec)
    if validation_error is not None:
        result.error = f"parseChartSpec rejected the spec: {validation_error}"
        return result

    # Persist outputs next to the source image (or into cwd for URL inputs —
    # the user controls where to stash them).
    if _is_url(image):
        stem = Path(str(image).split("?", 1)[0]).stem or "chart"
        csv_target = Path.cwd() / f"{stem}.csv"
    else:
        csv_target = Path(image).with_suffix(".csv")
    write_chart_csv(result.spec, csv_target)
    result.csv_path = str(csv_target)
    result.yaml_block = format_as_yaml_block(
        result.spec, csv_path=f"./{csv_target.name}"
    )
    return result


# --------------------------------------------------------------------------- #
# Async batch — same shape as alt-text-llm's `async_generate_suggestions`.     #
# --------------------------------------------------------------------------- #


# Lower than alt-text-llm's 32 because chart extractions generate much longer
# JSON outputs (hundreds of data points) and hit output-token rate limits first.
_CONCURRENCY = 8


async def _extract_one(
    image: str | Path,
    model: str,
    sem: asyncio.Semaphore,
    context: str | None = None,
) -> ChartExtractionResult:
    async with sem:
        return await asyncio.to_thread(extract_chart, image, model, context)


async def async_extract_batch(
    images: Sequence[str | Path],
    model: str,
    on_completed: Callable[[ChartExtractionResult], None] | None = None,
    context_for: Callable[[str | Path], str | None] | None = None,
) -> list[ChartExtractionResult]:
    """
    Extract *images* concurrently.

    If *on_completed* is supplied, it is called once per image as soon as that
    image's extraction finishes (in completion order, not submission order). The
    CLI wires this up to a tqdm progress bar; tests inject a list-append for
    observation. Results are returned in submission order.

    *context_for* is an optional callback that returns per-image prose to
    include in the LLM prompt — typically the image's alt text plus the
    surrounding paragraph, pulled by a caller like the
    ``convert_existing_graphs.py`` driver. Helps the model disambiguate axis
    labels and series names ("Unlearning" / "Retain set performance") that
    a bare chart image would be ambiguous about.
    """
    sem = asyncio.Semaphore(_CONCURRENCY)
    tasks = [
        asyncio.create_task(
            _extract_one(
                img, model, sem, context_for(img) if context_for else None
            )
        )
        for img in images
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


# Characters that would break the naive CSV round-trip with the TS-side
# parser (`quartz/plugins/transformers/charts/csv.ts`). The renderer
# rejects quoted fields loudly; keeping both sides consistent means we
# reject the same names at write time with a clearer message.
_FORBIDDEN_IN_SERIES_NAME = (",", '"', "\n", "\r")


def write_chart_csv(spec: dict, target: Path) -> None:
    """
    Write long-format CSV (`x,y,series`) for every point across every series.

    Chose long format over one-file-per-series: it's the shape notebooks
    produce by default (`df.to_csv()`), it's one artefact per chart, and
    the renderer can group by the `series` column at build time.
    """
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8") as fh:
        fh.write("x,y,series\n")
        for series in spec.get("series", []):
            name = series.get("name", "")
            for bad in _FORBIDDEN_IN_SERIES_NAME:
                if bad in name:
                    raise ValueError(
                        f"series name {name!r} contains {bad!r}; rename it — "
                        "the chart renderer rejects quoted CSV fields",
                    )
            for x, y in series.get("data", []):
                fh.write(f"{x},{y},{name}\n")


def format_as_yaml_block(spec: dict, csv_path: str | None = None) -> str:
    """
    Render a spec as a ```chart fenced block ready to paste into Markdown.

    When *csv_path* is provided, inline series data is stripped and replaced
    with a top-level ``data: <path>`` reference. When omitted, inline data
    is preserved (the old shape).
    """
    if csv_path is not None:
        spec = _without_inline_data(spec, csv_path)
    body = yaml.dump(
        spec,
        Dumper=_ChartYamlDumper,
        sort_keys=False,
        allow_unicode=True,
        width=100,
    )
    return f"```chart\n{body.rstrip()}\n```"


def _without_inline_data(spec: dict, csv_path: str) -> dict:
    """
    Return a copy of *spec* with series `data` fields removed and a top-level
    ``data`` field set to *csv_path*.

    Insertion order keeps
    ``data:`` right after ``type/title/axes`` so the block reads cleanly.
    """
    out: dict = {}
    for key, value in spec.items():
        out[key] = value
        if key == "y":  # insert `data:` right after the axes block
            out["data"] = csv_path
    if "data" not in out:
        out["data"] = csv_path
    out["series"] = [
        {k: v for k, v in s.items() if k != "data"}
        for s in spec.get("series", [])
    ]
    return out


# --------------------------------------------------------------------------- #
# CLI                                                                          #
# --------------------------------------------------------------------------- #


def _cli() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    # Keep as `str` so URLs pass through unchanged; `extract_chart` handles
    # URL vs path dispatch internally.
    parser.add_argument(
        "images",
        nargs="+",
        type=str,
        help="Chart image path(s) or http(s):// URL(s) to extract.",
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
    targets: list[str | Path] = [
        img if _is_url(img) else Path(img) for img in args.images
    ]
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
            console.print(f"\n# --- {r.source_image} ({r.csv_path}) ---")
            assert r.yaml_block is not None  # narrowed by the `ok` filter above
            console.print(r.yaml_block)

    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(_cli())
