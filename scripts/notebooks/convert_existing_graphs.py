"""
Bulk-convert chart image references in ``website_content/`` into inline
``chart`` YAML blocks backed by CSV sidecars.

Pipeline
--------
1. Walk ``website_content/*.md`` and collect every ``![alt](url)`` image
   ref (line number + surrounding paragraph kept as context).
2. Ask a vision model: "is this image one of ``SUPPORTED_CHART_TYPES``?"
   (prompt concatenates the supported-types tuple, so adding ``bar`` or
   ``scatter`` to the renderer updates the classifier automatically).
3. For survivors, call ``chart_extract.async_extract_batch`` with a
   ``context_for`` callback that returns "alt text + surrounding prose"
   per image — the extractor prompt uses this to disambiguate axis and
   series labels.
4. Write one sibling ``<post>.proposed-replacements.md`` per affected
   post containing the original image ref and the proposed ```chart```
   block. These sidecars are git-ignored; the user diffs them against
   the real post and hand-merges.
5. Results go through ``chart_extract.write_results`` so re-runs resume
   from the same queue and skip URLs that already succeeded.
"""

from __future__ import annotations

import argparse
import asyncio
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

from scripts import chart_extract

# --------------------------------------------------------------------------- #
# Image-ref discovery                                                          #
# --------------------------------------------------------------------------- #

# Standard Markdown image ref: ``![alt](url)``. Alt text can be empty; URL is
# non-empty and stops at the first unescaped closing paren. Titles inside the
# parens (``(url "title")``) are rare on this site; we just strip whitespace
# from the URL side.
_IMAGE_REF_RE = re.compile(
    r"!\[(?P<alt>[^\]]*)\]\((?P<url>\S+?)(?:\s+\"[^\"]*\")?\)"
)

# Sidecars produced by this driver — always skip when walking.
_SIDECAR_SUFFIX = ".proposed-replacements.md"

# How many lines of surrounding prose to include as context.
_CONTEXT_WINDOW = 3


@dataclass(slots=True, frozen=True)
class ImageRef:
    """One Markdown image reference located on disk."""

    markdown_file: str
    url: str
    alt: str
    line_number: int  # 1-based
    context: str


def _paragraph_context(
    lines: Sequence[str], line_index: int, window: int = _CONTEXT_WINDOW
) -> str:
    """Return ``window`` lines above and below *line_index* (0-based)."""
    start = max(0, line_index - window)
    end = min(len(lines), line_index + window + 1)
    return "\n".join(lines[start:end]).strip()


def iter_image_refs(md_path: Path) -> Iterable[ImageRef]:
    """Yield every standard-Markdown image reference in *md_path*."""
    lines = md_path.read_text(encoding="utf-8").splitlines()
    for idx, line in enumerate(lines):
        for m in _IMAGE_REF_RE.finditer(line):
            yield ImageRef(
                markdown_file=str(md_path),
                url=m.group("url"),
                alt=m.group("alt"),
                line_number=idx + 1,
                context=_paragraph_context(lines, idx),
            )


def walk_content(root: Path) -> list[ImageRef]:
    """
    Collect image refs across every ``*.md`` under *root*.

    Skips the sidecar files this driver emits, so re-runs don't classify their
    own output as fresh charts.
    """
    refs: list[ImageRef] = []
    for md in sorted(root.rglob("*.md")):
        if md.name.endswith(_SIDECAR_SUFFIX):
            continue
        refs.extend(iter_image_refs(md))
    return refs


# --------------------------------------------------------------------------- #
# Classifier — vision model answers YES / NO                                   #
# --------------------------------------------------------------------------- #


def build_classifier_prompt(alt: str, context: str) -> str:
    """
    Prompt that asks whether an image is a chart the renderer handles.

    The supported-types list is injected from
    ``chart_extract.SUPPORTED_CHART_TYPES`` so adding a new renderer kind
    doesn't require editing this file.
    """
    types_csv = ", ".join(chart_extract.SUPPORTED_CHART_TYPES)
    return (
        "You are classifying a blog image. Answer with exactly YES or NO on "
        "the first line, nothing else.\n\n"
        f"Is this image a {types_csv} chart (a data-plot of those kinds)?\n"
        "Screenshots of UIs, headshots, diagrams without data, memes, and "
        "logos are all NO.\n\n"
        f"Alt text:\n{alt}\n\n"
        f"Surrounding prose:\n{context}"
    )


def _parse_yes_no(output: str) -> bool:
    """True iff *output*'s first non-empty line starts with YES."""
    for line in output.splitlines():
        stripped = line.strip()
        if stripped:
            return stripped.upper().startswith("YES")
    return False


def _classify_one(ref: ImageRef, model: str, timeout: int = 60) -> bool:
    """
    Run the classifier on a single image ref.

    Downloads URLs to a tempdir via the same helper
    ``chart_extract.extract_chart`` uses, so both passes share size caps
    and error messages.
    """
    llm = chart_extract._find_llm()
    with tempfile.TemporaryDirectory() as tmp:
        workspace = Path(tmp)
        local = (
            chart_extract._download(ref.url, workspace)
            if chart_extract._is_url(ref.url)
            else Path(ref.url)
        )
        proc = subprocess.run(
            [
                llm,
                "-m",
                model,
                "-a",
                str(local),
                build_classifier_prompt(ref.alt, ref.context),
            ],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        if proc.returncode != 0:
            raise RuntimeError(
                f"classifier failed on {ref.url}: {proc.stderr.strip()}"
            )
        return _parse_yes_no(proc.stdout)


async def classify_batch(
    refs: Sequence[ImageRef], model: str
) -> list[tuple[ImageRef, bool]]:
    """Classify *refs* concurrently; order matches input."""
    sem = asyncio.Semaphore(chart_extract._CONCURRENCY)

    async def _one(ref: ImageRef) -> tuple[ImageRef, bool]:
        async with sem:
            is_chart = await asyncio.to_thread(_classify_one, ref, model)
            return (ref, is_chart)

    return await asyncio.gather(*(_one(r) for r in refs))


# --------------------------------------------------------------------------- #
# Proposed-replacement sidecar writer                                          #
# --------------------------------------------------------------------------- #


def _sidecar_path(md_file: Path) -> Path:
    return md_file.with_name(md_file.stem + _SIDECAR_SUFFIX)


_ALT_TODO_PLACEHOLDER = "[TODO: describe this chart]"


def _provenanced_block(spec: dict, ref: ImageRef) -> str:
    """
    Inject ``alt`` and ``fallback`` into *spec* and re-serialize.

    The parser requires a non-empty ``alt``; if the original Markdown image
    had no alt text, fall back to the chart title or a TODO placeholder so
    the user notices and fills it in during hand-merge. ``fallback`` is
    always set to the original URL — "for future reference" per the spec.
    """
    enriched = {**spec}
    enriched["alt"] = ref.alt or spec.get("title") or _ALT_TODO_PLACEHOLDER
    enriched["fallback"] = ref.url
    return chart_extract.format_as_yaml_block(enriched)


def write_proposed_replacements(
    results: Sequence[chart_extract.ChartExtractionResult],
    refs_by_url: dict[str, ImageRef],
) -> list[Path]:
    """
    Group successful extractions by source markdown file and write one sidecar
    per file.

    Each replacement block carries the original alt text (injected into the
    spec as ``alt:``) and original image URL (injected as ``fallback:``) so
    the rendered chart is a11y-complete and the source is preserved even if
    the renderer ever fails to produce an SVG.

    Failures and orphans are skipped silently — they remain in the queue and
    surface on the next run.
    """
    by_file: dict[str, list[tuple[ImageRef, str]]] = {}
    for r in results:
        if r.error or not r.spec:
            continue
        ref = refs_by_url.get(r.source_image)
        if ref is None:
            continue
        by_file.setdefault(ref.markdown_file, []).append(
            (ref, _provenanced_block(r.spec, ref))
        )

    written: list[Path] = []
    for md_file, items in sorted(by_file.items()):
        items.sort(key=lambda t: t[0].line_number)
        sidecar = _sidecar_path(Path(md_file))
        sections = [f"<!-- proposed chart replacements for {md_file} -->\n"]
        for ref, block in items:
            sections.append(
                f"## line {ref.line_number}\n\n"
                f"Original:\n\n    ![{ref.alt}]({ref.url})\n\n"
                f"Replacement:\n\n{block}\n"
            )
        sidecar.write_text("\n".join(sections), encoding="utf-8")
        written.append(sidecar)
    return written


# --------------------------------------------------------------------------- #
# Orchestration                                                                #
# --------------------------------------------------------------------------- #


async def run(
    content_dir: Path,
    model: str,
    classifier: str,
    queue: Path,
    dry_run: bool = False,
) -> int:
    """
    Main pipeline.

    Returns the number of sidecar files written (0 for dry-run or an empty
    content dir).
    """
    refs = walk_content(content_dir)
    print(f"found {len(refs)} image refs under {content_dir}")

    done = chart_extract.load_existing(queue)
    fresh = [r for r in refs if chart_extract._normalize(r.url) not in done]
    print(f"{len(fresh)} fresh (after dedup against {queue})")
    if not fresh:
        return 0

    classified = await classify_batch(fresh, classifier)
    charts = [r for r, is_chart in classified if is_chart]
    print(f"{len(charts)} classified as charts by {classifier}")

    if dry_run:
        for r in charts:
            print(f"  {r.markdown_file}:{r.line_number}  {r.url}")
        return 0

    if not charts:
        return 0

    refs_by_url = {r.url: r for r in charts}

    def _context_for(source: str | Path) -> str | None:
        r = refs_by_url.get(str(source))
        if r is None:
            return None
        return f"Alt text: {r.alt}\n\nSurrounding prose:\n{r.context}"

    results = await chart_extract.async_extract_batch(
        [r.url for r in charts], model=model, context_for=_context_for
    )
    chart_extract.write_results(results, queue)

    sidecars = write_proposed_replacements(results, refs_by_url)
    for s in sidecars:
        print(f"wrote {s}")
    return len(sidecars)


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bulk-convert chart image refs to inline ```chart blocks."
    )
    parser.add_argument(
        "--content-dir",
        type=Path,
        default=Path("website_content"),
        help="Root of Markdown content to scan.",
    )
    parser.add_argument(
        "--model",
        default="claude-sonnet-4-6",
        help="Model used for chart extraction (`llm -m <model>`).",
    )
    parser.add_argument(
        "--classifier",
        default="claude-opus-4-7",
        help="Vision model used for chart-or-not classification.",
    )
    parser.add_argument(
        "--queue",
        type=Path,
        default=Path("chart-backfill-queue.json"),
        help="Resumable JSON work-queue (git-ignored).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Discover and classify, don't call the extractor.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    asyncio.run(
        run(
            args.content_dir,
            model=args.model,
            classifier=args.classifier,
            queue=args.queue,
            dry_run=args.dry_run,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
