"""
Generate the "Similar links" neighbor map powering the related-posts block.

For every article in ``website_content/*.md`` this script embeds a normalized
``title + description + truncated body`` once via Voyage AI, caches the vector
(content-hash-invalidated), and writes the top-N cosine neighbors per article to
``quartz/plugins/transformers/related_posts.json`` (committed; read at build
time). The production build never calls the API — only this on-demand script
does.

Cost controls:

- **One embedding per article**, reused across runs while the text is unchanged.
- The vector cache lives **on R2** (``r2:turntrout``), downloaded at start and
  re-uploaded at end, so fresh clones / CI never re-embed existing articles.
- ``--budget`` caps how many not-yet-cached articles get embedded per run; the
  rest simply get no block until a later run embeds them.

Requires ``VOYAGE_API_KEY`` plus the R2 credentials in ``utils.R2_REQUIRED_ENV``
(only when actually embedding / syncing — ``--dry-run`` needs neither).
"""

from __future__ import annotations

import argparse
import logging
import os
import subprocess
import sys
import tempfile
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Final, TypedDict

import numpy as np

# Support `uv run python scripts/generate_related_posts.py`: when given a
# script path, sys.path[0] is `scripts/`, not the project root.
# pylint: disable=wrong-import-position
sys.path.append(str(Path(__file__).parent.parent))

from scripts import utils as script_utils  # noqa: E402
from scripts.r2_upload import R2_BUCKET_NAME, check_exists_on_r2  # noqa: E402

# pylint: enable=wrong-import-position

logger = logging.getLogger(__name__)

PROJECT_ROOT: Final[Path] = Path(__file__).resolve().parent.parent
TRANSFORMERS_DIR: Final[Path] = (
    PROJECT_ROOT / "quartz" / "plugins" / "transformers"
)
CONTENT_DIR: Final[Path] = PROJECT_ROOT / script_utils.CONTENT_DIR_NAME
NEIGHBORS_JSON: Final[Path] = TRANSFORMERS_DIR / "related_posts.json"

# Vector cache key on R2 (``r2:turntrout/<key>``). Lives on R2 rather than git
# so it survives fresh clones without committing ~MBs of churny float vectors.
CACHE_R2_KEY: Final[str] = "embeddings/related-posts-voyage.json"
CACHE_R2_TARGET: Final[str] = f"r2:{R2_BUCKET_NAME}/{CACHE_R2_KEY}"

_CONFIG = script_utils.load_shared_constants()["relatedPosts"]
MODEL: Final[str] = str(_CONFIG["model"])
DEFAULT_BUDGET: Final[int] = int(_CONFIG["maxNewEmbeddingsPerRun"])
TOP_N: Final[int] = int(_CONFIG["topN"])
MAX_EMBED_CHARS: Final[int] = int(_CONFIG["maxEmbedChars"])


# --- article enumeration -----------------------------------------------------


@dataclass(frozen=True)
class Article:
    """One enumerable, embeddable article, identified by its ``permalink``."""

    permalink: str
    title: str
    excerpt: str
    embed_input: str
    text_hash: str


def build_embed_input(
    title: str, description: str, body: str, *, max_chars: int = MAX_EMBED_CHARS
) -> str:
    """Normalized ``title + description + truncated body`` fed to the
    embedder."""
    return f"{title}\n{description}\n{body[:max_chars]}"


def text_hash(text: str) -> str:
    """SHA-256 hex digest of the exact text sent to the embedder."""
    return sha256(text.encode("utf-8")).hexdigest()


def gather_articles(content_dir: Path = CONTENT_DIR) -> tuple[Article, ...]:
    """
    Enumerate publishable top-level articles, sorted by permalink.

    Skips drafts and any file missing a ``title``, ``permalink``, or
    ``description`` (all three are required to render a link with an excerpt).
    """
    articles: list[Article] = []
    for md_path in sorted(content_dir.glob("*.md")):
        front, body = script_utils.split_yaml(md_path)
        title = front.get("title")
        permalink = front.get("permalink")
        description = front.get("description")
        if front.get("draft") is True or not (
            title and permalink and description
        ):
            continue
        excerpt = str(description).strip()
        embed_input = build_embed_input(str(title), excerpt, body)
        articles.append(
            Article(
                permalink=str(permalink).strip("/"),
                title=str(title),
                excerpt=excerpt,
                embed_input=embed_input,
                text_hash=text_hash(embed_input),
            )
        )
    return tuple(articles)


# --- embedding cache ---------------------------------------------------------


class CacheEntry(TypedDict):
    """One cached embedding: the vector plus what it was computed from."""

    embedding: list[float]
    text_hash: str
    model: str


def load_cache(path: Path) -> dict[str, CacheEntry]:
    """Load the ``{permalink: {embedding, text_hash, model}}`` cache (empty if
    absent)."""
    data = script_utils.load_json_object(path)
    out: dict[str, CacheEntry] = {}
    for key, value in data.items():
        if (
            not isinstance(value, dict)
            or {"embedding", "text_hash", "model"} - value.keys()
        ):
            raise ValueError(
                f"{path} entry for {key!r} must be "
                "{embedding, text_hash, model}"
            )
        out[str(key)] = CacheEntry(
            embedding=[float(x) for x in value["embedding"]],
            text_hash=str(value["text_hash"]),
            model=str(value["model"]),
        )
    return out


def save_cache(cache: Mapping[str, CacheEntry], path: Path) -> None:
    """Atomically write the embedding cache."""
    script_utils.atomic_write_json(
        {k: dict(v) for k, v in cache.items()}, path, sort_keys=True
    )


# --- R2 sync -----------------------------------------------------------------


def _rclone_copyto(src: str, dst: str) -> None:
    """Run ``rclone copyto src dst`` against the ``r2:`` remote."""
    script_utils.check_r2_env()
    subprocess.run(
        [script_utils.find_executable("rclone"), "copyto", src, dst], check=True
    )


def download_cache_from_r2(local_path: Path) -> None:
    """
    Download the vector cache from R2 to ``local_path``.

    No-op if the object doesn't exist on R2 yet (first run), so ``load_cache``
    starts from an empty cache.
    """
    if not check_exists_on_r2(CACHE_R2_TARGET):
        logger.info("No embedding cache on R2 yet; starting fresh.")
        return
    _rclone_copyto(CACHE_R2_TARGET, str(local_path))
    logger.info("Downloaded embedding cache from %s", CACHE_R2_TARGET)


def upload_cache_to_r2(local_path: Path) -> None:
    """Upload the (updated) vector cache from ``local_path`` back to R2."""
    _rclone_copyto(str(local_path), CACHE_R2_TARGET)
    logger.info("Uploaded embedding cache to %s", CACHE_R2_TARGET)


# --- embeddings --------------------------------------------------------------


def embed_texts(
    texts: Sequence[str], *, model: str = MODEL, client: object | None = None
) -> list[list[float]]:
    """Embed ``texts`` via Voyage; returns one float vector per input."""
    if not texts:
        return []
    if client is None:
        import voyageai  # pylint: disable=import-outside-toplevel

        client = voyageai.Client()
    result = client.embed(  # type: ignore[attr-defined]
        list(texts), model=model, input_type="document"
    )
    return [[float(x) for x in vec] for vec in result.embeddings]


# --- neighbor computation ----------------------------------------------------


class Neighbor(TypedDict):
    """
    One rendered "Similar links" entry.

    ``score`` is kept for transparency.
    """

    permalink: str
    title: str
    excerpt: str
    score: float


def compute_neighbors(
    embeddings: Mapping[str, Sequence[float]],
    articles: Mapping[str, Article],
    *,
    top_n: int = TOP_N,
) -> dict[str, list[Neighbor]]:
    """
    Top-``top_n`` cosine neighbors per article, keyed by permalink.

    Only permalinks that have both an embedding and article metadata
    participate.
    """
    permalinks = sorted(p for p in embeddings if p in articles)
    result: dict[str, list[Neighbor]] = {p: [] for p in permalinks}
    if len(permalinks) < 2:
        return result

    matrix = np.array([embeddings[p] for p in permalinks], dtype=float)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    normed = matrix / np.where(norms == 0, 1.0, norms)
    sims = normed @ normed.T

    for i, permalink in enumerate(permalinks):
        neighbors: list[Neighbor] = []
        for j in np.argsort(-sims[i], kind="stable"):
            j_idx = int(j)
            if j_idx == i:
                continue
            other = articles[permalinks[j_idx]]
            neighbors.append(
                Neighbor(
                    permalink=other.permalink,
                    title=other.title,
                    excerpt=other.excerpt,
                    score=round(float(sims[i][j_idx]), 6),
                )
            )
            if len(neighbors) >= top_n:
                break
        result[permalink] = neighbors
    return result


# --- orchestration -----------------------------------------------------------


@dataclass(frozen=True)
class RunResult:
    """Summary of one generator run."""

    embedded: int
    reused: int
    skipped_over_budget: int
    uncovered: tuple[str, ...] = ()
    """Permalinks of content articles left without a neighbor entry (e.g.
    skipped because the per-run budget was exhausted)."""


def _select_to_embed(
    articles: Iterable[Article], cache: Mapping[str, CacheEntry], model: str
) -> list[Article]:
    """Articles whose cached vector is missing or stale (hash/model
    mismatch)."""
    stale: list[Article] = []
    for article in articles:
        entry = cache.get(article.permalink)
        if (
            entry is None
            or entry["text_hash"] != article.text_hash
            or entry["model"] != model
        ):
            stale.append(article)
    return stale


@dataclass(frozen=True)
class GenerateConfig:
    """Inputs for one :func:`generate` run."""

    cache_path: Path
    content_dir: Path = CONTENT_DIR
    neighbors_path: Path = NEIGHBORS_JSON
    budget: int = DEFAULT_BUDGET
    model: str = MODEL
    top_n: int = TOP_N
    dry_run: bool = False


def _embed_and_cache(
    to_embed: Sequence[Article],
    cache: dict[str, CacheEntry],
    config: GenerateConfig,
    embed: Callable[[Sequence[str]], list[list[float]]] | None,
) -> None:
    """Embed ``to_embed`` and persist the new vectors into ``cache``."""
    embed_fn = embed or (lambda texts: embed_texts(texts, model=config.model))
    vectors = embed_fn([a.embed_input for a in to_embed])
    for article, vector in zip(to_embed, vectors):
        cache[article.permalink] = CacheEntry(
            embedding=list(vector),
            text_hash=article.text_hash,
            model=config.model,
        )
    save_cache(cache, config.cache_path)


def generate(
    config: GenerateConfig,
    *,
    embed: Callable[[Sequence[str]], list[list[float]]] | None = None,
) -> RunResult:
    """Embed new/changed articles (within budget) and write the neighbor map."""
    articles = gather_articles(config.content_dir)
    by_permalink = {a.permalink: a for a in articles}

    cache = load_cache(config.cache_path)
    stale = _select_to_embed(articles, cache, config.model)
    to_embed = stale[: config.budget]
    reused = len(articles) - len(stale)
    skipped = len(stale) - len(to_embed)

    logger.info(
        "%d articles: %d cached, %d to embed, %d skipped (budget=%d)",
        len(articles),
        reused,
        len(to_embed),
        skipped,
        config.budget,
    )

    if config.dry_run:
        for article in to_embed:
            logger.info("  would embed: %s", article.permalink)
        return RunResult(embedded=0, reused=reused, skipped_over_budget=skipped)

    if to_embed:
        _embed_and_cache(to_embed, cache, config, embed)

    embeddings = {
        permalink: entry["embedding"]
        for permalink, entry in cache.items()
        if permalink in by_permalink and entry["model"] == config.model
    }
    neighbors = compute_neighbors(embeddings, by_permalink, top_n=config.top_n)
    script_utils.atomic_write_json(
        neighbors, config.neighbors_path, sort_keys=True
    )
    logger.info(
        "Wrote %d permalinks to %s", len(neighbors), config.neighbors_path
    )

    uncovered = tuple(
        a.permalink for a in articles if a.permalink not in neighbors
    )
    return RunResult(
        embedded=len(to_embed),
        reused=reused,
        skipped_over_budget=skipped,
        uncovered=uncovered,
    )


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--budget", type=int, default=DEFAULT_BUDGET)
    parser.add_argument("--content-dir", type=Path, default=CONTENT_DIR)
    parser.add_argument("--neighbors", type=Path, default=NEIGHBORS_JSON)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be embedded without calling the API or R2.",
    )
    parser.add_argument(
        "--allow-incomplete",
        action="store_true",
        help=(
            "Exit 0 even when the budget leaves some content article without a "
            "neighbor entry. By default an incomplete run fails."
        ),
    )
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    if not args.dry_run and not os.environ.get("VOYAGE_API_KEY"):
        raise RuntimeError(
            "VOYAGE_API_KEY not set — required to embed articles. "
            "Use --dry-run to preview without it."
        )

    with tempfile.TemporaryDirectory() as tmp:
        cache_path = Path(tmp) / "related-posts-voyage.json"
        if not args.dry_run:
            download_cache_from_r2(cache_path)
        result = generate(
            GenerateConfig(
                cache_path=cache_path,
                content_dir=args.content_dir,
                neighbors_path=args.neighbors,
                budget=args.budget,
                dry_run=args.dry_run,
            )
        )
        if not args.dry_run and result.embedded:
            upload_cache_to_r2(cache_path)

    logger.info(
        "Done: embedded=%d reused=%d skipped=%d",
        result.embedded,
        result.reused,
        result.skipped_over_budget,
    )

    if not args.dry_run and not args.allow_incomplete and result.uncovered:
        logger.error(
            "%d content article(s) have no neighbor entry: %s\n"
            "Raise relatedPosts.maxNewEmbeddingsPerRun (or --budget) and "
            "re-run, or pass --allow-incomplete to bypass.",
            len(result.uncovered),
            ", ".join(result.uncovered),
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
