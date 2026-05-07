"""
Invert-in-dark-mode classification: interactive UI + Markdown scanner.

Two ways to populate ``.invert_labels.json``:

1. Interactive (default): ``uv run scripts/label_invert.py``
   Serves a Flask grid where each image previews under the actual
   dark-mode filter for its current state (grayscale for unlabeled /
   don't-invert; inverted+screen for invert). Pick a radio per card,
   or click "Confirm visible as reviewed" to bulk-confirm auto-labels.
   On startup the server fetches each candidate's mean grayscale
   luminance, caches it to ``.invert_luminance.json``, and auto-labels
   every unlabeled image with ``reviewed=false`` (luminance >= 0.7
   gets ``invert=true``, otherwise ``invert=false``).

2. Non-interactive: ``uv run scripts/label_invert.py --apply-annotations``
   Walks ``website_content/*.md`` for image references followed by
   ``{.invert-on-dark}`` or ``{.no-invert-on-dark}`` annotations,
   records them in the JSON (with ``reviewed=true``), and strips the
   annotation from the markdown. Mutates both the JSON and the
   markdown files in place.

Labels file shape: ``{url: {invert: bool, reviewed: bool}}``. Missing
keys are unlabeled. The build-time Quartz plugin only adds the
``invert-in-dark-mode`` class when ``invert`` is true. The built-site
check requires ``reviewed: true`` for every AVIF on the rendered site.
"""

from __future__ import annotations

import argparse
import io
import json
import logging
import os
import re
import sys
import tempfile
import threading
import webbrowser
from collections.abc import Callable, Iterable, Mapping
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Final, TypedDict

import numpy as np
import requests
from flask import Flask, Response, abort, jsonify, render_template, request
from PIL import Image

logger = logging.getLogger(__name__)

PROJECT_ROOT: Final[Path] = Path(__file__).resolve().parent.parent
TRANSFORMERS_DIR: Final[Path] = (
    PROJECT_ROOT / "quartz" / "plugins" / "transformers"
)
DIMENSIONS_JSON: Final[Path] = TRANSFORMERS_DIR / ".asset_dimensions.json"
LABELS_JSON: Final[Path] = TRANSFORMERS_DIR / ".invert_labels.json"
LUMINANCE_JSON: Final[Path] = TRANSFORMERS_DIR / ".invert_luminance.json"
CONTENT_DIR: Final[Path] = PROJECT_ROOT / "website_content"

# Mean grayscale luminance (0..1) above which an unlabeled image is
# auto-classified as "should invert in dark mode" — the dominant signal
# for the chart-on-white-background case the labeling tool is built for.
LUMINANCE_INVERT_THRESHOLD: Final[float] = 0.7

# Tuples (not sets) so we can pass directly to ``str.endswith``.
RASTER_EXTENSIONS: Final[tuple[str, ...]] = (
    ".avif",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
)
# Video extensions for inline looping muted videos (GIF-replacements).
# Each format is its own URL on R2; the rendered ``<video>`` tries each
# ``<source>`` in order, but we ask the labeler for a verdict per URL.
VIDEO_EXTENSIONS: Final[tuple[str, ...]] = (".mp4", ".webm", ".mov")
LABELABLE_EXTENSIONS: Final[tuple[str, ...]] = (
    RASTER_EXTENSIONS + VIDEO_EXTENSIONS
)
EXCLUDED_SEGMENTS: Final[frozenset[str]] = frozenset(
    {
        "external-favicons",
        "twemoji",
        "turntrout-favicons",
        "card_images",
        "avatars",
    }
)

# Matches `![alt](url){.invert-on-dark}` or the no-invert variant.
# `url` is the captured target; `decision` is true/false.
_ANNOTATION_RE: Final[re.Pattern[str]] = re.compile(
    r"!\[[^\]]*\]\((?P<url>[^)\s]+)(?:\s+\"[^\"]*\")?\)"
    r"\{\.(?P<klass>no-invert-on-dark|invert-on-dark)\}",
)


# --- candidate enumeration ---------------------------------------------------


def _is_candidate(url: str) -> bool:
    if not url.startswith(("http://", "https://")):
        return False
    if not url.lower().endswith(LABELABLE_EXTENSIONS):
        return False
    segments = url.split("?", 1)[0].split("/")
    return not any(seg in EXCLUDED_SEGMENTS for seg in segments)


def is_video_url(url: str) -> bool:
    """True iff ``url`` ends with a labeled-video extension."""
    return url.lower().endswith(VIDEO_EXTENSIONS)


def enumerate_candidates(dimensions: Iterable[str]) -> tuple[str, ...]:
    """Sorted, deduplicated raster content image URLs."""
    return tuple(sorted({u for u in dimensions if _is_candidate(u)}))


# --- labels JSON I/O ---------------------------------------------------------


class Label(TypedDict):
    """
    One label entry: a verdict + whether the user has confirmed it.

    ``invert`` is the dark-mode decision the build pipeline reads; ``reviewed``
    is True iff a human has explicitly confirmed (or set) the verdict. Auto-
    labels (e.g. luminance heuristic) write ``reviewed: False``.
    """

    invert: bool
    reviewed: bool


def _atomic_write_json(data: object, path: Path) -> None:
    """
    Atomically write ``data`` to ``path`` as pretty-printed JSON.

    Creates parent directories as needed and uses ``os.replace`` for atomic
    rename. Any failure deletes the partial tempfile before re-raising.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=path.name + ".", suffix=".tmp", dir=str(path.parent)
    )
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        os.replace(tmp, path)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise


_REQUIRED_LABEL_KEYS: Final[frozenset[str]] = frozenset({"invert", "reviewed"})


def load_labels(path: Path = LABELS_JSON) -> dict[str, Label]:
    """
    Load ``{url: {invert, reviewed}}`` labels (empty if missing).

    Both ``invert`` and ``reviewed`` are required; missing keys raise
    ``ValueError`` rather than defaulting silently, so a corrupted or partially-
    migrated file fails loudly.
    """
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object")
    out: dict[str, Label] = {}
    for key, value in data.items():
        if not isinstance(value, dict) or _REQUIRED_LABEL_KEYS - value.keys():
            raise ValueError(
                f"{path} entry for {key!r} must be "
                "{invert: bool, reviewed: bool}"
            )
        out[str(key)] = Label(
            invert=bool(value["invert"]),
            reviewed=bool(value["reviewed"]),
        )
    return out


def save_labels(labels: Mapping[str, Label], path: Path = LABELS_JSON) -> None:
    """Atomically write the labels JSON, sorted by URL."""
    sorted_labels = {k: dict(v) for k, v in sorted(labels.items())}
    _atomic_write_json(sorted_labels, path)


def set_user_label(
    labels: dict[str, Label], url: str, decision: bool | None
) -> None:
    """Apply a user decision: ``True``/``False`` set the verdict and mark
    reviewed=True; ``None`` clears the entry entirely."""
    if decision is None:
        labels.pop(url, None)
    else:
        labels[url] = Label(invert=decision, reviewed=True)


def mark_reviewed(labels: dict[str, Label], url: str) -> bool:
    """
    Mark an existing label as user-reviewed without changing the verdict.

    Returns True if the entry existed and was updated, False otherwise.
    """
    if url not in labels:
        return False
    if labels[url]["reviewed"]:
        return False
    labels[url] = Label(invert=labels[url]["invert"], reviewed=True)
    return True


# --- markdown scanner --------------------------------------------------------


@dataclass(frozen=True)
class AnnotationApplyResult:
    """Outcome of applying markdown annotations."""

    files_modified: tuple[Path, ...]
    decisions: tuple[tuple[str, bool], ...]


def _decision_from_class(klass: str) -> bool:
    return klass == "invert-on-dark"


def apply_markdown_annotations(
    content_dir: Path = CONTENT_DIR,
    *,
    labels_path: Path = LABELS_JSON,
) -> AnnotationApplyResult:
    """Find ``{.invert-on-dark}``/``{.no-invert-on-dark}`` annotations, record
    decisions in the labels JSON, and strip the annotations from the source
    markdown."""
    labels = load_labels(labels_path)
    decisions: list[tuple[str, bool]] = []
    modified: list[Path] = []
    for md_path in sorted(content_dir.rglob("*.md")):
        original = md_path.read_text(encoding="utf-8")
        new_text, file_decisions = _process_markdown(original)
        if file_decisions:
            decisions.extend(file_decisions)
            for url, decision in file_decisions:
                set_user_label(labels, url, decision)
        if new_text != original:
            md_path.write_text(new_text, encoding="utf-8")
            modified.append(md_path)
    if decisions:
        save_labels(labels, labels_path)
    return AnnotationApplyResult(tuple(modified), tuple(decisions))


def _process_markdown(text: str) -> tuple[str, list[tuple[str, bool]]]:
    decisions: list[tuple[str, bool]] = []

    def replace(match: re.Match[str]) -> str:
        decisions.append(
            (match.group("url"), _decision_from_class(match.group("klass")))
        )
        # Drop only the trailing `{.invert-on-dark}` token, leaving the
        # image syntax intact.
        return match.group(0).rsplit("{", 1)[0]

    new_text = _ANNOTATION_RE.sub(replace, text)
    return new_text, decisions


# --- luminance ---------------------------------------------------------------


FetchFn = Callable[[str], bytes]


def _default_fetch(url: str, *, timeout: float = 15.0) -> bytes:
    response = requests.get(url, timeout=timeout)
    response.raise_for_status()
    return response.content


def compute_luminance(image_bytes: bytes) -> float:
    """Mean grayscale luminance of ``image_bytes`` in [0, 1]."""
    with Image.open(io.BytesIO(image_bytes)) as img:
        gray = img.convert("L")
        return float(np.asarray(gray, dtype=np.float32).mean()) / 255.0


def load_luminances(path: Path = LUMINANCE_JSON) -> dict[str, float]:
    """Load cached ``{url: luminance}`` (empty if missing)."""
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return {str(k): float(v) for k, v in data.items()}


def save_luminances(
    luminances: Mapping[str, float], path: Path = LUMINANCE_JSON
) -> None:
    """Atomically write the luminance cache, sorted by URL."""
    _atomic_write_json(dict(sorted(luminances.items())), path)


def ensure_luminances(
    candidates: Iterable[str],
    *,
    cache_path: Path = LUMINANCE_JSON,
    fetch: FetchFn | None = None,
    max_workers: int = 8,
) -> dict[str, float]:
    """
    Return luminance per URL, computing+caching any missing entries.

    Videos are skipped — extracting a frame would require ffmpeg and the user
    has to label them by hand anyway.
    """
    cache = load_luminances(cache_path)
    missing = [u for u in candidates if u not in cache and not is_video_url(u)]
    if not missing:
        return cache

    fetch_fn: FetchFn = fetch if fetch is not None else _default_fetch

    def _one(url: str) -> tuple[str, float | None]:
        try:
            return url, compute_luminance(fetch_fn(url))
        except (OSError, ValueError) as exc:
            logger.warning("luminance failed for %s: %s", url, exc)
            return url, None

    logger.info("Computing luminance for %d images...", len(missing))
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        for future in as_completed(ex.submit(_one, u) for u in missing):
            url, lum = future.result()
            if lum is not None:
                cache[url] = lum
    save_luminances(cache, cache_path)
    return cache


def autolabel_by_luminance(
    candidates: Iterable[str],
    luminances: Mapping[str, float],
    *,
    labels_path: Path = LABELS_JSON,
    threshold: float = LUMINANCE_INVERT_THRESHOLD,
) -> dict[str, bool]:
    """
    Auto-label unlabeled images by their grayscale luminance.

    Each unlabeled URL whose luminance is known is recorded as
    ``True`` (invert) when ``luminance >= threshold`` and ``False``
    (don't invert) otherwise. URLs without a luminance entry stay
    unlabeled. Already-labeled URLs are never overridden.

    Returns ``{url: decision}`` for the newly-labeled URLs.
    """
    labels = load_labels(labels_path)
    newly_labeled: dict[str, bool] = {}
    for url in candidates:
        if url in labels:
            continue
        lum = luminances.get(url)
        if lum is None:
            continue
        decision = lum >= threshold
        labels[url] = Label(invert=decision, reviewed=False)
        newly_labeled[url] = decision
    if newly_labeled:
        save_labels(labels, labels_path)
    return newly_labeled


# --- Flask app ---------------------------------------------------------------


_DECISION_PARAM: Final[Mapping[str, bool | None]] = {
    "invert": True,
    "no-invert": False,
    "unlabeled": None,
}


def create_app(
    candidates: tuple[str, ...],
    *,
    labels_path: Path = LABELS_JSON,
    luminances: Mapping[str, float] | None = None,
) -> Flask:
    """Build the labeling Flask app."""
    app = Flask(__name__, template_folder="templates")
    candidate_set = frozenset(candidates)
    lum_map: Mapping[str, float] = luminances or {}

    @app.get("/")
    def index() -> str:
        labels = load_labels(labels_path)
        return render_template(
            "invert_labeler.html",
            candidates=candidates,
            labels=labels,
            luminances=lum_map,
            luminance_threshold=LUMINANCE_INVERT_THRESHOLD,
            is_video_url=is_video_url,
            invert_count=sum(
                1 for u in candidates if u in labels and labels[u]["invert"]
            ),
            unreviewed_count=sum(
                1
                for u in candidates
                if u in labels and not labels[u]["reviewed"]
            ),
        )

    @app.get("/api/labels")
    def get_labels() -> Response:
        return jsonify(load_labels(labels_path))

    @app.post("/api/label")
    def post_label() -> Response:
        payload = request.get_json(silent=True) or {}
        url = payload.get("url")
        state = payload.get("state")
        if (
            not isinstance(url, str)
            or not isinstance(state, str)
            or state not in _DECISION_PARAM
        ):
            abort(
                400,
                "body must be {url: str, state: 'invert'|'no-invert'|'unlabeled'}",
            )
        if url not in candidate_set:
            abort(400, f"Unknown candidate URL: {url}")
        labels = load_labels(labels_path)
        set_user_label(labels, url, _DECISION_PARAM[state])
        save_labels(labels, labels_path)
        return jsonify(ok=True)

    @app.post("/api/review")
    def post_review() -> Response:
        """Bulk-mark URLs as user-reviewed (verdict unchanged)."""
        payload = request.get_json(silent=True) or {}
        urls = payload.get("urls")
        if not isinstance(urls, list) or not all(
            isinstance(u, str) for u in urls
        ):
            abort(400, "body must be {urls: list[str]}")
        labels = load_labels(labels_path)
        reviewed_count = sum(1 for u in urls if mark_reviewed(labels, u))
        if reviewed_count:
            save_labels(labels, labels_path)
        return jsonify(ok=True, reviewed=reviewed_count)

    return app


# --- CLI ---------------------------------------------------------------------


def open_browser_async(url: str) -> None:
    """Open ``url`` in the user's browser without blocking."""
    threading.Thread(target=webbrowser.open, args=(url,), daemon=True).start()


def _run_server(args: argparse.Namespace) -> int:
    dims = json.loads(args.dimensions.read_text(encoding="utf-8"))
    candidates = enumerate_candidates(dims)
    if not candidates:
        logger.error("No candidate images found in %s", args.dimensions)
        return 1

    luminances: Mapping[str, float] = {}
    if not args.skip_luminance:
        luminances = ensure_luminances(candidates, cache_path=args.luminance)
        new = autolabel_by_luminance(
            candidates, luminances, labels_path=args.labels
        )
        if new:
            inverts = sum(1 for v in new.values() if v)
            logger.info(
                "Auto-labeled %d images by luminance (threshold=%.2f): "
                "%d invert, %d don't-invert. Override in the UI as needed.",
                len(new),
                LUMINANCE_INVERT_THRESHOLD,
                inverts,
                len(new) - inverts,
            )

    url = f"http://{args.host}:{args.port}/"
    logger.info("Labeling %d candidates. Open %s", len(candidates), url)
    if not args.no_browser:
        open_browser_async(url)
    app = create_app(candidates, labels_path=args.labels, luminances=luminances)
    app.run(host=args.host, port=args.port, debug=False, use_reloader=False)
    return 0


def _run_apply_annotations(args: argparse.Namespace) -> int:
    result = apply_markdown_annotations(args.content, labels_path=args.labels)
    logger.info(
        "Applied annotations from %s: %d decisions across %d file(s).",
        args.content,
        len(result.decisions),
        len(result.files_modified),
    )
    for url, decision in result.decisions:
        logger.info("  %s -> %s", "invert" if decision else "no-invert", url)
    return 0


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply-annotations",
        action="store_true",
        help=(
            "Read {.invert-on-dark}/{.no-invert-on-dark} annotations from "
            "markdown, persist decisions to the labels JSON, and strip the "
            "annotations from the markdown. Mutates files in place."
        ),
    )
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--dimensions", type=Path, default=DIMENSIONS_JSON)
    parser.add_argument("--labels", type=Path, default=LABELS_JSON)
    parser.add_argument("--luminance", type=Path, default=LUMINANCE_JSON)
    parser.add_argument("--content", type=Path, default=CONTENT_DIR)
    parser.add_argument(
        "--skip-luminance",
        action="store_true",
        help="Skip computing luminance + auto-labeling on server start.",
    )
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    if args.apply_annotations:
        return _run_apply_annotations(args)
    return _run_server(args)


if __name__ == "__main__":
    sys.exit(main())
