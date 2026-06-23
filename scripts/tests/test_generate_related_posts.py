"""Tests for scripts/generate_related_posts.py."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import MagicMock

import pytest

sys.path.append(str(Path(__file__).parent.parent))

if TYPE_CHECKING:
    from .. import generate_related_posts as grp
else:
    import generate_related_posts as grp


# --- fixtures ----------------------------------------------------------------


def _write_md(
    directory: Path,
    name: str,
    *,
    title: str | None = "Title",
    permalink: str | None = "perma",
    description: str | None = "Desc.",
    draft: bool = False,
    hide_metadata: bool = False,
    body: str = "Body text.",
) -> Path:
    lines = ["---"]
    if title is not None:
        lines.append(f"title: {title}")
    if permalink is not None:
        lines.append(f"permalink: {permalink}")
    if description is not None:
        lines.append(f"description: {description}")
    if draft:
        lines.append("draft: true")
    if hide_metadata:
        lines.append('hide_metadata: "true"')
    lines.append("---")
    lines.append("")
    lines.append(body)
    path = directory / name
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def _cache_entry(vec: list[float], text_hash: str, model: str = grp.MODEL):
    return {"embedding": vec, "text_hash": text_hash, "model": model}


# --- is_embeddable_article ---------------------------------------------------


_VALID_FM = {"title": "T", "permalink": "p", "description": "D"}


class TestIsEmbeddableArticle:
    @pytest.mark.parametrize(
        ("frontmatter", "expected"),
        [
            (_VALID_FM, True),
            ({}, False),
            ({**_VALID_FM, "draft": True}, False),
            ({**_VALID_FM, "hide_metadata": "true"}, False),
            ({"permalink": "p", "description": "D"}, False),  # no title
            ({"title": "T", "description": "D"}, False),  # no permalink
            ({"title": "T", "permalink": "p"}, False),  # no description
        ],
    )
    def test_predicate(self, frontmatter: dict, expected: bool) -> None:
        assert grp.script_utils.is_embeddable_article(frontmatter) is expected


# --- text helpers ------------------------------------------------------------


def test_build_embed_input_truncates() -> None:
    out = grp.build_embed_input("T", "D", "x" * 100, max_chars=10)
    assert out == "T\nD\n" + "x" * 10


def test_text_hash_is_stable_and_input_sensitive() -> None:
    assert grp.text_hash("abc") == grp.text_hash("abc")
    assert grp.text_hash("abc") != grp.text_hash("abd")


# --- gather_articles ---------------------------------------------------------


class TestGatherArticles:
    def test_enumerates_sorted_by_filename(self, tmp_path: Path) -> None:
        _write_md(tmp_path, "b-post.md", permalink="/b/")
        _write_md(tmp_path, "a-post.md", permalink="a")
        articles = grp.gather_articles(tmp_path)
        assert articles[0].permalink == "a"
        assert articles[1].permalink == "b"  # stripped slashes

    def test_skips_drafts(self, tmp_path: Path) -> None:
        _write_md(tmp_path, "draft.md", draft=True)
        assert grp.gather_articles(tmp_path) == ()

    def test_skips_hide_metadata_listing_pages(self, tmp_path: Path) -> None:
        _write_md(tmp_path, "posts.md", permalink="posts", hide_metadata=True)
        assert grp.gather_articles(tmp_path) == ()

    @pytest.mark.parametrize("missing", ["title", "permalink", "description"])
    def test_skips_missing_required_field(
        self, tmp_path: Path, missing: str
    ) -> None:
        _write_md(tmp_path, "x.md", **{missing: None})
        assert grp.gather_articles(tmp_path) == ()

    def test_excerpt_is_stripped_description(self, tmp_path: Path) -> None:
        _write_md(tmp_path, "x.md", description="  Spaced out.  ")
        (article,) = grp.gather_articles(tmp_path)
        assert article.excerpt == "Spaced out."


# --- cache I/O ---------------------------------------------------------------


class TestCacheIO:
    def test_round_trip(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        cache = {"a": _cache_entry([1.0, 2.0], "h")}
        grp.save_cache(cache, path)
        assert grp.load_cache(path) == cache

    def test_load_missing_is_empty(self, tmp_path: Path) -> None:
        assert grp.load_cache(tmp_path / "nope.json") == {}

    def test_load_rejects_non_object(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        path.write_text("[]", encoding="utf-8")
        with pytest.raises(ValueError, match="must contain a JSON object"):
            grp.load_cache(path)

    def test_load_rejects_bad_entry(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        path.write_text(
            json.dumps({"a": {"embedding": [1.0]}}), encoding="utf-8"
        )
        with pytest.raises(ValueError, match="must be"):
            grp.load_cache(path)

    def test_atomic_write_cleans_tmp_on_error(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        with pytest.raises(TypeError):
            grp.script_utils.atomic_write_json({"bad": {1, 2}}, path)
        assert list(tmp_path.iterdir()) == []


# --- R2 sync -----------------------------------------------------------------


class TestR2Sync:
    def test_rclone_copyto_invokes_subprocess(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        calls: list[object] = []
        monkeypatch.setattr(grp.script_utils, "check_r2_env", lambda: None)
        monkeypatch.setattr(
            grp.script_utils, "find_executable", lambda name: name
        )
        monkeypatch.setattr(
            grp.subprocess,
            "run",
            lambda args, check: calls.append((args, check)),
        )
        grp._rclone_copyto("src", "dst")
        assert calls == [(["rclone", "copyto", "src", "dst"], True)]

    def test_download_when_present(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        calls: list[tuple[str, str]] = []
        monkeypatch.setattr(grp, "check_exists_on_r2", lambda target: True)
        monkeypatch.setattr(
            grp, "_rclone_copyto", lambda src, dst: calls.append((src, dst))
        )
        grp.download_cache_from_r2(tmp_path / "c.json")
        assert calls == [(grp.CACHE_R2_TARGET, str(tmp_path / "c.json"))]

    def test_download_when_absent_does_nothing(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(grp, "check_exists_on_r2", lambda target: False)
        monkeypatch.setattr(
            grp, "_rclone_copyto", lambda *a: pytest.fail("should not copy")
        )
        grp.download_cache_from_r2(Path("c.json"))

    def test_upload(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        calls: list[tuple[str, str]] = []
        monkeypatch.setattr(
            grp, "_rclone_copyto", lambda src, dst: calls.append((src, dst))
        )
        grp.upload_cache_to_r2(tmp_path / "c.json")
        assert calls == [(str(tmp_path / "c.json"), grp.CACHE_R2_TARGET)]


# --- embeddings --------------------------------------------------------------


class TestEmbedTexts:
    def test_empty_returns_empty(self) -> None:
        assert grp.embed_texts([]) == []

    def test_uses_injected_client(self) -> None:
        client = MagicMock()
        client.embed.return_value = MagicMock(embeddings=[[1, 2], [3, 4]])
        out = grp.embed_texts(["a", "b"], client=client)
        assert out == [[1.0, 2.0], [3.0, 4.0]]
        assert client.embed.call_args.kwargs["input_type"] == "document"

    def test_lazily_constructs_default_client(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        fake = MagicMock()
        fake.Client.return_value.embed.return_value = MagicMock(
            embeddings=[[5.0]]
        )
        monkeypatch.setitem(sys.modules, "voyageai", fake)
        assert grp.embed_texts(["a"]) == [[5.0]]
        fake.Client.assert_called_once_with()


# --- compute_neighbors -------------------------------------------------------


def _article(permalink: str) -> grp.Article:
    return grp.Article(
        permalink=permalink,
        title=permalink.title(),
        excerpt=f"about {permalink}",
        embed_input="x",
        text_hash="h",
    )


class TestComputeNeighbors:
    def test_fewer_than_two_returns_empty_lists(self) -> None:
        result = grp.compute_neighbors({"a": [1.0, 0.0]}, {"a": _article("a")})
        assert result == {"a": []}

    def test_ranks_by_cosine_and_respects_top_n(self) -> None:
        embeddings = {
            "a": [1.0, 0.0],
            "b": [0.9, 0.1],
            "c": [0.0, 1.0],
        }
        articles = {s: _article(s) for s in embeddings}
        result = grp.compute_neighbors(embeddings, articles, top_n=1)
        assert [n["permalink"] for n in result["a"]] == ["b"]
        assert result["a"][0]["score"] <= 1.0

    def test_excludes_self_and_unknown_articles(self) -> None:
        embeddings = {"a": [1.0, 0.0], "b": [0.0, 1.0]}
        # Only "a" has article metadata, so "b" is dropped entirely.
        result = grp.compute_neighbors(embeddings, {"a": _article("a")})
        assert result == {"a": []}

    def test_zero_vector_scores_zero(self) -> None:
        embeddings = {"a": [0.0, 0.0], "b": [1.0, 0.0]}
        articles = {s: _article(s) for s in embeddings}
        result = grp.compute_neighbors(embeddings, articles)
        assert [n["permalink"] for n in result["a"]] == ["b"]
        assert result["a"][0]["score"] == 0.0

    def test_min_score_drops_weak_filler_but_keeps_best(self) -> None:
        # a-b ~0.99 (strong); a-c == 0 and b-c ~0.14 (both below floor 0.7).
        embeddings = {"a": [1.0, 0.0], "b": [0.99, 0.14], "c": [0.0, 1.0]}
        articles = {s: _article(s) for s in embeddings}
        result = grp.compute_neighbors(
            embeddings, articles, top_n=5, min_score=0.7
        )
        # a keeps only the strong neighbor; the weak c (0.0) is floored out.
        assert [n["permalink"] for n in result["a"]] == ["b"]
        # c's best neighbor (b, ~0.14) is below the floor but kept as the lone
        # match so the page still renders a block.
        assert [n["permalink"] for n in result["c"]] == ["b"]
        assert result["c"][0]["score"] < 0.7


# --- _select_to_embed --------------------------------------------------------


class TestSelectToEmbed:
    def test_selects_missing_and_stale(self) -> None:
        articles = [
            _article("fresh"),
            _article("missing"),
            _article("stale_hash"),
            _article("stale_model"),
        ]
        # _article sets text_hash="h"; vary the cache to exercise each branch.
        cache = {
            "fresh": _cache_entry([1.0], "h"),
            "stale_hash": _cache_entry([1.0], "other"),
            "stale_model": _cache_entry([1.0], "h", model="old-model"),
        }
        selected = grp._select_to_embed(articles, cache, grp.MODEL)
        assert {a.permalink for a in selected} == {
            "missing",
            "stale_hash",
            "stale_model",
        }


# --- generate ----------------------------------------------------------------


class TestGenerate:
    def test_dry_run_reports_without_embedding(self, tmp_path: Path) -> None:
        content = tmp_path / "content"
        content.mkdir()
        _write_md(content, "a.md", permalink="a")
        _write_md(content, "b.md", permalink="b")
        cache_path = tmp_path / "cache.json"
        neighbors_path = tmp_path / "n.json"
        result = grp.generate(
            grp.GenerateConfig(
                cache_path=cache_path,
                content_dir=content,
                neighbors_path=neighbors_path,
                dry_run=True,
            )
        )
        assert result.embedded == 0
        assert not neighbors_path.exists()

    def test_embeds_within_budget_and_writes_outputs(
        self, tmp_path: Path
    ) -> None:
        content = tmp_path / "content"
        content.mkdir()
        _write_md(content, "a.md", permalink="a", description="alpha")
        _write_md(content, "b.md", permalink="b", description="beta")
        cache_path = tmp_path / "cache.json"
        neighbors_path = tmp_path / "n.json"

        def fake_embed(texts):
            return [[1.0, 0.0] if "alpha" in t else [0.0, 1.0] for t in texts]

        result = grp.generate(
            grp.GenerateConfig(
                cache_path=cache_path,
                content_dir=content,
                neighbors_path=neighbors_path,
                budget=1,
            ),
            embed=fake_embed,
        )
        assert result.embedded == 1
        assert result.skipped_over_budget == 1
        # The budget-skipped article has no embedding → reported as uncovered.
        assert result.uncovered == ("b",)
        cache = grp.load_cache(cache_path)
        assert len(cache) == 1
        neighbors = json.loads(neighbors_path.read_text(encoding="utf-8"))
        # Only one article embedded → no pair → empty neighbor list for it.
        assert all(v == [] for v in neighbors.values())

    def test_skips_save_when_nothing_to_embed(self, tmp_path: Path) -> None:
        content = tmp_path / "content"
        content.mkdir()
        _write_md(content, "a.md", permalink="a")
        (article,) = grp.gather_articles(content)
        cache_path = tmp_path / "cache.json"
        grp.save_cache(
            {article.permalink: _cache_entry([1.0, 0.0], article.text_hash)},
            cache_path,
        )
        before = cache_path.stat().st_mtime_ns
        result = grp.generate(
            grp.GenerateConfig(
                cache_path=cache_path,
                content_dir=content,
                neighbors_path=tmp_path / "n.json",
            ),
            embed=lambda texts: pytest.fail("should not embed"),
        )
        assert result.embedded == 0
        assert result.uncovered == ()  # the lone cached article is covered
        assert cache_path.stat().st_mtime_ns == before

    def test_default_embed_uses_embed_texts(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        content = tmp_path / "content"
        content.mkdir()
        _write_md(content, "a.md", permalink="a")
        captured: dict[str, object] = {}

        def fake_embed_texts(texts, *, model):
            captured["model"] = model
            return [[1.0] for _ in texts]

        monkeypatch.setattr(grp, "embed_texts", fake_embed_texts)
        grp.generate(
            grp.GenerateConfig(
                cache_path=tmp_path / "cache.json",
                content_dir=content,
                neighbors_path=tmp_path / "n.json",
            )
        )
        assert captured["model"] == grp.MODEL


# --- main --------------------------------------------------------------------


class TestMain:
    def test_dry_run_needs_no_credentials(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("VOYAGE_API_KEY", raising=False)
        content = tmp_path / "content"
        content.mkdir()
        _write_md(content, "a.md", permalink="a")
        assert (
            grp.main(
                [
                    "--dry-run",
                    "--content-dir",
                    str(content),
                    "--neighbors",
                    str(tmp_path / "n.json"),
                ]
            )
            == 0
        )

    def test_requires_api_key_when_not_dry_run(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("VOYAGE_API_KEY", raising=False)
        with pytest.raises(RuntimeError, match="VOYAGE_API_KEY"):
            grp.main([])

    def test_full_run_downloads_and_uploads(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("VOYAGE_API_KEY", "k")
        events: list[str] = []
        monkeypatch.setattr(
            grp, "download_cache_from_r2", lambda p: events.append("download")
        )
        monkeypatch.setattr(
            grp, "upload_cache_to_r2", lambda p: events.append("upload")
        )
        monkeypatch.setattr(
            grp,
            "generate",
            lambda config, **kwargs: grp.RunResult(
                embedded=2, reused=0, skipped_over_budget=0
            ),
        )
        assert grp.main([]) == 0
        assert events == ["download", "upload"]

    def test_no_upload_when_nothing_embedded(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("VOYAGE_API_KEY", "k")
        events: list[str] = []
        monkeypatch.setattr(
            grp, "download_cache_from_r2", lambda p: events.append("download")
        )
        monkeypatch.setattr(
            grp, "upload_cache_to_r2", lambda p: events.append("upload")
        )
        monkeypatch.setattr(
            grp,
            "generate",
            lambda config, **kwargs: grp.RunResult(
                embedded=0, reused=5, skipped_over_budget=0
            ),
        )
        assert grp.main([]) == 0
        assert events == ["download"]

    def _stub_full_run(
        self, monkeypatch: pytest.MonkeyPatch, uncovered: tuple[str, ...]
    ) -> None:
        monkeypatch.setenv("VOYAGE_API_KEY", "k")
        monkeypatch.setattr(grp, "download_cache_from_r2", lambda p: None)
        monkeypatch.setattr(grp, "upload_cache_to_r2", lambda p: None)
        monkeypatch.setattr(
            grp,
            "generate",
            lambda config, **kwargs: grp.RunResult(
                embedded=1,
                reused=0,
                skipped_over_budget=len(uncovered),
                uncovered=uncovered,
            ),
        )

    def test_incomplete_run_fails_by_default(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        self._stub_full_run(monkeypatch, uncovered=("b", "c"))
        assert grp.main([]) == 1

    def test_allow_incomplete_passes(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        self._stub_full_run(monkeypatch, uncovered=("b",))
        assert grp.main(["--allow-incomplete"]) == 0
