"""
Invert-in-dark-mode classification: interactive UI + Markdown scanner.

Two ways to populate ``.invert_labels.json``:

1. Interactive (default): ``uv run scripts/label_invert.py``
   Serves a Flask grid where each image is shown on a light card and a
   dark card with the candidate dark-mode invert filter applied. Pick
   "Invert", "Don't invert", or "Unlabeled" per image.

2. Non-interactive: ``uv run scripts/label_invert.py --apply-annotations``
   Walks ``website_content/*.md`` for image references followed by
   ``{.invert-on-dark}`` or ``{.no-invert-on-dark}`` annotations,
   records them in the JSON (true / false respectively), and strips
   the annotation from the markdown. Mutates both the JSON and the
   markdown files in place.

Labels file shape: ``{url: true | false}``. Missing keys are unlabeled.
The build-time Quartz plugin only adds the ``invert-in-dark-mode``
class when the value is ``true``.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import tempfile
import threading
import webbrowser
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from flask import Flask, Response, abort, jsonify, render_template, request

logger = logging.getLogger(__name__)

PROJECT_ROOT: Final[Path] = Path(__file__).resolve().parent.parent
TRANSFORMERS_DIR: Final[Path] = (
    PROJECT_ROOT / "quartz" / "plugins" / "transformers"
)
DIMENSIONS_JSON: Final[Path] = TRANSFORMERS_DIR / ".asset_dimensions.json"
LABELS_JSON: Final[Path] = TRANSFORMERS_DIR / ".invert_labels.json"
CONTENT_DIR: Final[Path] = PROJECT_ROOT / "website_content"

RASTER_EXTENSIONS: Final[frozenset[str]] = frozenset(
    {".avif", ".png", ".jpg", ".jpeg", ".webp", ".gif"}
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
    if not any(url.lower().endswith(ext) for ext in RASTER_EXTENSIONS):
        return False
    segments = url.split("?", 1)[0].split("/")
    return not any(seg in EXCLUDED_SEGMENTS for seg in segments)


def enumerate_candidates(dimensions: Iterable[str]) -> tuple[str, ...]:
    """Sorted, deduplicated raster content image URLs."""
    return tuple(sorted({u for u in dimensions if _is_candidate(u)}))


# --- labels JSON I/O ---------------------------------------------------------


def load_labels(path: Path = LABELS_JSON) -> dict[str, bool]:
    """Load ``{url: bool}`` labels (empty if missing)."""
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return {str(k): bool(v) for k, v in data.items()}


def save_labels(labels: Mapping[str, bool], path: Path = LABELS_JSON) -> None:
    """Atomically write the labels JSON, sorted by URL."""
    sorted_labels = dict(sorted(labels.items()))
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=path.name + ".", suffix=".tmp", dir=str(path.parent)
    )
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(sorted_labels, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        os.replace(tmp, path)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise


def apply_label(
    labels: dict[str, bool], url: str, decision: bool | None
) -> None:
    """Mutate ``labels`` to record one decision (None clears the entry)."""
    if decision is None:
        labels.pop(url, None)
    else:
        labels[url] = decision


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
                apply_label(labels, url, decision)
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
) -> Flask:
    """Build the labeling Flask app."""
    app = Flask(__name__, template_folder="templates")
    candidate_set = frozenset(candidates)

    @app.get("/")
    def index() -> str:
        labels = load_labels(labels_path)
        return render_template(
            "invert_labeler.html",
            candidates=candidates,
            labels=labels,
            invert_count=sum(1 for u in candidates if labels.get(u) is True),
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
        apply_label(labels, url, _DECISION_PARAM[state])
        save_labels(labels, labels_path)
        return jsonify(ok=True)

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
    url = f"http://{args.host}:{args.port}/"
    logger.info("Labeling %d candidates. Open %s", len(candidates), url)
    if not args.no_browser:
        open_browser_async(url)
    app = create_app(candidates, labels_path=args.labels)
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
    parser.add_argument("--content", type=Path, default=CONTENT_DIR)
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    if args.apply_annotations:
        return _run_apply_annotations(args)
    return _run_server(args)


if __name__ == "__main__":
    sys.exit(main())
